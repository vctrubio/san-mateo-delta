import type { BookingStatus } from '@db/enums';
import type { BookingRow } from './bookings';
import { BLOCKING_BOOKING_STATUSES } from './colors';

// ============================================================================
// Per-booking derived state — the canonical answer to "what bucket is this
// booking in, where's the money, and does it need attention right now?"
// Pure functions, no DB, no React. Safe to import from either side of the
// RSC boundary so admin tables, chips, modals, and notification systems can
// all share the same vocabulary.
//
// Three layers, each independently useful:
//
//   bookingBucket(status)        → 'confirmed' | 'pending' | 'cancelled'
//   paymentState(booking)        → 'paid' | 'partial' | 'unpaid' | 'not_applicable'
//   bookingAlerts(booking, today) → BookingAlertKind[]   (check-in today, overdue, …)
//
// `withState(booking, today)` wraps all three into one object so admin UIs
// can pass around a single value. `aggregateBookings(rows, today)` rolls a
// list up into the counts + money + flattened alerts that every admin
// dashboard surface needs.
//
// `today` is always passed in (not read off `new Date()`) so these helpers
// stay deterministic, testable, and SSR-safe.
// ============================================================================

// ─── 1. Bucket ─────────────────────────────────────────────────────────────
//
// Coarse 3-way split used by every "stats card" surface:
//   confirmed  → held (confirmed / checked_in / checked_out)
//   pending    → request / invite
//   cancelled  → cancelled
//
// Mirrors EstateOverview's SQL FILTER expressions and matches the colour
// keys in STATUS_BUCKET_COLORS.

export type BookingBucket = 'confirmed' | 'pending' | 'cancelled';

export function bookingBucket(status: BookingStatus): BookingBucket {
  if (status === 'cancelled') return 'cancelled';
  if (BLOCKING_BOOKING_STATUSES.includes(status)) return 'confirmed';
  return 'pending';
}

// ─── 2. Payment state ──────────────────────────────────────────────────────
//
// Money perspective independent of booking status. Cancelled bookings get
// their own bucket (`not_applicable`) because once a refund settles, the
// agreed/paid delta no longer means anything.

export type PaymentState = 'paid' | 'partial' | 'unpaid' | 'not_applicable';

export function paymentState(
  b: Pick<BookingRow, 'status' | 'agreed_total_cents' | 'paid_cents'>,
): PaymentState {
  if (b.status === 'cancelled') return 'not_applicable';
  if (b.paid_cents <= 0) return 'unpaid';
  if (b.paid_cents >= b.agreed_total_cents) return 'paid';
  return 'partial';
}

// ─── 3. Alerts ─────────────────────────────────────────────────────────────
//
// Per-booking attention flags — the four conditions in
// `docs/admin-notifications.md`. Each kind is a tuple of state × (date OR
// payment), nothing more. Add a kind only by editing the doc first; the
// doc is the contract and the code conforms to it.
//
// Returns at most one kind per booking — the conditions are mutually
// exclusive on the status enum (a booking can't be both `confirmed` and
// `checked_in`).

export type BookingAlertKind =
  | 'check_in_today'        // status='confirmed'   & date_check_in === today
  | 'overdue_checkin'       // status='confirmed'   & date_check_in <   today
  | 'checked_in_unpaid'     // status='checked_in'  & paid_cents < agreed_total
  | 'request_awaiting';     // status='request'

/** Minimal subset of a booking row needed to derive alert kinds. Lets
 *  callers with a narrower shape (server SELECT projections, mock data)
 *  use this without lugging the full BookingRow around. */
export type AlertableBooking = Pick<BookingRow,
  'status' | 'date_check_in' | 'paid_cents' | 'agreed_total_cents'
>;

export function bookingAlerts(b: AlertableBooking, today: string): BookingAlertKind[] {
  if (b.status === 'request') return ['request_awaiting'];
  if (b.status === 'confirmed') {
    if (b.date_check_in === today) return ['check_in_today'];
    if (b.date_check_in <   today) return ['overdue_checkin'];
  }
  if (b.status === 'checked_in' && b.paid_cents < b.agreed_total_cents) {
    return ['checked_in_unpaid'];
  }
  return [];
}

// ─── Combined per-booking state ────────────────────────────────────────────

export type BookingState = {
  bucket: BookingBucket;
  payment: PaymentState;
  alerts: BookingAlertKind[];
};

export function bookingState(b: BookingRow, today: string): BookingState {
  return {
    bucket: bookingBucket(b.status),
    payment: paymentState(b),
    alerts: bookingAlerts(b, today),
  };
}

/** Booking row with its derived state pre-attached. Handy when an admin
 *  surface wants to render rows and act on their state without recomputing
 *  per cell. */
export type BookingWithState = BookingRow & { state: BookingState };

export function withState(b: BookingRow, today: string): BookingWithState {
  return { ...b, state: bookingState(b, today) };
}

// ─── Rollup ────────────────────────────────────────────────────────────────
//
// One pass over a list of bookings. Returns every count / total / alert
// listing the existing admin surfaces need — replaces the duplicated loops
// in /admin/users/[id], BookingsExplorer's MathRow, and (eventually) the
// EstateOverview SQL.

export type BookingsAggregate = {
  total: number;
  byBucket:       Record<BookingBucket, number>;
  byStatus:       Record<BookingStatus, number>;
  byPaymentState: Record<PaymentState, number>;
  money: {
    agreedTotal:   number;  // sum across ALL bookings (cancelled included for % maths)
    paidTotal:     number;  // sum across non-cancelled
    owedTotal:     number;  // sum (agreed - paid) for non-cancelled
    cleaningTotal: number;  // sum agreed_cleaning_cents on non-cancelled
  };
  /** Flattened list — one entry per (booking, alert). Caller groups/sorts. */
  alerts: Array<{ booking_id: string; kind: BookingAlertKind }>;
};

const ZERO_BUCKET: Record<BookingBucket, number> = { confirmed: 0, pending: 0, cancelled: 0 };
const ZERO_STATUS: Record<BookingStatus, number> = {
  request: 0, invite: 0, confirmed: 0, checked_in: 0, checked_out: 0, cancelled: 0,
};
const ZERO_PAYSTATE: Record<PaymentState, number> = {
  paid: 0, partial: 0, unpaid: 0, not_applicable: 0,
};

export function aggregateBookings(rows: BookingRow[], today: string): BookingsAggregate {
  const out: BookingsAggregate = {
    total: rows.length,
    byBucket:       { ...ZERO_BUCKET },
    byStatus:       { ...ZERO_STATUS },
    byPaymentState: { ...ZERO_PAYSTATE },
    money: { agreedTotal: 0, paidTotal: 0, owedTotal: 0, cleaningTotal: 0 },
    alerts: [],
  };
  for (const b of rows) {
    out.byBucket[bookingBucket(b.status)]++;
    out.byStatus[b.status]++;
    out.byPaymentState[paymentState(b)]++;
    out.money.agreedTotal += b.agreed_total_cents;
    if (b.status !== 'cancelled') {
      out.money.paidTotal     += b.paid_cents;
      out.money.owedTotal     += Math.max(0, b.agreed_total_cents - b.paid_cents);
      out.money.cleaningTotal += b.agreed_cleaning_cents;
    }
    for (const k of bookingAlerts(b, today)) {
      out.alerts.push({ booking_id: b.id, kind: k });
    }
  }
  return out;
}
