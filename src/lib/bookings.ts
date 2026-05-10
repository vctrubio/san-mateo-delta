import 'server-only';
import { sql } from '@db/client';
import type { BookingStatus, CancelledBy, Month } from '@db/enums';
import { HIGH_SEASON_MONTHS } from '@db/enums';
import type { Paginated } from './searchParams';

export type BookingRow = {
  id: string;
  access_token: string;
  property_id: string;
  property_slug: string;
  property_title: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  date_check_in: string;
  date_check_out: string;
  agreed_property_cents: number;
  agreed_cleaning_cents: number;
  /** Convenience: agreed_property_cents + agreed_cleaning_cents. */
  agreed_total_cents: number;
  status: BookingStatus;
  guests: { adults: number; children: number; infants: number; pets: number };
  time_check_in: string | null;
  time_check_out: string | null;
  /** Cancellation snapshot, joined from booking_cancellations if status='cancelled'. */
  cancelled_at: string | null;
  cancelled_by: CancelledBy | null;
  cancellation_reason: string | null;
  refund_amount_cents: number | null;
  policy_applied: string | null;
  created_at: string;
  paid_cents: number;
  refunded_cents: number;
};

export type BookingDetail = BookingRow & {
  property_max_guests: number;
  property_bedrooms: number;
  property_bathrooms: number;
  property_m2: number;
};

export type BookingEvent = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

const BOOKING_SELECT = `
  b.id::text                            AS id,
  b.access_token::text                  AS access_token,
  b.property_id::text                   AS property_id,
  p.slug                                AS property_slug,
  p.title                               AS property_title,
  b.user_id::text                       AS user_id,
  u.name                                AS user_name,
  u.email                               AS user_email,
  b.date_check_in::text                 AS date_check_in,
  b.date_check_out::text                AS date_check_out,
  b.agreed_property_cents::int          AS agreed_property_cents,
  b.agreed_cleaning_cents::int          AS agreed_cleaning_cents,
  (b.agreed_property_cents + b.agreed_cleaning_cents)::int AS agreed_total_cents,
  b.status::text                        AS status,
  b.guests                              AS guests,
  b.time_check_in::text                 AS time_check_in,
  b.time_check_out::text                AS time_check_out,
  bc.cancelled_at::text                 AS cancelled_at,
  bc.cancelled_by::text                 AS cancelled_by,
  bc.reason                             AS cancellation_reason,
  bc.refund_amount_cents::int           AS refund_amount_cents,
  bc.policy_applied                     AS policy_applied,
  b.created_at::text                    AS created_at,
  -- "Paid" = money actually collected. Pending cash promises and failed
  -- Stripe sessions do not count toward what is paid — they live in
  -- booking_payments but until they flip to succeeded the host does not
  -- have the money. Sums match totalPaidForBooking in lib/payments.ts.
  COALESCE((
    SELECT SUM(bp.amount_cents)::int
    FROM booking_payments bp
    WHERE bp.booking_id = b.id
      AND bp.status = 'succeeded'
  ), 0)                                 AS paid_cents,
  COALESCE((
    SELECT SUM(pr.amount_cents)::int
    FROM payment_refunds pr
    JOIN booking_payments bp2 ON bp2.id = pr.payment_id
    WHERE bp2.booking_id = b.id
  ), 0)                                 AS refunded_cents
`;

export type ListBookingsArgs = {
  status?: BookingStatus[];
  property?: string[];   // slugs
  /** YYYY-MM-DD; filters `date_check_in >= from`. */
  from?: string;
  /** YYYY-MM-DD; filters `date_check_in <= to`. */
  to?: string;
  /** ILIKE on user name + email. */
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listBookings(args: ListBookingsArgs = {}): Promise<Paginated<BookingRow>> {
  const where: string[] = [];
  const params: unknown[] = [];
  let p = 0;

  if (args.status && args.status.length > 0) {
    params.push(args.status);
    where.push(`b.status::text = ANY($${++p}::text[])`);
  }
  if (args.property && args.property.length > 0) {
    params.push(args.property);
    where.push(`p.slug = ANY($${++p}::text[])`);
  }
  if (args.from) {
    params.push(args.from);
    where.push(`b.date_check_in >= $${++p}::date`);
  }
  if (args.to) {
    params.push(args.to);
    where.push(`b.date_check_in <= $${++p}::date`);
  }
  if (args.search) {
    params.push(`%${args.search}%`);
    where.push(`(u.name ILIKE $${++p} OR u.email ILIKE $${p})`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // Default limit is high so the admin bookings page can split into
  // upcoming/history client-side without paging — there are typically a few
  // hundred rows even after years of bookings, well within one query.
  const limit = args.limit ?? 1000;
  const offset = args.offset ?? 0;
  params.push(limit);
  const limitParam = `$${++p}`;
  params.push(offset);
  const offsetParam = `$${++p}`;

  // COUNT(*) OVER () returns the unfiltered-by-LIMIT total alongside the page.
  // Sort by check-in date ascending so the page splits naturally into
  // upcoming (chronological) vs history (most recent past first; the page
  // reverses the history slice client-side).
  const rows = await sql<BookingRow & { _total: number }>(
    `
    SELECT ${BOOKING_SELECT},
      COUNT(*) OVER ()::int AS _total
    FROM bookings b
    JOIN properties p           ON p.id = b.property_id
    LEFT JOIN users u           ON u.id = b.user_id
    LEFT JOIN booking_cancellations bc ON bc.booking_id = b.id
    ${whereClause}
    ORDER BY b.date_check_in ASC, b.id ASC
    LIMIT ${limitParam} OFFSET ${offsetParam}
    `,
    params as never[],
  );

  const total = rows[0]?._total ?? 0;
  // Strip the synthetic _total column from the public type.
  const cleaned: BookingRow[] = rows.map(({ _total, ...rest }) => rest);
  return { rows: cleaned, total };
}

export async function listBookingsForUser(userId: string): Promise<BookingRow[]> {
  return sql<BookingRow>(
    `
    SELECT ${BOOKING_SELECT}
    FROM bookings b
    JOIN properties p           ON p.id = b.property_id
    LEFT JOIN users u           ON u.id = b.user_id
    LEFT JOIN booking_cancellations bc ON bc.booking_id = b.id
    WHERE b.user_id = $1
    ORDER BY b.date_check_in DESC
    `,
    [userId],
  );
}

// Bulk variant of listBookingsForUser. Returns a Map keyed by user_id so
// the /admin/users table can render each row's status chips inline without
// firing N queries. Filters to "live" bookings (anything not cancelled and
// not already checked out) so the chip strip shows what admin can act on.
export async function listLiveBookingsByUser(
  userIds: string[],
): Promise<Map<string, BookingRow[]>> {
  const out = new Map<string, BookingRow[]>();
  if (userIds.length === 0) return out;
  const rows = await sql<BookingRow>(
    `
    SELECT ${BOOKING_SELECT}
    FROM bookings b
    JOIN properties p           ON p.id = b.property_id
    LEFT JOIN users u           ON u.id = b.user_id
    LEFT JOIN booking_cancellations bc ON bc.booking_id = b.id
    WHERE b.user_id = ANY($1::bigint[])
      AND b.status NOT IN ('cancelled', 'checked_out')
    ORDER BY b.date_check_in ASC, b.id ASC
    `,
    [userIds],
  );
  for (const r of rows) {
    if (!r.user_id) continue;
    const list = out.get(r.user_id) ?? [];
    list.push(r);
    out.set(r.user_id, list);
  }
  return out;
}

export async function listBookingsForProperty(propertyId: string): Promise<BookingRow[]> {
  return sql<BookingRow>(
    `
    SELECT ${BOOKING_SELECT}
    FROM bookings b
    JOIN properties p           ON p.id = b.property_id
    LEFT JOIN users u           ON u.id = b.user_id
    LEFT JOIN booking_cancellations bc ON bc.booking_id = b.id
    WHERE b.property_id = $1
    ORDER BY b.date_check_in DESC
    `,
    [propertyId],
  );
}

export async function getBookingById(id: string): Promise<BookingDetail | null> {
  const rows = await sql<BookingDetail>(
    `
    SELECT
      ${BOOKING_SELECT},
      p.max_guests::int  AS property_max_guests,
      p.bedrooms::int    AS property_bedrooms,
      p.bathrooms::int   AS property_bathrooms,
      p.m2::int          AS property_m2
    FROM bookings b
    JOIN properties p           ON p.id = b.property_id
    LEFT JOIN users u           ON u.id = b.user_id
    LEFT JOIN booking_cancellations bc ON bc.booking_id = b.id
    WHERE b.id = $1
    `,
    [id],
  );
  return rows[0] ?? null;
}

export async function listBookingEvents(bookingId: string): Promise<BookingEvent[]> {
  return sql<BookingEvent>(
    `SELECT id::text, event_type, payload, created_at::text
     FROM booking_events
     WHERE booking_id = $1
     ORDER BY created_at ASC, id ASC`,
    [bookingId],
  );
}

// ---------------------------------------------------------------------------
// Pricing — one row in `properties.rates` JSONB carries the night rate for
// each calendar month. computeQuote picks `rates[<check-in month>]` and
// multiplies by nights. Cleaning fee comes from the same row. See docs/rates.md.
//
// No min-nights, no active/public flag, no separate rate rows. If admin
// wants a one-off custom price for friends, they use /admin/invite which
// snapshots a different price onto the booking — properties.rates is never
// edited per-booking.

export type Quote = {
  /** Convenience copy of the month's rate from properties.rates. */
  night_rate_cents: number;
  /** Calendar month (1-12) used for rate lookup — month of check-in. */
  rate_month: number;
  rate_month_label: string;
  nights: number;
  /** Goes to David. */
  agreed_property_cents: number;
  /** Goes to Tano. Sourced from properties.cleaning_fee_cents at quote time. */
  agreed_cleaning_cents: number;
  /** Convenience: agreed_property_cents + agreed_cleaning_cents. */
  agreed_total_cents: number;
};

export async function computeQuote(args: {
  propertyId: string;
  check_in: string;   // YYYY-MM-DD
  check_out: string;  // YYYY-MM-DD
}): Promise<Quote | { error: string }> {
  const nights =
    Math.round(
      (Date.parse(args.check_out) - Date.parse(args.check_in)) / (1000 * 60 * 60 * 24),
    );
  if (!Number.isFinite(nights) || nights <= 0) {
    return { error: 'check_out must be after check_in' };
  }
  const monthIn = (Number(args.check_in.slice(5, 7)) as Month);
  if (!monthIn || monthIn < 1 || monthIn > 12) {
    return { error: 'invalid check_in date' };
  }

  const props = await sql<{
    cleaning_fee_cents: number;
    rates: Record<string, number>;
  }>(
    `SELECT cleaning_fee_cents::int AS cleaning_fee_cents, rates
     FROM properties WHERE id = $1`,
    [args.propertyId],
  );
  const property = props[0];
  if (!property) return { error: `Unknown property: ${args.propertyId}` };

  const night_rate_cents = property.rates?.[String(monthIn)];
  if (typeof night_rate_cents !== 'number') {
    return { error: `No rate configured for month ${monthIn}.` };
  }

  const agreed_property_cents = nights * night_rate_cents;
  const agreed_cleaning_cents = property.cleaning_fee_cents ?? 0;

  return {
    night_rate_cents,
    rate_month: monthIn,
    rate_month_label: ['', 'January','February','March','April','May','June','July','August','September','October','November','December'][monthIn] ?? '',
    nights,
    agreed_property_cents,
    agreed_cleaning_cents,
    agreed_total_cents: agreed_property_cents + agreed_cleaning_cents,
  };
}

// Convenience for UI badges
export function isHighSeasonMonth(month: number) {
  return HIGH_SEASON_MONTHS.includes(month as Month);
}
