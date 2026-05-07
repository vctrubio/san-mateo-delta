import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, BedDouble, Bath, Maximize, Users, Check } from 'lucide-react';
import { getPropertyBySlug, type PropertyRate } from '@/lib/properties';
import { MONTH_NAMES, type Month } from '@db/enums';

function displayName(slug: string) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
    .format(cents / 100);
}

function formatMonths(months: number[]): string {
  // Group consecutive months into ranges. e.g. [1,2,3,4,5,9,10,11,12] → "Jan–May, Sep–Dec"
  if (months.length === 0) return '';
  const sorted = [...months].sort((a, b) => a - b);
  const ranges: [number, number][] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
    } else {
      ranges.push([start, prev]);
      start = sorted[i];
      prev = sorted[i];
    }
  }
  ranges.push([start, prev]);
  return ranges
    .map(([a, b]) =>
      a === b
        ? MONTH_NAMES[a as Month].slice(0, 3)
        : `${MONTH_NAMES[a as Month].slice(0, 3)}–${MONTH_NAMES[b as Month].slice(0, 3)}`,
    )
    .join(', ');
}

export default async function PropertyDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPropertyBySlug(slug);
  if (!data) notFound();
  const { property, rates, cleaning_fee } = data;

  return (
    <main className="min-h-screen pb-16">
      <div className="relative h-[40vh] md:h-[50vh] w-full">
        <Image
          src={`/images/${property.slug}.png`}
          alt={displayName(property.slug)}
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
        <Link
          href="/finca"
          className="absolute top-6 left-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-[11px] font-mono uppercase tracking-widest hover:bg-white/20"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to collection
        </Link>
        <div className="absolute bottom-8 left-6 right-6 max-w-5xl mx-auto text-white">
          <span className="text-xs font-mono uppercase tracking-[0.4em] text-white/70">{property.title}</span>
          <h1 className="text-5xl md:text-7xl font-bold uppercase tracking-tighter mt-1">
            {displayName(property.slug)}
          </h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-12 space-y-12">
        <section>
          <h2 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-4">Description</h2>
          <p className="text-slate-700 leading-relaxed text-lg">{property.description}</p>
        </section>

        <section>
          <h2 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-4">Characteristics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={BedDouble} label="Bedrooms" value={property.bedrooms} />
            <Stat icon={Bath}      label="Bathrooms" value={property.bathrooms} />
            <Stat icon={Maximize}  label="Size"      value={`${property.m2} m²`} />
            <Stat icon={Users}     label="Sleeps"    value={property.max_guests} />
          </div>
        </section>

        {property.features.length > 0 && (
          <section>
            <h2 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-4">Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {property.features.map((f) => (
                <div key={f} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-sky flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 text-ocean" />
                  </div>
                  <span className="text-sm text-slate-700 font-medium">{f}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xs font-mono uppercase tracking-widest text-slate-400">Rates</h2>
            <span className="text-[10px] font-mono text-slate-300">see db/rates.md</span>
          </div>
          <RatesTable rates={rates} />
        </section>

        <section>
          <h2 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-4">Cleaning fee</h2>
          {cleaning_fee ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 flex items-center justify-between">
              <div>
                <div className="font-mono text-[11px] text-slate-400 uppercase tracking-widest">Active</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{eur(cleaning_fee.fee_cents)}</div>
                <div className="text-xs text-slate-500 mt-1">Charged once per booking, on top of the night rate.</div>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-widest">
                active
              </span>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 text-sm">
              No active cleaning fee for this property.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BedDouble;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white border border-slate-100 p-4 rounded-2xl">
      <h3 className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-2">{label}</h3>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-ocean shrink-0" />
        <span className="font-bold text-slate-900">{value}</span>
      </div>
    </div>
  );
}

function RatesTable({ rates }: { rates: PropertyRate[] }) {
  if (rates.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 text-sm">
        No rates configured. Add one in property_rates or via seed.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-[10px] font-mono uppercase tracking-widest text-slate-400">
            <th className="text-left px-5 py-3">Rate</th>
            <th className="text-left px-5 py-3">Months</th>
            <th className="text-right px-5 py-3">Min nights</th>
            <th className="text-right px-5 py-3">Per night</th>
            <th className="text-right px-5 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r.id} className="border-t border-slate-50">
              <td className="px-5 py-3">
                <div className="font-bold text-slate-900">{r.name}</div>
                {!r.public && (
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">invite only</div>
                )}
              </td>
              <td className="px-5 py-3 text-slate-600 font-mono text-[12px]">{formatMonths(r.months)}</td>
              <td className="px-5 py-3 text-right text-slate-700 tabular-nums">{r.min_nights}</td>
              <td className="px-5 py-3 text-right font-mono text-slate-900 tabular-nums">{eur(r.night_rate_cents)}</td>
              <td className="px-5 py-3 text-right">
                <span
                  className={
                    r.active
                      ? 'text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-widest'
                      : 'text-[10px] font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full uppercase tracking-widest'
                  }
                >
                  {r.active ? 'active' : 'inactive'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
