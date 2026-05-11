import 'server-only';
import { sql } from '@db/client';
import type { BookingAlertKind } from './bookingState';
import { todayYmd } from './dates';

// ============================================================================
// Admin notifications — server fetch.
//
// Single SQL pass over the bookings whose state matches one of the four
// alert kinds defined in `docs/admin-notifications.md`. The kind itself is
// derived in SQL (CASE expression) so the JS layer doesn't have to re-run
// `bookingAlerts` — but the rules are the same as in
// `src/lib/bookingState.ts`. If the doc changes, update both.
//
// One row in the result = one alert. The shape carries denormalized
// metadata (property slug, guest name, amounts) so AlertRow can render
// without follow-up queries.
// ============================================================================

export type AdminAlert = {
  kind: BookingAlertKind;
  booking_id: string;
  property_slug: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  date_check_in: string;
  date_check_out: string;
  agreed_total_cents: number;
  paid_cents: number;
};

export async function getAdminAlerts(): Promise<AdminAlert[]> {
  const today = todayYmd();
  // LATERAL gives us the per-booking succeeded-payments sum once, then we
  // reuse it for both the WHERE filter on `checked_in_unpaid` and the
  // SELECT projection. Sort: urgent kinds (`checked_in_unpaid`,
  // `overdue_checkin`) first, then by check-in date ASC so the bell reads
  // top-down "what's most on fire".
  return sql<AdminAlert>(
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
      paid.amount                                                 AS paid_cents,
      CASE
        WHEN b.status = 'request'                                              THEN 'request_awaiting'
        WHEN b.status = 'confirmed'  AND b.date_check_in = $1::date            THEN 'check_in_today'
        WHEN b.status = 'confirmed'  AND b.date_check_in < $1::date            THEN 'overdue_checkin'
        WHEN b.status = 'checked_in'                                           THEN 'checked_in_unpaid'
      END AS kind
    FROM bookings b
    JOIN properties p           ON p.id = b.property_id
    LEFT JOIN users u           ON u.id = b.user_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(SUM(amount_cents), 0)::int AS amount
      FROM booking_payments
      WHERE booking_id = b.id AND status = 'succeeded'
    ) paid
    WHERE
      b.status = 'request'
      OR (b.status = 'confirmed'  AND b.date_check_in <= $1::date)
      OR (b.status = 'checked_in' AND (b.agreed_property_cents + b.agreed_cleaning_cents) > paid.amount)
    ORDER BY
      CASE
        WHEN b.status = 'checked_in'                                THEN 0
        WHEN b.status = 'confirmed' AND b.date_check_in < $1::date  THEN 0
        ELSE 1
      END ASC,
      b.date_check_in ASC,
      b.id ASC
    `,
    [today],
  );
}
