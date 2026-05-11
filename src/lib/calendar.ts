import 'server-only';
import { sql, type SqlParam } from '@db/client';
import type { BookingStatus } from '@db/enums';
import { BLOCKING_BOOKING_STATUSES } from './colors';

// ============================================================================
// Calendar items: the unified shape the <Calendar> component renders.
// One row per booking + one row per property_block. Pre-fetched server-side so
// the client component is dumb about data.
// ============================================================================

export type CalendarBooking = {
  kind: 'booking';
  id: string;
  status: BookingStatus;
  start: string; // YYYY-MM-DD (date_check_in)
  end:   string; // YYYY-MM-DD (date_check_out, exclusive)
  /** "Maria · Levante" — used in tooltips and the admin action panel. */
  label: string;
  /** Property slug (LEVANTE / ESTRECHO / MAREA / CALA). Used by modal headers. */
  property_slug: string;
  /** Detail link, e.g. /admin/bookings/42. Optional for public mode. */
  href?: string;
  /** Optional metadata surfaced in the admin action panel. */
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  agreed_property_cents: number;
  agreed_cleaning_cents: number;
  agreed_total_cents: number;
  paid_cents: number;
  guests: { adults: number; children: number; infants: number; pets: number };
};

export type CalendarBlock = {
  kind: 'block';
  id: string;
  start: string;
  end:   string;
  reason: string | null;
  /** Property slug — same role as on CalendarBooking. */
  property_slug: string;
};

export type CalendarItem = CalendarBooking | CalendarBlock;

export type CalendarMode = 'public' | 'admin';

// ----------------------------------------------------------------------------
// getCalendarItems
//
// Window: items with `start < toExclusive AND end > fromInclusive` overlap [from, to).
// Public mode returns only blocking-status bookings + blocks (the public can't
// see request/invite/cancelled because those don't reserve the property).
// Admin mode returns everything.
// ----------------------------------------------------------------------------

export async function getCalendarItems(args: {
  propertyId: string;
  /** Start of window (inclusive) — YYYY-MM-DD. */
  from: string;
  /** End of window (exclusive) — YYYY-MM-DD. */
  to: string;
  mode: CalendarMode;
}): Promise<CalendarItem[]> {
  const statusFilter =
    args.mode === 'public'
      ? `AND b.status::text = ANY($4::text[])`
      : ``;
  const params: SqlParam[] = [args.propertyId, args.from, args.to];
  if (args.mode === 'public') {
    params.push([...BLOCKING_BOOKING_STATUSES]);
  }

  const bookings = await sql<{
    id: string;
    status: BookingStatus;
    start: string;
    end: string;
    user_id: string | null;
    user_name: string | null;
    user_email: string | null;
    agreed_property_cents: number;
    agreed_cleaning_cents: number;
    agreed_total_cents: number;
    paid_cents: number;
    guests: { adults: number; children: number; infants: number; pets: number };
    property_slug: string;
  }>(
    `
    SELECT
      b.id::text                            AS id,
      b.status::text                        AS status,
      b.date_check_in::text                 AS start,
      b.date_check_out::text                AS "end",
      b.user_id::text                       AS user_id,
      u.name                                AS user_name,
      u.email                               AS user_email,
      b.agreed_property_cents::int          AS agreed_property_cents,
      b.agreed_cleaning_cents::int          AS agreed_cleaning_cents,
      (b.agreed_property_cents + b.agreed_cleaning_cents)::int AS agreed_total_cents,
      COALESCE((
        SELECT SUM(bp.amount_cents)::int
        FROM booking_payments bp
        WHERE bp.booking_id = b.id
      ), 0)                                 AS paid_cents,
      b.guests                              AS guests,
      p.slug                                AS property_slug
    FROM bookings b
    JOIN properties p ON p.id = b.property_id
    LEFT JOIN users u ON u.id = b.user_id
    WHERE b.property_id = $1
      AND b.date_check_in  <  $3::date
      AND b.date_check_out >  $2::date
      ${statusFilter}
    ORDER BY b.date_check_in ASC
    `,
    params,
  );

  const blocks = await sql<{
    id: string;
    start: string;
    end: string;
    reason: string | null;
    property_slug: string;
  }>(
    `
    SELECT
      pb.id::text                AS id,
      pb.date_check_in::text     AS start,
      pb.date_check_out::text    AS "end",
      pb.reason                  AS reason,
      p.slug                     AS property_slug
    FROM property_blocks pb
    JOIN properties p ON p.id = pb.property_id
    WHERE pb.property_id = $1
      AND pb.date_check_in  <  $3::date
      AND pb.date_check_out >  $2::date
    ORDER BY pb.date_check_in ASC
    `,
    [args.propertyId, args.from, args.to],
  );

  const bookingItems: CalendarBooking[] = bookings.map((b) => ({
    kind: 'booking',
    id: b.id,
    status: b.status,
    start: b.start,
    end:   b.end,
    label: b.user_name ? `${b.user_name} · ${b.property_slug}` : `Admin booking · ${b.property_slug}`,
    property_slug: b.property_slug,
    href:  args.mode === 'admin' ? `/admin/bookings/${b.id}` : undefined,
    user_id: b.user_id,
    user_name: b.user_name,
    user_email: b.user_email,
    agreed_property_cents: b.agreed_property_cents,
    agreed_cleaning_cents: b.agreed_cleaning_cents,
    agreed_total_cents: b.agreed_total_cents,
    paid_cents: b.paid_cents,
    guests: b.guests,
  }));

  const blockItems: CalendarBlock[] = blocks.map((b) => ({
    kind: 'block',
    id: b.id,
    start: b.start,
    end:   b.end,
    reason: b.reason,
    property_slug: b.property_slug,
  }));

  return [...bookingItems, ...blockItems];
}

// ----------------------------------------------------------------------------
// Helpers used by both server and client. Defined here in lib (no DOM, no React)
// so the Calendar component can import them.
// ----------------------------------------------------------------------------

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return r;
}

/** Calendar windows from the first day of `start` through `monthCount` months ahead (exclusive end). */
export function windowFor(startMonth: Date, monthCount: number): { from: string; to: string } {
  const start = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
  const end = addMonths(start, monthCount);
  return { from: ymd(start), to: ymd(end) };
}
