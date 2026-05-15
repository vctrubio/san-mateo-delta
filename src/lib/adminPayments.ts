import 'server-only';
import { sql } from '@db/client';
import { todayYmd, addDaysYmd } from './dates';
import type { PaymentPolicy } from './payment';

// ============================================================================
// Payments HQ — server fetch.
//
// Mirrors the `adminAlerts` pattern: pure derived data, no payments-summary
// table, no read/unread tracking. Each function returns the rows for one
// section of the `/admin/payments` page. Display logic lives in components;
// money + status math lives here.
//
// Four sections:
//   1. Outstanding             — bookings with paid < agreed_total, not cancelled
//   2. UpcomingBalanceDue      — split-policy bookings whose balance window
//                                opens in the next N days
//   3. RecentSucceededPayments — booking_payments rows, status='succeeded',
//                                last 30d, last 20 rows
//   4. StalePendingSessions    — booking_payments rows, status='pending',
//                                older than 1h (likely abandoned Stripe sessions)
//
// All amounts are EUR cents (BIGINT in DB → int in TS). `payment_policy` is
// the booking's snapshotted JSONB; downstream display reads from it
// directly so estate-wide policy switches don't shift display copy on
// already-placed bookings.
// ============================================================================

// ─── Outstanding ────────────────────────────────────────────────────────────

/** What category of outstanding-money this booking is. Same severity tiering
 *  the bell uses, plus a generic 'upcoming' bucket for bookings further out. */
export type OutstandingUrgency =
  | 'checked_in_unpaid'   // urgent — guest already in-house
  | 'overdue_checkin'     // urgent — past check-in date, still confirmed
  | 'check_in_today'      // warning — arriving today
  | 'upcoming'            // info — confirmed booking, money still owed
  | 'request_awaiting';   // warning — guest submitted, host hasn't accepted

export type OutstandingRow = {
  booking_id: string;
  status: string;
  property_slug: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  date_check_in: string;
  date_check_out: string;
  agreed_total_cents: number;
  paid_cents: number;
  owed_cents: number;
  payment_policy: PaymentPolicy;
  urgency: OutstandingUrgency;
};

export async function getOutstanding(): Promise<OutstandingRow[]> {
  const today = todayYmd();
  return sql<OutstandingRow>(
    `
    SELECT
      b.id::text                                                  AS booking_id,
      b.status::text                                              AS status,
      p.slug                                                      AS property_slug,
      b.user_id::text                                             AS user_id,
      u.name                                                      AS user_name,
      u.email                                                     AS user_email,
      b.date_check_in::text                                       AS date_check_in,
      b.date_check_out::text                                      AS date_check_out,
      (b.agreed_property_cents + b.agreed_cleaning_cents)::int    AS agreed_total_cents,
      paid.amount::int                                            AS paid_cents,
      ((b.agreed_property_cents + b.agreed_cleaning_cents) - paid.amount)::int AS owed_cents,
      b.payment_policy                                            AS payment_policy,
      CASE
        WHEN b.status = 'checked_in'                                       THEN 'checked_in_unpaid'
        WHEN b.status = 'confirmed' AND b.date_check_in < $1::date         THEN 'overdue_checkin'
        WHEN b.status = 'confirmed' AND b.date_check_in = $1::date         THEN 'check_in_today'
        WHEN b.status = 'request'                                          THEN 'request_awaiting'
        ELSE 'upcoming'
      END AS urgency
    FROM bookings b
    JOIN properties p ON p.id = b.property_id
    LEFT JOIN users u ON u.id = b.user_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(SUM(amount_cents), 0)::int AS amount
      FROM booking_payments
      WHERE booking_id = b.id AND status = 'succeeded'
    ) paid
    WHERE
      b.status IN ('request','confirmed','checked_in')
      AND (b.agreed_property_cents + b.agreed_cleaning_cents) > paid.amount
    ORDER BY
      CASE
        WHEN b.status = 'checked_in'                                THEN 0
        WHEN b.status = 'confirmed' AND b.date_check_in < $1::date  THEN 0
        WHEN b.status = 'confirmed' AND b.date_check_in = $1::date  THEN 1
        WHEN b.status = 'request'                                   THEN 2
        ELSE 3
      END ASC,
      b.date_check_in ASC,
      b.id ASC
    `,
    [today],
  );
}

// ─── Upcoming balance due ───────────────────────────────────────────────────

/** Split-policy bookings whose balance window opens in the next `daysAhead`
 *  days. Filters out non-confirmed states and any booking that's already
 *  fully paid (so the section is actionable, not noise). */
export type UpcomingBalanceRow = {
  booking_id: string;
  property_slug: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  date_check_in: string;
  date_check_out: string;
  agreed_total_cents: number;
  paid_cents: number;
  owed_cents: number;
  /** YYYY-MM-DD — derived from check-in − payment_policy.balance_days_before. */
  balance_due_date: string;
  /** Days from today to balance_due_date (negative if past due). */
  days_until_due: number;
  payment_policy: PaymentPolicy;
};

export async function getUpcomingBalanceDue(daysAhead = 30): Promise<UpcomingBalanceRow[]> {
  const today = todayYmd();
  const horizon = addDaysYmd(today, daysAhead);
  return sql<UpcomingBalanceRow>(
    `
    SELECT
      b.id::text                                                  AS booking_id,
      p.slug                                                      AS property_slug,
      b.user_id::text                                             AS user_id,
      u.name                                                      AS user_name,
      u.email                                                     AS user_email,
      b.date_check_in::text                                       AS date_check_in,
      b.date_check_out::text                                      AS date_check_out,
      (b.agreed_property_cents + b.agreed_cleaning_cents)::int    AS agreed_total_cents,
      paid.amount::int                                            AS paid_cents,
      ((b.agreed_property_cents + b.agreed_cleaning_cents) - paid.amount)::int AS owed_cents,
      (b.date_check_in - ((b.payment_policy->>'balance_days_before')::int))::text AS balance_due_date,
      (b.date_check_in - ((b.payment_policy->>'balance_days_before')::int) - $1::date) AS days_until_due,
      b.payment_policy                                            AS payment_policy
    FROM bookings b
    JOIN properties p ON p.id = b.property_id
    LEFT JOIN users u ON u.id = b.user_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(SUM(amount_cents), 0)::int AS amount
      FROM booking_payments
      WHERE booking_id = b.id AND status = 'succeeded'
    ) paid
    WHERE
      b.status IN ('confirmed','checked_in')
      AND (b.payment_policy->>'deposit_pct')::int BETWEEN 1 AND 99   -- only split policies have a balance
      AND (b.payment_policy->>'balance_days_before')::int > 0
      AND (b.agreed_property_cents + b.agreed_cleaning_cents) > paid.amount
      AND (b.date_check_in - ((b.payment_policy->>'balance_days_before')::int)) <= $2::date
    ORDER BY balance_due_date ASC, b.id ASC
    `,
    [today, horizon],
  );
}

// ─── Recent succeeded payments ──────────────────────────────────────────────

export type RecentPaymentRow = {
  payment_id: string;
  booking_id: string;
  property_slug: string;
  user_name: string | null;
  type: string;
  method: string;
  amount_cents: number;
  paid_at: string;
};

export async function getRecentPayments(limit = 20, days = 30): Promise<RecentPaymentRow[]> {
  return sql<RecentPaymentRow>(
    `
    SELECT
      bp.id::text                                                  AS payment_id,
      bp.booking_id::text                                          AS booking_id,
      p.slug                                                       AS property_slug,
      u.name                                                       AS user_name,
      bp.type::text                                                AS type,
      bp.method::text                                              AS method,
      bp.amount_cents::int                                         AS amount_cents,
      bp.paid_at::text                                             AS paid_at
    FROM booking_payments bp
    JOIN bookings b ON b.id = bp.booking_id
    JOIN properties p ON p.id = b.property_id
    LEFT JOIN users u ON u.id = b.user_id
    WHERE bp.status = 'succeeded'
      AND bp.paid_at >= now() - ($1 || ' days')::interval
    ORDER BY bp.paid_at DESC, bp.id DESC
    LIMIT $2
    `,
    [String(days), limit],
  );
}

// ─── Stale pending Stripe sessions ──────────────────────────────────────────
//
// Stripe Checkout writes a `booking_payments` row in 'pending' state when
// the session is created. The webhook flips it to 'succeeded' on payment.
// If a row sits in 'pending' for more than an hour, it almost always means
// the guest abandoned Checkout — useful to surface so admin can clean up
// (or notice that the webhook isn't firing). See docs/stripe.md.

export type StalePendingRow = {
  payment_id: string;
  booking_id: string;
  property_slug: string;
  user_name: string | null;
  user_email: string | null;
  amount_cents: number;
  created_at: string;
  age_minutes: number;
  stripe_session_id: string | null;
};

export async function getStalePendingSessions(olderThanMinutes = 60): Promise<StalePendingRow[]> {
  return sql<StalePendingRow>(
    `
    SELECT
      bp.id::text                                                  AS payment_id,
      bp.booking_id::text                                          AS booking_id,
      p.slug                                                       AS property_slug,
      u.name                                                       AS user_name,
      u.email                                                      AS user_email,
      bp.amount_cents::int                                         AS amount_cents,
      bp.paid_at::text                                             AS created_at,
      (EXTRACT(EPOCH FROM (now() - bp.paid_at)) / 60)::int         AS age_minutes,
      bp.stripe_session_id                                         AS stripe_session_id
    FROM booking_payments bp
    JOIN bookings b ON b.id = bp.booking_id
    JOIN properties p ON p.id = b.property_id
    LEFT JOIN users u ON u.id = b.user_id
    WHERE bp.status = 'pending'
      AND bp.method = 'stripe'
      AND bp.paid_at < now() - ($1 || ' minutes')::interval
    ORDER BY bp.paid_at ASC, bp.id ASC
    `,
    [String(olderThanMinutes)],
  );
}

// ─── Convenience: load everything for /admin/payments in one go ─────────────

export type PaymentsHqData = {
  outstanding: OutstandingRow[];
  upcomingBalance: UpcomingBalanceRow[];
  recent: RecentPaymentRow[];
  stalePending: StalePendingRow[];
};

export async function getPaymentsHqData(): Promise<PaymentsHqData> {
  const [outstanding, upcomingBalance, recent, stalePending] = await Promise.all([
    getOutstanding(),
    getUpcomingBalanceDue(),
    getRecentPayments(),
    getStalePendingSessions(),
  ]);
  return { outstanding, upcomingBalance, recent, stalePending };
}
