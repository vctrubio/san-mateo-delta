import { cancelBooking } from '@/actions/bookings';
import type { BookingStatus, CancelledBy } from '@db/enums';

const TERMINAL: BookingStatus[] = ['cancelled', 'checked_out'];

/**
 * Single Cancel form: caller passes who's cancelling (admin or guest) and the
 * booking id. Reason is collected inline. Action computes refund per
 * docs/refund.md and writes booking_cancellations.
 */
export default function CancelBookingForm({
  bookingId,
  status,
  cancelledBy,
}: {
  bookingId: string;
  status: BookingStatus;
  cancelledBy: CancelledBy;
}) {
  if (TERMINAL.includes(status)) return null;

  return (
    <form action={cancelBooking} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="cancelled_by" value={cancelledBy} />
      <input
        name="reason"
        placeholder="cancellation reason (optional)"
        className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400"
      />
      <button
        type="submit"
        className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-mono uppercase tracking-widest hover:border-rose-300 hover:text-rose-700 transition-colors"
      >
        Cancel booking
      </button>
    </form>
  );
}
