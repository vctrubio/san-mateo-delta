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
