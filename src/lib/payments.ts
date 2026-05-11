import 'server-only';
import { sql } from '@db/client';
import type { PaymentMethod, PaymentStatus, PaymentType } from '@db/enums';

// Lifetime cash / stripe split for a user — sums succeeded payments across
// every booking they've ever held. Used by the user detail page's PAYMENTS
// card so admin can see how the user has historically paid (cash on arrival
// vs Stripe). Pending and failed rows are excluded — the host doesn't have
// that money yet.
export async function paymentSplitForUser(
  userId: string,
): Promise<{ cash: number; stripe: number }> {
  const rows = await sql<{ method: string; paid: number }>(
    `
    SELECT bp.method::text       AS method,
           SUM(bp.amount_cents)::int AS paid
      FROM booking_payments bp
      JOIN bookings b ON b.id = bp.booking_id
     WHERE b.user_id = $1
       AND bp.status = 'succeeded'
     GROUP BY bp.method
    `,
    [userId],
  );
  const out = { cash: 0, stripe: 0 };
  for (const r of rows) {
    if (r.method === 'cash') out.cash = r.paid;
    else if (r.method === 'stripe') out.stripe = r.paid;
  }
  return out;
}

export async function listPaymentsForBooking(bookingId: string) {
  return sql<{
    id: string;
    type: PaymentType;
    amount_cents: number;
    method: PaymentMethod;
    status: PaymentStatus;
    stripe_payment_intent: string | null;
    paid_at: string;
    refunded_cents: number;
  }>(
    `
    SELECT
      bp.id::text              AS id,
      bp.type::text            AS type,
      bp.amount_cents::int     AS amount_cents,
      bp.method::text          AS method,
      bp.status::text          AS status,
      bp.stripe_payment_intent AS stripe_payment_intent,
      bp.paid_at::text         AS paid_at,
      COALESCE((
        SELECT SUM(pr.amount_cents)::int
        FROM payment_refunds pr
        WHERE pr.payment_id = bp.id
      ), 0)                    AS refunded_cents
    FROM booking_payments bp
    WHERE bp.booking_id = $1
    ORDER BY bp.paid_at ASC
    `,
    [bookingId],
  );
}

/**
 * Sum of *succeeded* payments minus refunds. Pending Stripe sessions and
 * failed payments don't count — they're not money in the account.
 */
export async function totalPaidForBooking(bookingId: string): Promise<number> {
  const rows = await sql<{ total: number }>(
    `SELECT
       COALESCE(SUM(bp.amount_cents) - COALESCE((
         SELECT SUM(pr.amount_cents) FROM payment_refunds pr WHERE pr.payment_id IN (
           SELECT id FROM booking_payments WHERE booking_id = $1 AND status = 'succeeded'
         )
       ), 0), 0)::int AS total
     FROM booking_payments bp
     WHERE bp.booking_id = $1 AND bp.status = 'succeeded'`,
    [bookingId],
  );
  return rows[0]?.total ?? 0;
}
