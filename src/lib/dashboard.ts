import 'server-only';
import { sql } from '@db/client';

// ============================================================================
// Server-side aggregation queries for the /admin dashboard. One round-trip
// per function. Pure SQL, no JS post-processing.
// ============================================================================

// ----------------------------------------------------------------------------
// getEstateOverview — estate-wide summary at the top of /admin.
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
        FILTER (WHERE u.status IN ('confirmed','checked_in','checked_out')), 0)::int AS total_cents,
      COALESCE(SUM(p.gross)::int, 0)                                           AS paid_cents,
      COALESCE(SUM(GREATEST(
        (u.agreed_property_cents + u.agreed_cleaning_cents) - COALESCE(p.gross, 0), 0
      )) FILTER (WHERE u.status IN ('confirmed','checked_in','checked_out')), 0)::int AS unpaid_cents,
      COALESCE(SUM(u.agreed_cleaning_cents)
        FILTER (WHERE u.status IN ('confirmed','checked_in','checked_out')), 0)::int AS cleaning_cents
    FROM upcoming u
    LEFT JOIN paid_per p ON p.id = u.id
  `);
  return rows[0] ?? {
    total_bookings: 0,
    confirmed_count: 0, unconfirmed_count: 0, cancelled_count: 0,
    total_cents: 0, paid_cents: 0, unpaid_cents: 0, cleaning_cents: 0,
  };
}
