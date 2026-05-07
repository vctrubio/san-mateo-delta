import type { BookingStatus } from '@db/enums';

const STYLES: Record<BookingStatus, string> = {
  request:     'bg-amber-50 text-amber-800 ring-amber-200',
  invite:      'bg-violet-50 text-violet-800 ring-violet-200',
  confirmed:   'bg-sky-50 text-sky-800 ring-sky-200',
  checked_in:  'bg-emerald-50 text-emerald-800 ring-emerald-200',
  checked_out: 'bg-slate-100 text-slate-600 ring-slate-200',
  cancelled:   'bg-rose-50 text-rose-700 ring-rose-200',
};

export default function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-block text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full ring-1 ${STYLES[status]}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
