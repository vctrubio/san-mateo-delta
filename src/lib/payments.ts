import 'server-only';
import { sql } from '@db/client';
import type { PaymentMethod, PaymentStatus, PaymentType } from '@db/enums';
import type { Paginated } from './searchParams';

export type PaymentRow = {
  id: string;
  booking_id: string;
  type: PaymentType;
  amount_cents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  stripe_payment_intent: string | null;
  paid_at: string;
  property_slug: string;
  user_name: string | null;
  user_email: string | null;
  refunded_cents: number;
};

export type ListPaymentsArgs = {
  type?: PaymentType[];
  property?: string[];
  method?: PaymentMethod[];
  status?: PaymentStatus[];
  refund_only?: boolean;
  /** YYYY-MM-DD on `paid_at`. */
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

const PAYMENT_SELECT = `
  bp.id::text                  AS id,
  bp.booking_id::text          AS booking_id,
  bp.type::text                AS type,
  bp.amount_cents::int         AS amount_cents,
  bp.method::text              AS method,
  bp.status::text              AS status,
  bp.stripe_payment_intent     AS stripe_payment_intent,
  bp.paid_at::text             AS paid_at,
  p.slug                       AS property_slug,
  u.name                       AS user_name,
  u.email                      AS user_email,
  COALESCE((
    SELECT SUM(pr.amount_cents)::int
    FROM payment_refunds pr
    WHERE pr.payment_id = bp.id
  ), 0)                        AS refunded_cents
`;

export async function listPayments(args: ListPaymentsArgs = {}): Promise<Paginated<PaymentRow>> {
  const where: string[] = [];
  const params: unknown[] = [];
  let p = 0;

  if (args.type && args.type.length > 0) {
    params.push(args.type);
    where.push(`bp.type::text = ANY($${++p}::text[])`);
  }
  if (args.property && args.property.length > 0) {
    params.push(args.property);
    where.push(`p.slug = ANY($${++p}::text[])`);
  }
  if (args.method && args.method.length > 0) {
    params.push(args.method);
    where.push(`bp.method::text = ANY($${++p}::text[])`);
  }
  if (args.status && args.status.length > 0) {
    params.push(args.status);
    where.push(`bp.status::text = ANY($${++p}::text[])`);
  }
  if (args.refund_only) {
    where.push(`EXISTS (SELECT 1 FROM payment_refunds pr WHERE pr.payment_id = bp.id)`);
  }
  if (args.from) {
    params.push(args.from);
    where.push(`bp.paid_at >= $${++p}::date`);
  }
  if (args.to) {
    params.push(args.to);
    where.push(`bp.paid_at <= $${++p}::date + INTERVAL '1 day'`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = args.limit ?? 25;
  const offset = args.offset ?? 0;
  params.push(limit);
  const limitParam = `$${++p}`;
  params.push(offset);
  const offsetParam = `$${++p}`;

  const rows = await sql<PaymentRow & { _total: number }>(
    `
    SELECT ${PAYMENT_SELECT},
      COUNT(*) OVER ()::int AS _total
    FROM booking_payments bp
    JOIN bookings b    ON b.id = bp.booking_id
    JOIN properties p  ON p.id = b.property_id
    LEFT JOIN users u  ON u.id = b.user_id
    ${whereClause}
    ORDER BY bp.paid_at DESC, bp.id DESC
    LIMIT ${limitParam} OFFSET ${offsetParam}
    `,
    params as never[],
  );

  const total = rows[0]?._total ?? 0;
  const cleaned: PaymentRow[] = rows.map(({ _total, ...rest }) => rest);
  return { rows: cleaned, total };
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
