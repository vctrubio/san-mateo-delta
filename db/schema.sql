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

-- How the money moved. 'cash' = handed over physically (or owed at check-in).
-- 'stripe' = card processed via Stripe Checkout — see docs/stripe.md.
CREATE TYPE payment_method AS ENUM (
  'cash',
  'stripe'
);

-- Where this payment is in its lifecycle. Cash payments jump straight to
-- 'succeeded' on `Mark received` (or are inserted as 'pending' for cash-on-arrival).
-- Stripe payments start 'pending' (Checkout Session created) and flip to
-- 'succeeded' or 'failed' on webhook.
CREATE TYPE payment_status AS ENUM (
  'pending',
  'succeeded',
  'failed'
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
  -- Per-night rate per calendar month, in EUR cents. JSON object keyed
  -- '1'..'12' (Jan..Dec). Every property must have all 12 months populated;
  -- the CHECK + the PropertyRateForm in the admin enforce that. computeQuote
  -- reads `rates[<month of check_in>]` × nights — no min_nights, no
  -- active/public flag, no separate rate rows. Custom prices for friends &
  -- family go through /admin/invite, which snapshots a one-off price onto
  -- the booking instead of editing this column.
  rates              JSONB       NOT NULL DEFAULT '{}'::jsonb CHECK (
                        jsonb_typeof(rates) = 'object'
                        AND rates ?& array['1','2','3','4','5','6','7','8','9','10','11','12']
                     ),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN properties.rates IS
  'Per-night rate per calendar month in EUR cents. Keys "1"-"12". See docs/rates.md.';

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
  -- Payment policy SNAPSHOT — frozen at booking creation. Resolves
  -- the estate-wide system_settings.active_payment_policy_key (or any
  -- admin override) against the check-in date via the resolver in
  -- src/lib/payment.ts and stores the effective policy here. Future
  -- /admin/payments changes do NOT reach back into this row. See
  -- docs/payment.md.
  payment_policy         JSONB       NOT NULL CHECK (
                            jsonb_typeof(payment_policy) = 'object'
                            AND (payment_policy->>'deposit_pct')::int BETWEEN 0 AND 100
                            AND (payment_policy->>'balance_days_before')::int >= 0
                            AND (payment_policy->>'method') IN ('stripe','cash')
                         ),
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
  id                    BIGSERIAL      PRIMARY KEY,
  booking_id            BIGINT         NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type                  payment_type   NOT NULL,
  amount_cents          BIGINT         NOT NULL CHECK (amount_cents >= 0),
  method                payment_method NOT NULL DEFAULT 'cash',
  status                payment_status NOT NULL DEFAULT 'succeeded',
  -- Stripe identifiers. NULL for cash. Populated as Stripe lifecycle progresses:
  --   stripe_session_id     — set when Checkout Session is created
  --   stripe_payment_intent — set on checkout.session.completed webhook
  --   stripe_charge_id      — set on checkout.session.completed webhook (for refunds)
  stripe_session_id     TEXT,
  stripe_payment_intent TEXT,
  stripe_charge_id      TEXT,
  paid_at               TIMESTAMPTZ    NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CHECK (
    (method = 'cash'   AND stripe_session_id IS NULL) OR
    (method = 'stripe' AND stripe_session_id IS NOT NULL)
  )
);

CREATE INDEX idx_booking_payments_booking          ON booking_payments(booking_id);
CREATE UNIQUE INDEX idx_booking_payments_session   ON booking_payments(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE UNIQUE INDEX idx_booking_payments_intent    ON booking_payments(stripe_payment_intent) WHERE stripe_payment_intent IS NOT NULL;

CREATE TABLE payment_refunds (
  id                BIGSERIAL   PRIMARY KEY,
  payment_id        BIGINT      NOT NULL REFERENCES booking_payments(id) ON DELETE CASCADE,
  amount_cents      BIGINT      NOT NULL CHECK (amount_cents >= 0),
  note              TEXT,
  -- Stripe refund id (re_…). NULL for cash refunds.
  stripe_refund_id  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_refunds_payment        ON payment_refunds(payment_id);
CREATE UNIQUE INDEX idx_payment_refunds_stripe  ON payment_refunds(stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;

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

-- ============================================================================
-- SYSTEM SETTINGS
-- ============================================================================
-- Singleton row (id=1) holding estate-wide runtime config that admin can
-- flip from the UI without redeploying. Today this is just the active
-- payment-policy preset key; future global toggles land here too.
--
-- The active key is one of the four presets defined in src/lib/payment.ts —
-- the CHECK constraint enforces the same vocabulary the picker exposes.
-- Booking rows snapshot their effective policy at creation time, so editing
-- this row never reaches back into existing bookings.

CREATE TABLE system_settings (
  id                          INT         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active_payment_policy_key   TEXT        NOT NULL DEFAULT 'split_14'
                                          CHECK (active_payment_policy_key IN ('split_14','split_7','full_now','cash')),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO system_settings (id) VALUES (1);

CREATE TRIGGER trg_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
