'use client';

import { useState } from 'react';
import BookingActionModal from '@/components/shared/BookingActionModal';
import { BOOKING_STATUS_STYLES } from '@/lib/colors';
import { relativeStayLabel } from '@/lib/dates';
import { bookingRowToCalendarBooking } from '@/lib/bookingAdapters';
import type { BookingRow } from '@/lib/bookings';

// ============================================================================
// UserBookingChips — clickable strip of "live" bookings rendered inside the
// /admin/users table's Status column. Each chip is colour-coded by
// `BOOKING_STATUS_STYLES`; clicking opens the same `BookingActionModal` the
// calendar uses, so admin can drive transitions, payments, and cancellations
// without leaving the users list.
//
// "Live" = anything that still needs attention (not cancelled, not already
// checked-out). The list helper `listLiveBookingsByUser` filters at the SQL
// edge so this component just renders.
// ============================================================================

export function UserBookingChips({ bookings }: { bookings: BookingRow[] }) {
  const [active, setActive] = useState<BookingRow | null>(null);

  if (bookings.length === 0) {
    return <span className="text-xs text-slate-300 font-mono">—</span>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5 items-center">
        {bookings.map((b) => {
          const style = BOOKING_STATUS_STYLES[b.status];
          return (
            <button
              key={b.id}
              type="button"
              onClick={(e) => {
                // Stop the AdminTable row link/click from also firing.
                e.preventDefault();
                e.stopPropagation();
                setActive(b);
              }}
              title={`${style.label} · ${b.property_slug.toUpperCase()} · ${relativeStayLabel(b.date_check_in, b.date_check_out)}`}
              className={[
                'relative z-10 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5',
                'text-xs font-mono uppercase tracking-widest',
                'hover:opacity-80 transition-opacity',
                style.chip,
              ].join(' ')}
            >
              <span>{b.property_slug}</span>
              <span className="text-current/70 normal-case tracking-normal">
                {relativeStayLabel(b.date_check_in, b.date_check_out)}
              </span>
            </button>
          );
        })}
      </div>

      {active && (
        <BookingActionModal
          item={bookingRowToCalendarBooking(active)}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}

