import Link from 'next/link';
import { BedDouble, Bath, Maximize, Users, Coins, MoveRight } from 'lucide-react';
import { listProperties, listPropertyStats } from '@/lib/properties';

export const dynamic = 'force-dynamic';

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

function displayName(slug: string) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export default async function AdminPropertiesPage() {
  const [properties, stats] = await Promise.all([listProperties(), listPropertyStats()]);
  const byId = Object.fromEntries(stats.map((s) => [s.property_id, s] as const));

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Properties</h1>
        <p className="text-sm text-slate-500 mt-1">
          {properties.length} units · click a row to edit details, rates, and cleaning fee.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {properties.map((p) => {
          const s = byId[p.id];
          return (
            <Link
              key={p.id}
              href={`/admin/properties/${p.slug}`}
              className="group block p-5 rounded-2xl bg-white border border-slate-100 hover:border-ocean transition-colors"
            >
              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
                    {displayName(p.slug)}
                  </h2>
                  <span className="text-[11px] font-mono text-slate-400">{p.title}</span>
                </div>
                <MoveRight className="w-4 h-4 text-slate-300 group-hover:text-ocean group-hover:translate-x-1 transition-all" />
              </div>

              <div className="flex flex-wrap gap-3 text-[12px] font-mono text-slate-600 mb-4">
                <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5 text-ocean" /> {p.bedrooms}</span>
                <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5 text-ocean" /> {p.bathrooms}</span>
                <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5 text-ocean" /> {p.m2}m²</span>
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-ocean" /> {p.max_guests}</span>
                <span className="flex items-center gap-1 text-amber-700"><Coins className="w-3.5 h-3.5" /> {eur(p.cleaning_fee_cents)} cleaning</span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-50">
                <Stat label="Bookings" value={s?.total_bookings ?? 0} />
                <Stat label="Upcoming (30d)" value={s?.upcoming_arrivals ?? 0} />
                <Stat label="Collected" value={eur(s?.gross_collected_cents ?? 0)} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-widest text-slate-400">{label}</div>
      <div className="text-sm font-bold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}
