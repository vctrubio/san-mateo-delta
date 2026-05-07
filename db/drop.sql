-- Drop everything in dependency-safe order. Used by db:reset before re-applying schema.sql.
-- CASCADE wipes all foreign key references in one shot.

DROP TABLE IF EXISTS booking_events         CASCADE;
DROP TABLE IF EXISTS payment_refunds        CASCADE;
DROP TABLE IF EXISTS booking_payments       CASCADE;
DROP TABLE IF EXISTS booking_service_fees   CASCADE;
DROP TABLE IF EXISTS booking_invitations    CASCADE;
DROP TABLE IF EXISTS bookings               CASCADE;
DROP TABLE IF EXISTS property_cleaning_fee  CASCADE;
DROP TABLE IF EXISTS property_rates         CASCADE;
DROP TABLE IF EXISTS property_characteristics CASCADE;
DROP TABLE IF EXISTS properties             CASCADE;
DROP TABLE IF EXISTS users                  CASCADE;

DROP TYPE IF EXISTS payment_type;
DROP TYPE IF EXISTS service_fee_type;
DROP TYPE IF EXISTS invitation_status;
DROP TYPE IF EXISTS booking_status;

DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
