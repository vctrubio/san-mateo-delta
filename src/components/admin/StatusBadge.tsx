import type { BookingStatus } from '@db/enums';
import { BOOKING_STATUS_STYLES } from '@/lib/colors';

export default function StatusBadge({ status }: { status: BookingStatus }) {
  const s = BOOKING_STATUS_STYLES[status];
  return (
    <span className={`inline-block text-xs font-mono uppercase tracking-widest px-2.5 py-1 rounded-full ${s.chip}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
