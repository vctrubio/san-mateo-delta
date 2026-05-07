import 'server-only';
import { sql } from '@db/client';
import type { PaymentType } from '@db/enums';

export type PaymentRow = {
  id: string;
  booking_id: string;
  type: PaymentType;
  amount_cents: number;
  cash: boolean;
  paid_at: string;
  property_slug: string;
  user_name: string | null;
  user_email: string | null;
  refunded_cents: number;
};

export async function listPayments(): Promise<PaymentRow[]> {
  return sql<PaymentRow>(`
    SELECT
      bp.id::text             AS id,
      bp.booking_id::text     AS booking_id,
      bp.type::text           AS type,
      bp.amount_cents::int    AS amount_cents,
      bp.cash                 AS cash,
      bp.paid_at::text        AS paid_at,
      p.slug                  AS property_slug,
      u.name                  AS user_name,
      u.email                 AS user_email,
      COALESCE((
        SELECT SUM(pr.amount_cents)::int
        FROM payment_refunds pr
        WHERE pr.payment_id = bp.id
      ), 0)                   AS refunded_cents
    FROM booking_payments bp
    JOIN bookings b    ON b.id = bp.booking_id
    JOIN properties p  ON p.id = b.property_id
    LEFT JOIN users u  ON u.id = b.user_id
    ORDER BY bp.paid_at DESC, bp.id DESC
  `);
}

export async function listPaymentsForBooking(bookingId: string) {
  return sql<{
    id: string;
    type: PaymentType;
    amount_cents: number;
    cash: boolean;
    paid_at: string;
    refunded_cents: number;
  }>(
    `
    SELECT
      bp.id::text          AS id,
      bp.type::text        AS type,
      bp.amount_cents::int AS amount_cents,
      bp.cash              AS cash,
      bp.paid_at::text     AS paid_at,
      COALESCE((
        SELECT SUM(pr.amount_cents)::int
        FROM payment_refunds pr
        WHERE pr.payment_id = bp.id
      ), 0)                AS refunded_cents
    FROM booking_payments bp
    WHERE bp.booking_id = $1
    ORDER BY bp.paid_at ASC
    `,
    [bookingId],
  );
}

export async function totalPaidForBooking(bookingId: string): Promise<number> {
  const rows = await sql<{ total: number }>(
    `SELECT
       COALESCE(SUM(bp.amount_cents) - COALESCE((
         SELECT SUM(pr.amount_cents) FROM payment_refunds pr WHERE pr.payment_id IN (SELECT id FROM booking_payments WHERE booking_id = $1)
       ), 0), 0)::int AS total
     FROM booking_payments bp
     WHERE bp.booking_id = $1`,
    [bookingId],
  );
  return rows[0]?.total ?? 0;
}
