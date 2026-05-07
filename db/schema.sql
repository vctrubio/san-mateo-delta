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
  id           BIGSERIAL PRIMARY KEY,
  slug         TEXT        NOT NULL UNIQUE,
  title        TEXT        NOT NULL,
  description  TEXT        NOT NULL,
  features     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE property_characteristics (
  id           BIGSERIAL PRIMARY KEY,
  property_id  BIGINT      NOT NULL UNIQUE REFERENCES properties(id) ON DELETE CASCADE,
  bedrooms     INT         NOT NULL CHECK (bedrooms >= 0),
  bathrooms    INT         NOT NULL CHECK (bathrooms >= 0),
  m2           INT         NOT NULL CHECK (m2 > 0),
  max_guests   INT         NOT NULL CHECK (max_guests > 0)
);

CREATE TABLE property_rates (
  id            BIGSERIAL PRIMARY KEY,
  property_id   BIGINT      NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  active        BOOLEAN     NOT NULL DEFAULT true,
  public        BOOLEAN     NOT NULL DEFAULT true,
  min_nights    INT         NOT NULL DEFAULT 1 CHECK (min_nights > 0),
  price_cents   BIGINT      NOT NULL CHECK (price_cents >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_rates_property ON property_rates(property_id) WHERE active;

CREATE TABLE property_cleaning_fee (
  id           BIGSERIAL PRIMARY KEY,
  property_id  BIGINT      NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  fee_cents    BIGINT      NOT NULL CHECK (fee_cents >= 0),
  active       BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_property_cleaning_fee_active
  ON property_cleaning_fee(property_id) WHERE active;

-- ============================================================================
-- BOOKINGS
-- ============================================================================

CREATE TABLE bookings (
  id                  BIGSERIAL   PRIMARY KEY,
  access_token        UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  property_id         BIGINT      NOT NULL REFERENCES properties(id),
  user_id             BIGINT      REFERENCES users(id),
  date_check_in       DATE        NOT NULL,
  date_check_out      DATE        NOT NULL,
  agreed_price_cents  BIGINT      NOT NULL CHECK (agreed_price_cents >= 0),
  status              booking_status NOT NULL DEFAULT 'request',
  guests              JSONB       NOT NULL DEFAULT '{"adults":2,"children":0,"infants":0,"pets":0}'::jsonb,
  time_check_in       TIMESTAMPTZ,
  time_check_out      TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
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
