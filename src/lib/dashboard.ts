import 'server-only';
import { sql } from '@db/client';
import type { BookingStatus } from '@db/enums';
import { PROPERTY_SLUGS, type PropertySlug } from './colors';

// ============================================================================
// Server-side aggregation queries that power the /admin dashboard charts and
// triage panels. Everything is one round-trip per function. Pure SQL, no
// post-processing logic in JS that the DB can't do.
// ============================================================================

// ----------------------------------------------------------------------------
// revenueByMonth — last N months, net revenue per property per month.
// Pivoted in JS into rows of `{ month, levante, estrecho, marea, cala }` so
// recharts can render the stacked bar chart with one stack per property.
// ----------------------------------------------------------------------------

export type RevenueByMonthRow = {
  /** YYYY-MM-DD — first day of the month. */
  month: string;
  /** Short label for the X axis: "May" / "Jun" etc. */
  label: string;
} & Record<PropertySlug, number>;

export async function revenueByMonth({ months = 12 }: { months?: number } = {}): Promise<RevenueByMonthRow[]> {
  // Pull (month, slug, net cents) with payments and refunds netted, then pivot.
  // generate_series gives us a row even if a (month, slug) had no activity.
  const rows = await sql<{ month: string; slug: string; net_cents: number }>(
    `
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', CURRENT_DATE) - make_interval(months => $1::int - 1),
        date_trunc('month', CURRENT_DATE),
        interval '1 month'
      )::date AS m
    ),
    props AS (
      SELECT id, slug FROM properties
    ),
    payments_by_month AS (
      SELECT
        date_trunc('month', bp.paid_at)::date AS m,
        b.property_id                          AS property_id,
        SUM(bp.amount_cents)::int              AS paid_cents
      FROM booking_payments bp
      JOIN bookings b ON b.id = bp.booking_id
      WHERE bp.status = 'succeeded'
      GROUP BY 1, 2
    ),
    refunds_by_month AS (
      SELECT
        date_trunc('month', pr.created_at)::date AS m,
        b.property_id                              AS property_id,
        SUM(pr.amount_cents)::int                  AS refunded_cents
      FROM payment_refunds pr
      JOIN booking_payments bp ON bp.id = pr.payment_id
      JOIN bookings b           ON b.id = bp.booking_id
      GROUP BY 1, 2
    )
    SELECT
      months.m::text                                                AS month,
      props.slug                                                    AS slug,
      COALESCE(pbm.paid_cents, 0) - COALESCE(rbm.refunded_cents, 0) AS net_cents
    FROM months
    CROSS JOIN props
    LEFT JOIN payments_by_month pbm ON pbm.m = months.m AND pbm.property_id = props.id
    LEFT JOIN refunds_by_month  rbm ON rbm.m = months.m AND rbm.property_id = props.id
    ORDER BY months.m ASC, props.slug ASC
    `,
    [months],
  );

  // Pivot rows into one record per month
  const byMonth = new Map<string, RevenueByMonthRow>();
  for (const r of rows) {
    let entry = byMonth.get(r.month);
    if (!entry) {
      entry = {
        month: r.month,
        label: monthLabel(r.month),
        levante: 0, estrecho: 0, marea: 0, cala: 0,
      };
      byMonth.set(r.month, entry);
    }
    if ((PROPERTY_SLUGS as readonly string[]).includes(r.slug)) {
      entry[r.slug as PropertySlug] = r.net_cents;
    }
  }
  return Array.from(byMonth.values());
}

function monthLabel(ymd: string): string {
  const [y, m] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
}

// ----------------------------------------------------------------------------
// pendingRequests — bookings sitting in 'request' or 'invite' awaiting the
// host's confirmation. Powers the Pipeline panel on /admin.
// ----------------------------------------------------------------------------

export type TriageBooking = {
  id: string;
  status: BookingStatus;
  date_check_in: string;
  date_check_out: string;
  user_name: string | null;
  user_email: string | null;
  property_slug: string;
  agreed_total_cents: number;
  paid_cents: number;
};

export async function pendingRequests(limit = 10): Promise<TriageBooking[]> {
  return sql<TriageBooking>(
    `
    SELECT
      b.id::text                                                     AS id,
      b.status::text                                                 AS status,
      b.date_check_in::text                                          AS date_check_in,
      b.date_check_out::text                                         AS date_check_out,
      u.name                                                         AS user_name,
      u.email                                                        AS user_email,
      p.slug                                                         AS property_slug,
      (b.agreed_property_cents + b.agreed_cleaning_cents)::int       AS agreed_total_cents,
      COALESCE((
        SELECT SUM(bp.amount_cents)::int FROM booking_payments bp WHERE bp.booking_id = b.id
      ), 0)                                                          AS paid_cents
    FROM bookings b
    JOIN properties p ON p.id = b.property_id
    LEFT JOIN users u ON u.id = b.user_id
    WHERE b.status IN ('request', 'invite')
    ORDER BY b.date_check_in ASC
    LIMIT $1
    `,
    [limit],
  );
}

// ----------------------------------------------------------------------------
// topGuests — top N users by lifetime spend (net of refunds).
// ----------------------------------------------------------------------------

export type TopGuestRow = {
  id: string;
  name: string;
  email: string;
  total_bookings: number;
  lifetime_spend_cents: number;
};

export async function topGuests(limit = 5): Promise<TopGuestRow[]> {
  return sql<TopGuestRow>(
    `
    SELECT
      u.id::text                              AS id,
      u.name                                  AS name,
      u.email                                 AS email,
      COUNT(DISTINCT b.id)::int               AS total_bookings,
      COALESCE(
        SUM(bp.amount_cents) - COALESCE((
          SELECT SUM(pr.amount_cents)
          FROM payment_refunds pr
          WHERE pr.payment_id IN (
            SELECT id FROM booking_payments WHERE booking_id IN (
              SELECT id FROM bookings WHERE user_id = u.id
            )
          )
        ), 0),
        0
      )::int                                  AS lifetime_spend_cents
    FROM users u
    LEFT JOIN bookings b ON b.user_id = u.id
    LEFT JOIN booking_payments bp ON bp.booking_id = b.id
    GROUP BY u.id
    HAVING COUNT(DISTINCT b.id) > 0
    ORDER BY lifetime_spend_cents DESC, total_bookings DESC
    LIMIT $1
    `,
    [limit],
  );
}

// ----------------------------------------------------------------------------
// moneyHeadline — the numbers that headline /admin.
//   total_bookings        : count of all bookings ever
//   collected_cents       : succeeded payments – refunds (real money in the bank)
//   david_earned_cents    : SUM agreed_property_cents on held bookings (host)
//   tano_earned_cents     : SUM agreed_cleaning_cents on held bookings (cleaner)
//   outstanding_cents     : agreed total of held bookings minus what's collected
//   pending_cash_cents    : SUM amount_cents where method='cash' AND status='pending'
//                           (money the host is owed in person at check-in)
// ----------------------------------------------------------------------------

export type MoneyHeadline = {
  total_bookings: number;
  collected_cents: number;
  david_earned_cents: number;
  tano_earned_cents: number;
  outstanding_cents: number;
  pending_cash_cents: number;
};

export async function moneyHeadline(): Promise<MoneyHeadline> {
  const rows = await sql<MoneyHeadline>(`
    WITH held AS (
      SELECT b.agreed_property_cents, b.agreed_cleaning_cents
      FROM bookings b
      WHERE b.status IN ('confirmed','checked_in','checked_out')
    ),
    money AS (
      SELECT
        COALESCE(SUM(agreed_property_cents)::bigint, 0)         AS david_earned_cents,
        COALESCE(SUM(agreed_cleaning_cents)::bigint, 0)         AS tano_earned_cents,
        COALESCE(SUM(agreed_property_cents + agreed_cleaning_cents)::bigint, 0) AS held_total_cents
      FROM held
    ),
    pay AS (
      SELECT COALESCE(SUM(amount_cents)::bigint, 0) AS paid_cents
      FROM booking_payments
      WHERE status = 'succeeded'
    ),
    refunds AS (
      SELECT COALESCE(SUM(amount_cents)::bigint, 0) AS refunded_cents FROM payment_refunds
    ),
    cash_pending AS (
      SELECT COALESCE(SUM(amount_cents)::bigint, 0) AS pending_cash_cents
      FROM booking_payments
      WHERE method = 'cash' AND status = 'pending'
    )
    SELECT
      (SELECT COUNT(*)::int FROM bookings)                            AS total_bookings,
      ((SELECT paid_cents FROM pay) - (SELECT refunded_cents FROM refunds))::int AS collected_cents,
      money.david_earned_cents::int                                   AS david_earned_cents,
      money.tano_earned_cents::int                                    AS tano_earned_cents,
      GREATEST(0, money.held_total_cents - ((SELECT paid_cents FROM pay) - (SELECT refunded_cents FROM refunds)))::int AS outstanding_cents,
      (SELECT pending_cash_cents FROM cash_pending)::int              AS pending_cash_cents
    FROM money
  `);
  return rows[0] ?? {
    total_bookings: 0, collected_cents: 0, david_earned_cents: 0, tano_earned_cents: 0,
    outstanding_cents: 0, pending_cash_cents: 0,
  };
}

// ----------------------------------------------------------------------------
// getEstateOverview — estate-wide summary at the top of /admin/calendar.
//
// Scope: UPCOMING bookings only (`date_check_out > CURRENT_DATE`) — the same
// forward-looking lens as the calendar grid. This is "money still to be made"
// + "bookings still in motion", not historical totals.
//
// Bookings card — 3-segment split (cancelled IS counted here):
//   confirmed   = status IN (confirmed, checked_in, checked_out)  — locked in
//   unconfirmed = status IN (request, invite)                     — needs action
//   cancelled   = status = cancelled                              — fell through
//
// Payments card — over UPCOMING HELD bookings only (status IN confirmed/
// checked_in/checked_out). Request and invite don't represent real revenue
// commitments yet, so they're excluded from every money figure here:
//   paid     = SUM(succeeded payments)   (money already collected)
//   unpaid   = total − paid (per-booking, clamped at 0)
//   cleaning = SUM(agreed_cleaning_cents) — the slice of held revenue
//              going to the cleaner, shown as a separate metric (not a
//              partition of the bar; cleaning overlaps with paid + unpaid).
// ----------------------------------------------------------------------------

export type EstateOverview = {
  total_bookings: number;        // all upcoming including cancelled
  confirmed_count: number;       // status IN (confirmed, checked_in, checked_out)
  unconfirmed_count: number;     // status IN (request, invite)
  cancelled_count: number;       // status = cancelled
  total_cents: number;           // SUM(agreed_total) across upcoming HELD only
  paid_cents: number;            // SUM(succeeded payments) on held bookings
  unpaid_cents: number;          // SUM(GREATEST(agreed_total − paid, 0)) per booking
  cleaning_cents: number;        // SUM(agreed_cleaning_cents) — slice of total
};

export async function getEstateOverview(): Promise<EstateOverview> {
  const rows = await sql<EstateOverview>(`
    WITH upcoming AS (
      SELECT id, agreed_property_cents, agreed_cleaning_cents, status
      FROM bookings
      WHERE date_check_out > CURRENT_DATE
    ),
    paid_per AS (
      SELECT u.id, COALESCE(SUM(bp.amount_cents)::int, 0) AS gross
      FROM upcoming u
      LEFT JOIN booking_payments bp
        ON bp.booking_id = u.id AND bp.status = 'succeeded'
      WHERE u.status IN ('confirmed','checked_in','checked_out')
      GROUP BY u.id
    )
    SELECT
      COUNT(u.*)::int                                                          AS total_bookings,
      (COUNT(*) FILTER (WHERE u.status IN ('confirmed','checked_in','checked_out')))::int AS confirmed_count,
      (COUNT(*) FILTER (WHERE u.status IN ('request','invite')))::int          AS unconfirmed_count,
      (COUNT(*) FILTER (WHERE u.status = 'cancelled'))::int                    AS cancelled_count,
      COALESCE(SUM(u.agreed_property_cents + u.agreed_cleaning_cents)
        FILTER (WHERE u.status IN ('confirmed','checked_in','checked_out')), 0)::int                        AS total_cents,
      COALESCE(SUM(p.gross)::int, 0)                                           AS paid_cents,
      COALESCE(SUM(GREATEST(
        (u.agreed_property_cents + u.agreed_cleaning_cents) - COALESCE(p.gross, 0), 0
      )) FILTER (WHERE u.status IN ('confirmed','checked_in','checked_out')), 0)::int                       AS unpaid_cents,
      COALESCE(SUM(u.agreed_cleaning_cents)
        FILTER (WHERE u.status IN ('confirmed','checked_in','checked_out')), 0)::int                        AS cleaning_cents
    FROM upcoming u
    LEFT JOIN paid_per p ON p.id = u.id
  `);
  return rows[0] ?? {
    total_bookings: 0,
    confirmed_count: 0, unconfirmed_count: 0, cancelled_count: 0,
    total_cents: 0, paid_cents: 0, unpaid_cents: 0, cleaning_cents: 0,
  };
}

// ----------------------------------------------------------------------------
// perPropertyMoney — money split per property (held bookings only).
// ----------------------------------------------------------------------------

export type PerPropertyMoneyRow = {
  slug: PropertySlug;
  bookings: number;
  david_cents: number;
  tano_cents: number;
  total_cents: number;
};

export async function perPropertyMoney(): Promise<PerPropertyMoneyRow[]> {
  return sql<PerPropertyMoneyRow>(`
    SELECT
      p.slug                                                              AS slug,
      COALESCE((
        SELECT COUNT(*)::int FROM bookings b
        WHERE b.property_id = p.id
          AND b.status IN ('confirmed','checked_in','checked_out')
      ), 0)                                                               AS bookings,
      COALESCE((
        SELECT SUM(b.agreed_property_cents)::bigint FROM bookings b
        WHERE b.property_id = p.id
          AND b.status IN ('confirmed','checked_in','checked_out')
      ), 0)::int                                                          AS david_cents,
      COALESCE((
        SELECT SUM(b.agreed_cleaning_cents)::bigint FROM bookings b
        WHERE b.property_id = p.id
          AND b.status IN ('confirmed','checked_in','checked_out')
      ), 0)::int                                                          AS tano_cents,
      COALESCE((
        SELECT SUM(b.agreed_property_cents + b.agreed_cleaning_cents)::bigint FROM bookings b
        WHERE b.property_id = p.id
          AND b.status IN ('confirmed','checked_in','checked_out')
      ), 0)::int                                                          AS total_cents
    FROM properties p
    ORDER BY p.id
  `);
}

// ----------------------------------------------------------------------------
// funnelStats — request → confirmed pipeline.
//   pending_now        : current count of status='request' OR 'invite'
//   confirmed_30d      : bookings that reached 'confirmed' in the last 30 days
//                        (proxy: confirmed bookings created in the last 30d)
//   total_pending_30d  : new request/invite created in last 30d (the inflow)
//   conversion_pct     : confirmed_30d / total_pending_30d
// ----------------------------------------------------------------------------

export type FunnelStats = {
  pending_now: number;
  inflow_30d: number;
  confirmed_30d: number;
  conversion_pct: number;
};

export async function funnelStats(): Promise<FunnelStats> {
  const rows = await sql<{
    pending_now: number;
    inflow_30d: number;
    confirmed_30d: number;
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM bookings WHERE status IN ('request','invite')) AS pending_now,
      (SELECT COUNT(*)::int FROM bookings
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')                  AS inflow_30d,
      (SELECT COUNT(*)::int FROM bookings
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND status IN ('confirmed','checked_in','checked_out'))               AS confirmed_30d
  `);
  const r = rows[0] ?? { pending_now: 0, inflow_30d: 0, confirmed_30d: 0 };
  const conversion_pct = r.inflow_30d === 0 ? 0 : Math.round((r.confirmed_30d / r.inflow_30d) * 100);
  return { ...r, conversion_pct };
}

