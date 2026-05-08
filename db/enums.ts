// Single source of truth for the enum string sets used by both the database
// (db/schema.sql) and the app. When changing these, update schema.sql to match
// and run `bun db:init`.

export const BOOKING_STATUSES = [
  'request',
  'invite',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const INVITATION_STATUSES = ['invited', 'accepted', 'declined'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const SERVICE_FEE_TYPES = [
  'late_checkout',
  'extra_cleaning',
  'commission',
  'other',
] as const;
export type ServiceFeeType = (typeof SERVICE_FEE_TYPES)[number];

export const PAYMENT_TYPES = [
  'deposit',
  'balance',
  'reservation',
  'extra_guest',
] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_METHODS = ['cash', 'stripe'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['pending', 'succeeded', 'failed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CANCELLED_BY = ['guest', 'admin'] as const;
export type CancelledBy = (typeof CANCELLED_BY)[number];

// ---------------------------------------------------------------------------
// Months — used by property_rates.months to express seasonality.
// See docs/rates.md for the full pricing model.
// ---------------------------------------------------------------------------

export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type Month = (typeof MONTHS)[number];

export const MONTH_NAMES: Record<Month, string> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
};

// Tarifa peaks in summer (kite/wind/wing season). Hosts can override these
// defaults by creating extra rate rows (Easter shoulder, Christmas, festivals).
export const HIGH_SEASON_MONTHS: readonly Month[] = [6, 7, 8];
export const LOW_SEASON_MONTHS: readonly Month[] = [1, 2, 3, 4, 5, 9, 10, 11, 12];
