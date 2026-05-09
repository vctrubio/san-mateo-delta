import 'server-only';
import { sql } from '@db/client';
import type { Month } from '@db/enums';

// All twelve months must be present in properties.rates. The CHECK
// constraint enforces this in SQL; the helpers below assume it holds and
// return the typed shape unconditionally.
export type RatesByMonth = Record<Month, number>;

export type Property = {
  id: string;
  slug: string;
  title: string;
  description: string;
  features: string[];
  bedrooms: number;
  bathrooms: number;
  m2: number;
  max_guests: number;
  /** Default cleaning fee for new bookings on this property. Goes to Tano. */
  cleaning_fee_cents: number;
  /**
   * Per-night rate for each calendar month, in EUR cents. Keys '1'..'12'.
   * computeQuote multiplies `rates[checkInMonth]` by nights — no min-nights,
   * no active/public flag, no separate rate rows. See docs/rates.md.
   */
  rates: RatesByMonth;
};

export type PropertyDetails = {
  property: Property;
};

export type PropertyStats = {
  property_id: string;
  slug: string;
  total_bookings: number;
  upcoming_arrivals: number;
  in_house_now: number;
  status_counts: Record<string, number>;
  gross_collected_cents: number;
  cleaning_total_cents: number;
};

// ============================================================================
// FuturePropertyData — operational snapshot per property used by the admin
// calendar view's right-rail card. See docs/availability.md for the rule that
// defines each bucket and the "today is occupied" check.
// ============================================================================

export type FuturePropertyData = {
  property_id: string;
  slug: string;
  // --- Today's stay (held booking covering today, if any) ---
  today_occupied: boolean;
  today_status: string | null;
  today_guest_name: string | null;
  today_check_out: string | null;       // YYYY-MM-DD
  today_agreed_cents: number | null;    // agreed_total for that booking
  today_paid_cents: number | null;      // SUM(succeeded payments) for that booking
  /**
   * Status of ANY non-cancelled booking covering today, picked by priority
   * (held > invite > request). Used by the strip header dot:
   * yellow (request) / purple (invite) / blue (held) / grey (no booking).
   * Distinct from `today_status` which only fires for held bookings — soft
   * bookings don't count as "occupied" but should still surface on the dot.
   */
  today_indicator_status: string | null;
  // --- Upcoming counts ---
  pending_count: number;
  confirmed_count: number;
  // --- Outstanding payments (confirmed-only) ---
  outstanding_cents: number;
  outstanding_count: number;
  // --- Next confirmed arrival (skips today's stay if occupied) ---
  next_check_in: string | null;
  next_check_in_guest: string | null;
};

export async function listFuturePropertyData(): Promise<FuturePropertyData[]> {
  // One pass per property — small (4 rows) so the repeated "find today's held
  // booking" subqueries (today_status, today_guest_name, today_check_out,
  // today_agreed_cents, today_paid_cents) are fine. Correctness is guaranteed
  // by the `no_overlap_when_held` exclusion constraint in db/schema.sql:
  // at most one held booking can cover any given date per property, so all
  // those subqueries select the same row deterministically.
  const rows = await sql<FuturePropertyData>(`
    WITH paid AS (
      SELECT booking_id, SUM(amount_cents)::int AS amount
      FROM booking_payments
      GROUP BY booking_id
    )
    SELECT
      p.id::text AS property_id,
      p.slug     AS slug,

      -- Today occupancy: any held booking whose [check_in, check_out) covers today.
      EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.property_id = p.id
          AND b.status IN ('confirmed','checked_in','checked_out')
          AND b.date_check_in  <= CURRENT_DATE
          AND b.date_check_out >  CURRENT_DATE
      ) AS today_occupied,
      (SELECT b.status::text FROM bookings b
        WHERE b.property_id = p.id
          AND b.status IN ('confirmed','checked_in','checked_out')
          AND b.date_check_in <= CURRENT_DATE
          AND b.date_check_out > CURRENT_DATE
        ORDER BY b.date_check_in DESC LIMIT 1) AS today_status,
      (SELECT u.name FROM bookings b LEFT JOIN users u ON u.id = b.user_id
        WHERE b.property_id = p.id
          AND b.status IN ('confirmed','checked_in','checked_out')
          AND b.date_check_in <= CURRENT_DATE
          AND b.date_check_out > CURRENT_DATE
        ORDER BY b.date_check_in DESC LIMIT 1) AS today_guest_name,
      (SELECT b.date_check_out::text FROM bookings b
        WHERE b.property_id = p.id
          AND b.status IN ('confirmed','checked_in','checked_out')
          AND b.date_check_in <= CURRENT_DATE
          AND b.date_check_out > CURRENT_DATE
        ORDER BY b.date_check_in DESC LIMIT 1) AS today_check_out,
      (SELECT (b.agreed_property_cents + b.agreed_cleaning_cents)::int FROM bookings b
        WHERE b.property_id = p.id
          AND b.status IN ('confirmed','checked_in','checked_out')
          AND b.date_check_in <= CURRENT_DATE
          AND b.date_check_out > CURRENT_DATE
        ORDER BY b.date_check_in DESC LIMIT 1) AS today_agreed_cents,
      COALESCE((SELECT SUM(bp.amount_cents)::int FROM booking_payments bp
        WHERE bp.status = 'succeeded'
          AND bp.booking_id = (
            SELECT b.id FROM bookings b
            WHERE b.property_id = p.id
              AND b.status IN ('confirmed','checked_in','checked_out')
              AND b.date_check_in <= CURRENT_DATE
              AND b.date_check_out > CURRENT_DATE
            ORDER BY b.date_check_in DESC LIMIT 1
          )), 0) AS today_paid_cents,
      (SELECT b.status::text FROM bookings b
        WHERE b.property_id = p.id
          AND b.status != 'cancelled'
          AND b.date_check_in <= CURRENT_DATE
          AND b.date_check_out > CURRENT_DATE
        ORDER BY
          CASE b.status
            WHEN 'confirmed'   THEN 1
            WHEN 'checked_in'  THEN 1
            WHEN 'checked_out' THEN 1
            WHEN 'invite'      THEN 2
            WHEN 'request'     THEN 3
            ELSE 4
          END ASC,
          b.date_check_in DESC
        LIMIT 1) AS today_indicator_status,

      -- Pending: request/invite still in play.
      COALESCE((SELECT COUNT(*)::int FROM bookings b
        WHERE b.property_id = p.id
          AND b.status IN ('request','invite')
          AND b.date_check_out > CURRENT_DATE), 0) AS pending_count,

      -- Confirmed-upcoming: status='confirmed' and check-in still ahead.
      COALESCE((SELECT COUNT(*)::int FROM bookings b
        WHERE b.property_id = p.id
          AND b.status = 'confirmed'
          AND b.date_check_in >= CURRENT_DATE), 0) AS confirmed_count,

      -- Outstanding: confirmed-upcoming, sum of (agreed_total − paid) where any owed.
      COALESCE((SELECT SUM(
          (b.agreed_property_cents + b.agreed_cleaning_cents) - COALESCE(paid.amount, 0)
        )::int FROM bookings b
        LEFT JOIN paid ON paid.booking_id = b.id
        WHERE b.property_id = p.id
          AND b.status = 'confirmed'
          AND b.date_check_in >= CURRENT_DATE
          AND (b.agreed_property_cents + b.agreed_cleaning_cents) > COALESCE(paid.amount, 0)),
        0) AS outstanding_cents,
      COALESCE((SELECT COUNT(*)::int FROM bookings b
        LEFT JOIN paid ON paid.booking_id = b.id
        WHERE b.property_id = p.id
          AND b.status = 'confirmed'
          AND b.date_check_in >= CURRENT_DATE
          AND (b.agreed_property_cents + b.agreed_cleaning_cents) > COALESCE(paid.amount, 0)),
        0) AS outstanding_count,

      -- Next confirmed arrival, AFTER today's stay if today is occupied.
      -- (If today is free, falls back to >= today.)
      (SELECT b.date_check_in::text FROM bookings b
        WHERE b.property_id = p.id
          AND b.status = 'confirmed'
          AND b.date_check_in >= COALESCE(
            (SELECT b2.date_check_out FROM bookings b2
              WHERE b2.property_id = p.id
                AND b2.status IN ('confirmed','checked_in','checked_out')
                AND b2.date_check_in <= CURRENT_DATE
                AND b2.date_check_out > CURRENT_DATE
              ORDER BY b2.date_check_in DESC LIMIT 1),
            CURRENT_DATE
          )
        ORDER BY b.date_check_in ASC LIMIT 1) AS next_check_in,
      (SELECT u.name FROM bookings b LEFT JOIN users u ON u.id = b.user_id
        WHERE b.property_id = p.id
          AND b.status = 'confirmed'
          AND b.date_check_in >= COALESCE(
            (SELECT b2.date_check_out FROM bookings b2
              WHERE b2.property_id = p.id
                AND b2.status IN ('confirmed','checked_in','checked_out')
                AND b2.date_check_in <= CURRENT_DATE
                AND b2.date_check_out > CURRENT_DATE
              ORDER BY b2.date_check_in DESC LIMIT 1),
            CURRENT_DATE
          )
        ORDER BY b.date_check_in ASC LIMIT 1) AS next_check_in_guest

    FROM properties p
    ORDER BY p.id
  `);
  return rows;
}

export async function listPropertyStats(): Promise<PropertyStats[]> {
  // One row per property with aggregated stats. Subqueries are cheap because
  // the entire booking table is small (12 rows in seed).
  const rows = await sql<{
    property_id: string;
    slug: string;
    total_bookings: number;
    upcoming_arrivals: number;
    in_house_now: number;
    status_counts: Record<string, number>;
    gross_collected_cents: number;
    cleaning_total_cents: number;
  }>(`
    SELECT
      p.id::text AS property_id,
      p.slug     AS slug,
      (SELECT COUNT(*)::int FROM bookings b WHERE b.property_id = p.id) AS total_bookings,
      (SELECT COUNT(*)::int FROM bookings b
        WHERE b.property_id = p.id
          AND b.status IN ('confirmed','checked_in')
          AND b.date_check_in BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') AS upcoming_arrivals,
      (SELECT COUNT(*)::int FROM bookings b
        WHERE b.property_id = p.id AND b.status = 'checked_in') AS in_house_now,
      COALESCE((
        SELECT jsonb_object_agg(status, n) FROM (
          SELECT status::text AS status, COUNT(*)::int AS n
          FROM bookings WHERE property_id = p.id GROUP BY status
        ) sc
      ), '{}'::jsonb) AS status_counts,
      COALESCE((
        SELECT SUM(bp.amount_cents)::int
        FROM booking_payments bp
        JOIN bookings b ON b.id = bp.booking_id
        WHERE b.property_id = p.id
      ), 0) AS gross_collected_cents,
      COALESCE((
        SELECT SUM(b.agreed_cleaning_cents)::int
        FROM bookings b
        WHERE b.property_id = p.id
          AND b.status IN ('confirmed','checked_in','checked_out')
      ), 0) AS cleaning_total_cents
    FROM properties p
    ORDER BY p.id
  `);
  return rows;
}

const PROPERTY_SELECT = `
  id::text, slug, title, description, features,
  bedrooms, bathrooms, m2, max_guests,
  cleaning_fee_cents::int AS cleaning_fee_cents,
  rates
`;

export async function listProperties(): Promise<Property[]> {
  return sql<Property>(`SELECT ${PROPERTY_SELECT} FROM properties ORDER BY id`);
}

export async function getPropertyBySlug(slug: string): Promise<PropertyDetails | null> {
  const props = await sql<Property>(
    `SELECT ${PROPERTY_SELECT} FROM properties WHERE slug = $1`,
    [slug],
  );
  const property = props[0];
  if (!property) return null;
  return { property };
}
