-- Drop everything in dependency-safe order. Used by db:reset before re-applying schema.sql.
-- CASCADE wipes all foreign key references in one shot.

DROP TABLE IF EXISTS system_settings        CASCADE;
DROP TABLE IF EXISTS booking_events         CASCADE;
DROP TABLE IF EXISTS payment_refunds        CASCADE;
DROP TABLE IF EXISTS booking_payments       CASCADE;
DROP TABLE IF EXISTS booking_cancellations  CASCADE;
DROP TABLE IF EXISTS booking_service_fees   CASCADE;
DROP TABLE IF EXISTS booking_invitations    CASCADE;
DROP TABLE IF EXISTS property_blocks        CASCADE;
DROP TABLE IF EXISTS bookings               CASCADE;
-- Legacy: cleaning fee folded into properties.cleaning_fee_cents column.
DROP TABLE IF EXISTS property_cleaning_fee  CASCADE;
-- Legacy: night rates folded into properties.rates JSONB column.
DROP TABLE IF EXISTS property_rates         CASCADE;
-- Legacy: characteristics folded into properties columns.
DROP TABLE IF EXISTS property_characteristics CASCADE;
DROP TABLE IF EXISTS properties             CASCADE;
DROP TABLE IF EXISTS users                  CASCADE;

DROP TYPE IF EXISTS cancelled_by;
DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS payment_method;
DROP TYPE IF EXISTS payment_type;
DROP TYPE IF EXISTS service_fee_type;
DROP TYPE IF EXISTS invitation_status;
DROP TYPE IF EXISTS booking_status;

DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
