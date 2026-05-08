-- ============================================================================
-- Finca San Mateo schema (delta v1)
-- All amounts in EUR cents (BIGINT). No currency column anywhere.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- ENUMs
-- ============================================================================

CREATE TYPE booking_status AS ENUM (
  'request',
  'invite',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled'
);

CREATE TYPE invitation_status AS ENUM (
  'invited',
  'accepted',
  'declined'
);

CREATE TYPE service_fee_type AS ENUM (
  'late_checkout',
  'extra_cleaning',
  'commission',
  'other'
);

CREATE TYPE payment_type AS ENUM (
  'deposit',
  'balance',
  'reservation',
  'extra_guest'
);

CREATE TYPE cancelled_by AS ENUM (
  'guest',
  'admin'
);

-- ============================================================================
-- USERS
-- ============================================================================

CREATE TABLE users (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT        NOT NULL,
  email        TEXT        NOT NULL UNIQUE,
  tif          TEXT,
  nationality  TEXT,
  dob          DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- PROPERTIES
-- ============================================================================

CREATE TABLE properties (
  id                 BIGSERIAL PRIMARY KEY,
  slug               TEXT        NOT NULL UNIQUE,
  title              TEXT        NOT NULL,
  description        TEXT        NOT NULL,
  features           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  bedrooms           INT         NOT NULL CHECK (bedrooms >= 0),
  bathrooms          INT         NOT NULL CHECK (bathrooms >= 0),
  m2                 INT         NOT NULL CHECK (m2 > 0),
  max_guests         INT         NOT NULL CHECK (max_guests > 0),
  -- Default cleaning fee for new bookings; goes to Tano (the cleaner). Snapshotted
  -- onto bookings.agreed_cleaning_cents at request time so changes here never
  -- alter past bookings. See docs/refund.md and the snapshots principle.
  cleaning_fee_cents BIGINT      NOT NULL DEFAULT 0 CHECK (cleaning_fee_cents >= 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pricing architecture: see docs/rates.md
CREATE TABLE property_rates (
  id                BIGSERIAL PRIMARY KEY,
  property_id       BIGINT      NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  active            BOOLEAN     NOT NULL DEFAULT true,
  public            BOOLEAN     NOT NULL DEFAULT true,
  min_nights        INT         NOT NULL DEFAULT 1 CHECK (min_nights > 0),
  months            INT[]       NOT NULL CHECK (
                       array_length(months, 1) > 0
                       AND months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]
                    ),
  night_rate_cents  BIGINT      NOT NULL CHECK (night_rate_cents >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_rates_property ON property_rates(property_id) WHERE active;
CREATE INDEX idx_property_rates_months   ON property_rates USING gin(months);

-- ============================================================================
-- BOOKINGS
-- ============================================================================

-- Money-flow snapshot principle (see memory/snapshots_principle.md):
--   agreed_property_cents = night_rate × nights — David's revenue
--   agreed_cleaning_cents = cleaning fee at request time — Tano's pay
-- These are frozen on creation and never recomputed.
CREATE TABLE bookings (
  id                     BIGSERIAL   PRIMARY KEY,
  access_token           UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  property_id            BIGINT      NOT NULL REFERENCES properties(id),
  user_id                BIGINT      REFERENCES users(id),
  date_check_in          DATE        NOT NULL,
  date_check_out         DATE        NOT NULL,
  agreed_property_cents  BIGINT      NOT NULL CHECK (agreed_property_cents >= 0),
  agreed_cleaning_cents  BIGINT      NOT NULL DEFAULT 0 CHECK (agreed_cleaning_cents >= 0),
  status                 booking_status NOT NULL DEFAULT 'request',
  guests                 JSONB       NOT NULL DEFAULT '{"adults":2,"children":0,"infants":0,"pets":0}'::jsonb,
  time_check_in          TIMESTAMPTZ,
  time_check_out         TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (date_check_out > date_check_in)
);

CREATE INDEX idx_bookings_property_dates ON bookings(property_id, date_check_in, date_check_out);
CREATE INDEX idx_bookings_user           ON bookings(user_id);
CREATE INDEX idx_bookings_status         ON bookings(status);

-- Prevent overlapping confirmed/checked_in/checked_out bookings on the same property.
ALTER TABLE bookings ADD CONSTRAINT no_overlap_when_held EXCLUDE USING gist (
  property_id WITH =,
  daterange(date_check_in, date_check_out, '[)') WITH &&
) WHERE (status IN ('confirmed', 'checked_in', 'checked_out'));

-- ============================================================================
-- PROPERTY BLOCKS
-- ============================================================================
-- Admin-imposed unavailability ranges that aren't bookings. Examples: owner stays,
-- maintenance, listing pause. These are NOT bookings — no money, no user, no
-- lifecycle. They're a separate "this property is closed" signal.
--
-- Block ↔ block overlap: rejected by the gist exclusion constraint below.
-- Block ↔ held-booking overlap: enforced in the action layer (src/actions/blocks.ts)
-- because Postgres can't enforce exclusion across two tables. createBlock runs a
-- SELECT … FOR UPDATE against bookings in confirmed/checked_in/checked_out
-- statuses inside a tx and throws a user-readable conflict message.

CREATE TABLE property_blocks (
  id              BIGSERIAL   PRIMARY KEY,
  property_id     BIGINT      NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date_check_in   DATE        NOT NULL,
  date_check_out  DATE        NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (date_check_out > date_check_in),
  EXCLUDE USING gist (
    property_id WITH =,
    daterange(date_check_in, date_check_out, '[)') WITH &&
  )
);

CREATE INDEX idx_property_blocks_property_dates ON property_blocks(property_id, date_check_in, date_check_out);

CREATE TABLE booking_invitations (
  id                BIGSERIAL   PRIMARY KEY,
  booking_id        BIGINT      NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  email             TEXT        NOT NULL,
  status            invitation_status NOT NULL DEFAULT 'invited',
  accepted_user_id  BIGINT      REFERENCES users(id),
  invited_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at      TIMESTAMPTZ
);

CREATE INDEX idx_booking_invitations_email ON booking_invitations(lower(email));

CREATE TABLE booking_service_fees (
  id            BIGSERIAL   PRIMARY KEY,
  booking_id    BIGINT      NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type          service_fee_type NOT NULL,
  amount_cents  BIGINT      NOT NULL CHECK (amount_cents >= 0),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_service_fees_booking ON booking_service_fees(booking_id);

-- ============================================================================
-- BOOKING CANCELLATIONS
-- ============================================================================
-- One row per cancelled booking. Records who cancelled, why, what refund the
-- policy entitled the guest to (computed at cancellation time per docs/refund.md).
-- The actual money movement is in payment_refunds (linked to the original
-- booking_payments row). Compare booking_cancellations.refund_amount_cents to
-- SUM(payment_refunds.amount_cents) for this booking to see if the refund is
-- still owed, partial, or complete.

CREATE TABLE booking_cancellations (
  id                  BIGSERIAL    PRIMARY KEY,
  booking_id          BIGINT       NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  cancelled_by        cancelled_by NOT NULL,
  reason              TEXT,
  -- What we owe the guest per policy. Snapshot — does not change if the policy
  -- is edited later.
  refund_amount_cents BIGINT       NOT NULL CHECK (refund_amount_cents >= 0),
  -- Human-readable label of the policy tier that fired (e.g. "100% (>=15 days)").
  policy_applied      TEXT         NOT NULL,
  cancelled_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_cancellations_cancelled_at ON booking_cancellations(cancelled_at DESC);

-- ============================================================================
-- PAYMENTS
-- ============================================================================

CREATE TABLE booking_payments (
  id            BIGSERIAL   PRIMARY KEY,
  booking_id    BIGINT      NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type          payment_type NOT NULL,
  amount_cents  BIGINT      NOT NULL CHECK (amount_cents >= 0),
  cash          BOOLEAN     NOT NULL DEFAULT true,
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_payments_booking ON booking_payments(booking_id);

CREATE TABLE payment_refunds (
  id            BIGSERIAL   PRIMARY KEY,
  payment_id    BIGINT      NOT NULL REFERENCES booking_payments(id) ON DELETE CASCADE,
  amount_cents  BIGINT      NOT NULL CHECK (amount_cents >= 0),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_refunds_payment ON payment_refunds(payment_id);

-- ============================================================================
-- BOOKING EVENTS (audit log)
-- ============================================================================

CREATE TABLE booking_events (
  id          BIGSERIAL   PRIMARY KEY,
  booking_id  BIGINT      NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_events_booking ON booking_events(booking_id, created_at DESC);

-- ============================================================================
-- updated_at triggers (mutable tables only)
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at      BEFORE UPDATE ON users      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_bookings_updated_at   BEFORE UPDATE ON bookings   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
