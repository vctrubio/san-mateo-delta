import Link from 'next/link';
import StatusBadge from '@/components/admin/StatusBadge';
import { fmtDateRange } from '@/lib/dates';
import type { BookingRow } from '@/lib/bookings';

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default function PropertyBookingSummary({
  bookings,
  cleaningTotalCents,
  grossCollectedCents,
}: {
  bookings: BookingRow[];
  cleaningTotalCents: number;
  grossCollectedCents: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter(
    (b) => (b.status === 'confirmed' || b.status === 'checked_in') && b.date_check_in >= today,
  );
  const recent = bookings.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Total bookings"   value={String(bookings.length)} />
        <Tile label="Upcoming"          value={String(upcoming.length)} />
        <Tile label="Cleaning paid out" value={eur(cleaningTotalCents)} sub="goes to Tano" />
        <Tile label="Collected"         value={eur(grossCollectedCents)} sub="held bookings only" />
      </div>

      <div>
        <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">Recent ({recent.length})</h3>
        {recent.length === 0 ? (
          <div className="text-sm text-slate-400 italic">None.</div>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/admin/bookings/${b.id}`}
                  className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white border border-slate-100 hover:border-ocean transition-colors"
                >
                  <span className="font-mono text-[10px] text-slate-400">#{b.id}</span>
                  <StatusBadge status={b.status} />
                  <span className="text-[12px] text-slate-600 flex-1">
                    {fmtDateRange(b.date_check_in, b.date_check_out)}
                  </span>
                  <span className="text-slate-700 text-[12px]">{b.user_name ?? <span className="italic text-slate-400">no user</span>}</span>
                  <span className="font-mono tabular-nums text-[12px] text-slate-900">{eur(b.agreed_total_cents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
