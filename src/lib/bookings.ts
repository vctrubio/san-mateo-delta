import 'server-only';
import { sql } from '@db/client';
import type { BookingStatus, CancelledBy, Month } from '@db/enums';
import { HIGH_SEASON_MONTHS } from '@db/enums';

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
  COALESCE((
    SELECT SUM(bp.amount_cents)::int
    FROM booking_payments bp
    WHERE bp.booking_id = b.id
  ), 0)                                 AS paid_cents,
  COALESCE((
    SELECT SUM(pr.amount_cents)::int
    FROM payment_refunds pr
    JOIN booking_payments bp2 ON bp2.id = pr.payment_id
    WHERE bp2.booking_id = b.id
  ), 0)                                 AS refunded_cents
`;

export async function listBookings(): Promise<BookingRow[]> {
  return sql<BookingRow>(`
    SELECT ${BOOKING_SELECT}
    FROM bookings b
    JOIN properties p           ON p.id = b.property_id
    LEFT JOIN users u           ON u.id = b.user_id
    LEFT JOIN booking_cancellations bc ON bc.booking_id = b.id
    ORDER BY
      CASE b.status WHEN 'request' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'checked_in' THEN 2 ELSE 3 END,
      b.created_at DESC
  `);
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

export async function listRecentBookingEvents(limit = 10) {
  return sql<{
    id: string;
    booking_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    created_at: string;
    property_slug: string;
    user_name: string | null;
  }>(
    `
    SELECT
      e.id::text          AS id,
      e.booking_id::text  AS booking_id,
      e.event_type        AS event_type,
      e.payload           AS payload,
      e.created_at::text  AS created_at,
      p.slug              AS property_slug,
      u.name              AS user_name
    FROM booking_events e
    JOIN bookings b    ON b.id = e.booking_id
    JOIN properties p  ON p.id = b.property_id
    LEFT JOIN users u  ON u.id = b.user_id
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT $1
    `,
    [limit],
  );
}

// ---------------------------------------------------------------------------
// Pricing — implements the rate-selection algorithm from db/rates.md.
// Returns the chosen rate row + price components. The components are then
// snapshotted onto the booking row at request time (snapshots principle).

export type Quote = {
  rate_id: string;
  rate_name: string;
  night_rate_cents: number;
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
  isInvitation?: boolean;
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

  const rates = await sql<{
    id: string;
    name: string;
    min_nights: number;
    night_rate_cents: number;
  }>(
    `SELECT id::text, name, min_nights, night_rate_cents::int
     FROM property_rates
     WHERE property_id = $1
       AND active = TRUE
       AND $2 = ANY(months)
       AND $3 >= min_nights
       AND (public = TRUE OR $4)
     ORDER BY min_nights DESC, night_rate_cents ASC
     LIMIT 1`,
    [args.propertyId, monthIn, nights, args.isInvitation ?? false],
  );

  const rate = rates[0];
  if (!rate) {
    return { error: 'No rate matches these dates and stay length. Ask the host for a quote.' };
  }

  // Cleaning fee is now a column on properties (snapshot at quote time).
  const props = await sql<{ cleaning_fee_cents: number }>(
    `SELECT cleaning_fee_cents::int AS cleaning_fee_cents FROM properties WHERE id = $1`,
    [args.propertyId],
  );
  const agreed_cleaning_cents = props[0]?.cleaning_fee_cents ?? 0;
  const agreed_property_cents = nights * rate.night_rate_cents;

  return {
    rate_id: rate.id,
    rate_name: rate.name,
    night_rate_cents: rate.night_rate_cents,
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
