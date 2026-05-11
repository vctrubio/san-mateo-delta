import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, BedDouble, Bath, Maximize, Users, Check,
  Wifi, Tv, AirVent, TreePine, PawPrint, ParkingCircle, WashingMachine, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { eur } from '@/lib/format';
import { getPropertyBySlug, type RatesByMonth } from '@/lib/properties';
import { getCalendarItems, windowFor } from '@/lib/calendar';
import { MONTHS, MONTH_NAMES, type Month } from '@db/enums';
import fincaData from '../../../../finca.json';
import BookNowForm from '@/components/finca/BookNowForm';

export const dynamic = 'force-dynamic';

const AMENITY_ICONS: Record<string, LucideIcon> = {
  'Starlink WiFi': Wifi,
  'Smart TV': Tv,
  'Air Conditioning': AirVent,
  'Private Terrace': TreePine,
  'Pets Allowed': PawPrint,
  'Private Parking': ParkingCircle,
  Washer: WashingMachine,
};

function displayName(slug: string) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function formatMonths(months: number[]): string {
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
  const { property } = data;

  // Fetch a 6-month forward window so the calendar can navigate without re-fetch.
  const { from, to } = windowFor(new Date(), 6);
  const calendarItems = await getCalendarItems({
    propertyId: property.id,
    from,
    to,
    mode: 'public',
  });

  return (
    <main className="min-h-screen pb-20">
      <Hero property={property} />

      <div className="max-w-5xl mx-auto px-6 mt-10 space-y-14">
        <AtAGlance property={property} />

        <section>
          <p className="text-slate-700 leading-relaxed text-lg max-w-3xl">{property.description}</p>
        </section>

        <WhatYouGet features={property.features} amenities={fincaData.amenities} />

        <Pricing rates={property.rates} cleaningFeeCents={property.cleaning_fee_cents} />

        <BookNowForm slug={property.slug} maxGuests={property.max_guests} items={calendarItems} />
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero

function Hero({ property }: { property: { slug: string } }) {
  return (
    <div className="relative h-[40vh] md:h-[55vh] w-full">
      <Image
        src={`/images/${property.slug}.png`}
        alt={displayName(property.slug)}
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/70" />
      <Link
        href="/finca"
        className="absolute top-6 left-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-[11px] font-mono uppercase tracking-widest hover:bg-white/20"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to collection
      </Link>
      <div className="absolute bottom-8 left-6 right-6 max-w-5xl mx-auto text-white">
        <span className="text-xs font-mono uppercase tracking-[0.4em] text-white/70">Finca {fincaData.name}</span>
        <h1 className="text-5xl md:text-7xl font-bold uppercase tracking-tighter mt-1">
          {displayName(property.slug)}
        </h1>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// At-a-glance: 4 stats compressed into a single horizontal pill row

function AtAGlance({
  property,
}: {
  property: { bedrooms: number; bathrooms: number; m2: number; max_guests: number };
}) {
  const stats: Array<{ icon: LucideIcon; label: string; value: string | number }> = [
    { icon: BedDouble, label: 'bedrooms', value: property.bedrooms },
    { icon: Bath,      label: 'bathrooms', value: property.bathrooms },
    { icon: Maximize,  label: 'm²',        value: property.m2 },
    { icon: Users,     label: 'sleeps',    value: property.max_guests },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pb-6 border-b border-slate-100">
      {stats.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-baseline gap-2">
          <Icon className="w-4 h-4 text-ocean shrink-0 self-center" />
          <span className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{value}</span>
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-widest">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// What you get: per-property features (left) + estate-wide amenities (right)

function WhatYouGet({
  features,
  amenities,
}: {
  features: string[];
  amenities: string[];
}) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <FeatureColumn
        title="This property"
        subtitle="Unique to this unit"
        items={features}
        accent="ocean"
      />
      <FeatureColumn
        title="Included on every San Mateo stay"
        subtitle={`Estate-wide · ${fincaData.name}`}
        items={amenities}
        accent="sand"
      />
    </section>
  );
}

function FeatureColumn({
  title,
  subtitle,
  items,
  accent,
}: {
  title: string;
  subtitle: string;
  items: string[];
  accent: 'ocean' | 'sand';
}) {
  const styles =
    accent === 'ocean'
      ? { tag: 'text-ocean', dot: 'bg-sky', icon: 'text-ocean' }
      : { tag: 'text-amber-700', dot: 'bg-sand', icon: 'text-amber-700' };

  return (
    <div>
      <div className="mb-4">
        <div className={`text-[10px] font-mono uppercase tracking-[0.3em] ${styles.tag}`}>{subtitle}</div>
        <h3 className="text-lg font-bold text-slate-900 mt-1">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 italic">None listed.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = AMENITY_ICONS[item] ?? Sparkles;
            return (
              <li
                key={item}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-100"
              >
                <div className={`w-8 h-8 rounded-lg ${styles.dot} flex items-center justify-center shrink-0`}>
                  {accent === 'ocean' ? (
                    <Check className={`w-4 h-4 ${styles.icon}`} />
                  ) : (
                    <Icon className={`w-4 h-4 ${styles.icon}`} />
                  )}
                </div>
                <span className="text-sm text-slate-700 font-medium">{item}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing: 12-month rate grid (grouped by value) + cleaning fee. Rates are
// stored as a JSONB column on properties — see docs/rates.md.

function Pricing({
  rates,
  cleaningFeeCents,
}: {
  rates: RatesByMonth;
  cleaningFeeCents: number;
}) {
  // Group consecutive months that share the same rate so the table reads
  // "Jan-May, Sep-Dec · €350/night" rather than 12 individual rows.
  const groups = groupByRate(rates);
  return (
    <section>
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-xs font-mono uppercase tracking-widest text-slate-400">Pricing</h2>
        <span className="text-[10px] font-mono text-slate-300">see docs/rates.md</span>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 text-sm">
          No rates configured.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                <th className="text-left px-5 py-3">Months</th>
                <th className="text-right px-5 py-3">Per night</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.label} className="border-t border-slate-50">
                  <td className="px-5 py-3 text-slate-700 font-mono text-[12px]">{g.label}</td>
                  <td className="px-5 py-3 text-right font-mono text-slate-900 tabular-nums">{eur(g.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 rounded-2xl border border-slate-100 bg-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Cleaning fee</span>
          {cleaningFeeCents > 0 ? (
            <span className="text-base font-bold text-slate-900 tabular-nums">{eur(cleaningFeeCents)}</span>
          ) : (
            <span className="text-sm text-amber-700 italic">Not configured</span>
          )}
        </div>
        <span className="text-[11px] text-slate-400">Charged once per booking, on top of the night rate.</span>
      </div>
    </section>
  );
}

function groupByRate(rates: RatesByMonth): Array<{ label: string; cents: number }> {
  // Walk months in order, collapse runs that share a rate.
  const runs: Array<{ months: Month[]; cents: number }> = [];
  for (const m of MONTHS) {
    const cents = rates[m] ?? 0;
    const last = runs[runs.length - 1];
    if (last && last.cents === cents) {
      last.months.push(m);
    } else {
      runs.push({ months: [m], cents });
    }
  }
  // Merge January with December if both runs share a rate (wrap-around).
  if (runs.length > 1 && runs[0].cents === runs[runs.length - 1].cents) {
    const tail = runs.pop()!;
    runs[0].months = [...tail.months, ...runs[0].months];
  }
  // Then format each run's months into a "Jan-May" or "Jul" string.
  return runs.map((r) => ({
    label: formatMonths(r.months),
    cents: r.cents,
  }));
}
