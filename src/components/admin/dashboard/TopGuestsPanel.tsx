import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { topGuests } from '@/lib/dashboard';

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function TopGuestsPanel() {
  const guests = await topGuests(5);
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
          <Trophy className="w-3.5 h-3.5" />
        </span>
        <h3 className="text-sm font-bold text-slate-900">Top guests</h3>
        <span className="ml-auto text-[10px] font-mono text-slate-400">by lifetime spend</span>
      </div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">Repeat + high-value</p>

      {guests.length === 0 ? (
        <p className="text-[12px] text-slate-400 italic">No paid bookings yet.</p>
      ) : (
        <ol className="space-y-1">
          {guests.map((g, i) => (
            <li key={g.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
              <span className="w-6 h-6 rounded-full bg-slate-50 text-slate-500 text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/users/${g.id}`} className="text-[13px] font-bold text-slate-900 truncate hover:text-ocean">
                  {g.name}
                </Link>
                <div className="text-[10px] font-mono text-slate-400 truncate">{g.email}</div>
              </div>
              <div className="text-right">
                <div className="text-[13px] font-bold text-slate-900 tabular-nums">{eur(g.lifetime_spend_cents)}</div>
                <div className="text-[10px] font-mono text-slate-400">{g.total_bookings} bookings</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
