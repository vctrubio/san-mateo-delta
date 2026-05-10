import Link from 'next/link';
import Image from 'next/image';
import {
  BedDouble,
  Bath,
  Maximize,
  Users,
  MoveRight,
  MapPin,
  CalendarRange,
  Sparkles,
} from 'lucide-react';
import { listProperties } from '@/lib/properties';
import { PROPERTY_LABELS, type PropertySlug } from '@/lib/colors';
import fincaData from '../../../finca.json';

// ============================================================================
// /finca — public collection page. Tells the estate's story (location,
// established, amenities) in the header, then lists each property as a full
// row card: photo on the left, name + description + features + specs on the
// right. Rows beat a grid here because each property deserves the full row's
// width to read like a portrait, and amenity lists stay legible.
// ============================================================================

export default async function FincaIndexPage() {
  const properties = await listProperties();

  return (
    <main className="min-h-screen px-6 py-16 md:py-24 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        {/* ─── Hero ─── */}
        <header className="mb-12">
          <span className="text-xs font-mono text-ocean uppercase tracking-[0.4em]">
            Finca {fincaData.name}
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tighter mt-2 mb-4">
            The Collection
          </h1>
          <p className="text-slate-600 max-w-2xl leading-relaxed mb-6">
            {fincaData.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500 mb-8">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-ocean" />
              {fincaData.location.city}, {fincaData.location.region}, {fincaData.location.country}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange className="w-3.5 h-3.5 text-ocean" />
              Established {fincaData.est}
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              {properties.length} {properties.length === 1 ? 'property' : 'properties'}
            </span>
          </div>

          {/* Estate-wide amenities — apply to every property, so we show them
              once here instead of repeating per row. */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400 mb-3 inline-flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Estate amenities
            </p>
            <ul className="flex flex-wrap gap-2">
              {fincaData.amenities.map((a) => (
                <li
                  key={a}
                  className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-xs font-mono text-slate-700"
                >
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </header>

        {/* ─── Property rows ─── */}
        <ul className="space-y-4">
          {properties.map((p) => {
            const label = PROPERTY_LABELS[p.slug as PropertySlug] ?? p.slug.toUpperCase();
            return (
              <li key={p.id}>
                <Link
                  href={`/finca/${p.slug}`}
                  className="group block rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-ocean hover:shadow-lg hover:shadow-ocean/5 overflow-hidden transition-all"
                >
                  <div className="flex flex-col md:flex-row">
                    {/* Photo — fills the left column on desktop, full width
                        on mobile. Aspect-[4/3] keeps the visual rhythm
                        consistent across all four properties. */}
                    <div className="relative md:w-72 lg:w-80 aspect-[4/3] md:aspect-auto md:min-h-full shrink-0 bg-slate-100">
                      <Image
                        src={`/images/${p.slug}.png`}
                        alt={`${label} — ${p.title}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 320px"
                      />
                    </div>

                    {/* Content — name + title, description, features, specs,
                        Open CTA. */}
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                          {label}
                        </h2>
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest shrink-0">
                          {p.title}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed mb-4">
                        {p.description}
                      </p>

                      {/* Features — per-property, distinct from estate
                          amenities. Rendered as muted chips so they read as
                          metadata, not action items. */}
                      {p.features.length > 0 && (
                        <ul className="flex flex-wrap gap-1.5 mb-4">
                          {p.features.map((f) => (
                            <li
                              key={f}
                              className="inline-flex items-center px-2 py-0.5 rounded-full bg-ocean/5 text-ocean text-xs font-mono"
                            >
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-600 mb-4">
                        <span className="inline-flex items-center gap-1">
                          <BedDouble className="w-3.5 h-3.5 text-slate-400" /> {p.bedrooms} bed
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Bath className="w-3.5 h-3.5 text-slate-400" /> {p.bathrooms} bath
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Maximize className="w-3.5 h-3.5 text-slate-400" /> {p.m2} m²
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" /> sleeps {p.max_guests}
                        </span>
                      </div>

                      <span className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-ocean group-hover:gap-2.5 transition-all">
                        Open <MoveRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
