// Shared adapters between booking-shaped data sources. Pure functions only —
// no DB, no React, no `server-only` guard so this can be imported from
// either side of the RSC boundary. Type-only imports from server-only libs
// are safe because TypeScript erases them at compile time.

import type { BookingRow } from './bookings';
import type { CalendarBooking } from './calendar';

/**
 * Convert a `BookingRow` (from listBookings / listLiveBookingsByUser /
 * etc.) into the `CalendarBooking` shape `BookingActionModal` expects.
 *
 * Used by every admin surface that wants to open the booking modal from a
 * row click — the BookingsExplorer table, the UserBookingChips strip, etc.
 */
export function bookingRowToCalendarBooking(b: BookingRow): CalendarBooking {
  return {
    kind: 'booking',
    id: b.id,
    status: b.status,
    start: b.date_check_in,
    end: b.date_check_out,
    label: `${b.user_name ?? 'no user'} · ${b.property_slug}`,
    property_slug: b.property_slug,
    href: `/admin/bookings/${b.id}`,
    user_id: b.user_id,
    user_name: b.user_name,
    user_email: b.user_email,
    agreed_property_cents: b.agreed_property_cents,
    agreed_cleaning_cents: b.agreed_cleaning_cents,
    agreed_total_cents: b.agreed_total_cents,
    paid_cents: b.paid_cents,
    guests: b.guests,
  };
}
