import Link from 'next/link';
import type { PaymentRow } from '@/lib/payments';

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default function PaymentsTable({ payments }: { payments: PaymentRow[] }) {
  if (payments.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-100 p-8 text-center text-slate-400 text-sm">
        No payments yet.
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-[10px] font-mono uppercase tracking-widest text-slate-400">
            <th className="text-left px-4 py-3">#</th>
            <th className="text-left px-4 py-3">Type</th>
            <th className="text-left px-4 py-3">Booking</th>
            <th className="text-left px-4 py-3">Property</th>
            <th className="text-left px-4 py-3">Guest</th>
            <th className="text-left px-4 py-3">Cash</th>
            <th className="text-right px-4 py-3">Amount</th>
            <th className="text-right px-4 py-3">Refunded</th>
            <th className="text-right px-4 py-3">When</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-t border-slate-50 hover:bg-slate-50/50">
              <td className="px-4 py-3 font-mono text-[11px] text-slate-400">#{p.id}</td>
              <td className="px-4 py-3 font-mono text-[12px] text-slate-700">{p.type}</td>
              <td className="px-4 py-3 font-mono text-[11px]">
                <Link href={`/admin/bookings/${p.booking_id}`} className="text-ocean hover:underline">#{p.booking_id}</Link>
              </td>
              <td className="px-4 py-3 text-slate-700 font-mono text-[12px] uppercase">{p.property_slug}</td>
              <td className="px-4 py-3 text-slate-700">
                {p.user_name ?? <span className="italic text-slate-400">—</span>}
              </td>
              <td className="px-4 py-3 text-slate-500 text-[11px]">{p.cash ? 'cash' : 'card'}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">{eur(p.amount_cents)}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">
                {p.refunded_cents > 0 ? <span className="text-rose-700">−{eur(p.refunded_cents)}</span> : <span className="text-slate-300">—</span>}
              </td>
              <td className="px-4 py-3 text-right text-[11px] font-mono text-slate-400">{new Date(p.paid_at).toLocaleString('en-GB')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
