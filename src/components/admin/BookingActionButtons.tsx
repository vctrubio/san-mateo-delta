import { transitionStatus } from '@/actions/bookings';
import type { BookingStatus } from '@db/enums';

const NEXT: Record<BookingStatus, Array<{ to: BookingStatus; label: string; tone: 'primary' | 'danger' }>> = {
  request:     [{ to: 'confirmed',   label: 'Confirm',    tone: 'primary' }, { to: 'cancelled', label: 'Cancel', tone: 'danger' }],
  invite:      [{ to: 'confirmed',   label: 'Confirm',    tone: 'primary' }, { to: 'cancelled', label: 'Cancel', tone: 'danger' }],
  confirmed:   [{ to: 'checked_in',  label: 'Check-in',   tone: 'primary' }, { to: 'cancelled', label: 'Cancel', tone: 'danger' }],
  checked_in:  [{ to: 'checked_out', label: 'Check-out',  tone: 'primary' }],
  checked_out: [],
  cancelled:   [],
};

export default function BookingActionButtons({
  bookingId,
  currentStatus,
  size = 'sm',
}: {
  bookingId: string;
  currentStatus: BookingStatus;
  size?: 'sm' | 'md';
}) {
  const next = NEXT[currentStatus];
  if (next.length === 0) {
    return <span className="text-xs font-mono text-slate-300 uppercase">terminal</span>;
  }
  const padding = size === 'sm' ? 'px-3 py-1' : 'px-4 py-2';
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {next.map(({ to, label, tone }) => (
        <form key={to} action={transitionStatus}>
          <input type="hidden" name="booking_id" value={bookingId} />
          <input type="hidden" name="to" value={to} />
          <button
            type="submit"
            className={
              tone === 'primary'
                ? `${padding} rounded-lg bg-slate-900 text-white text-xs font-mono uppercase tracking-widest hover:bg-ocean transition-colors`
                : `${padding} rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-mono uppercase tracking-widest hover:border-rose-300 hover:text-rose-700 transition-colors`
            }
          >
            {label}
          </button>
        </form>
      ))}
    </div>
  );
}
