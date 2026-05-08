import Link from 'next/link';
import StatusBadge from './StatusBadge';
import BookingActionButtons from './BookingActionButtons';
import { fmtDateRange } from '@/lib/dates';
import type { BookingRow } from '@/lib/bookings';

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default function BookingsTable({ bookings }: { bookings: BookingRow[] }) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-100 p-8 text-center text-slate-400 text-sm">
        No bookings yet.
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-[10px] font-mono uppercase tracking-widest text-slate-400">
            <th className="text-left px-4 py-3">#</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Property</th>
            <th className="text-left px-4 py-3">Guest</th>
            <th className="text-left px-4 py-3">Dates</th>
            <th className="text-right px-4 py-3">Agreed</th>
            <th className="text-right px-4 py-3">Paid</th>
            <th className="text-left px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => {
            const fullyPaid = b.paid_cents >= b.agreed_total_cents;
            return (
              <tr key={b.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                  <Link href={`/admin/bookings/${b.id}`} className="hover:text-ocean">#{b.id}</Link>
                </td>
                <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                <td className="px-4 py-3 text-slate-700">
                  <span className="font-bold uppercase">{b.property_slug}</span>
                  <span className="text-slate-400 text-[11px] ml-1">{b.property_title}</span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {b.user_name ?? <span className="text-slate-400 italic">no user (admin)</span>}
                  {b.user_email && <div className="text-[10px] text-slate-400 font-mono">{b.user_email}</div>}
                </td>
                <td className="px-4 py-3 text-[12px] text-slate-600">
                  {fmtDateRange(b.date_check_in, b.date_check_out)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{eur(b.agreed_total_cents)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  <span className={fullyPaid ? 'text-emerald-700' : 'text-amber-700'}>{eur(b.paid_cents)}</span>
                </td>
                <td className="px-4 py-3">
                  <BookingActionButtons bookingId={b.id} currentStatus={b.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
