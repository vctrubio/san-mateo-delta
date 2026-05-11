import type { BookingStatus } from '@db/enums';
import type { BookingRow } from './bookings';
import type { CalendarBooking } from './calendar';

// ============================================================================
// Adapters between booking-shaped data sources. Pure functions only — no DB,
// no React, no `server-only` guard so this can be imported from either side
// of the RSC boundary. Type-only imports from server-only libs are safe
// because TypeScript erases them at compile time.
// ============================================================================

// ─── Narrow client-facing booking shape ────────────────────────────────────
//
// `BookingRow` carries internal/sensitive fields (`access_token`,
// cancellation metadata, payment refund totals, etc.) that we don't want
// flowing through RSC props into client components. `BookingChipSource` is
// the subset the chip strip + booking-action modal actually need; the page
// runs `toBookingChipSource` at the server/client boundary so only these
// fields end up in the serialized prop payload.
//
// Add a field when a client component genuinely needs it — never widen this
// to the full `BookingRow`.

export type BookingChipSource = {
  id: string;
  status: BookingStatus;
  property_slug: string;
  date_check_in: string;
  date_check_out: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  agreed_property_cents: number;
  agreed_cleaning_cents: number;
  agreed_total_cents: number;
  paid_cents: number;
  guests: { adults: number; children: number; infants: number; pets: number };
};

export function toBookingChipSource(b: BookingRow): BookingChipSource {
  return {
    id: b.id,
    status: b.status,
    property_slug: b.property_slug,
    date_check_in: b.date_check_in,
    date_check_out: b.date_check_out,
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

// ─── BookingChipSource → CalendarBooking ───────────────────────────────────
//
// Used by every admin surface that wants to open `BookingActionModal` from a
// chip / row click — the UserBookingChips strip, the BookingsExplorer table,
// etc. Accepts the narrow `BookingChipSource` so it works equally well from
// either the runtime-mapped chips or the (still-wide) explorer.

export function bookingRowToCalendarBooking(b: BookingChipSource): CalendarBooking {
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
