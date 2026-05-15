import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  BedDouble,
  Bath,
  Maximize,
  Users,
  MoveRight,
} from 'lucide-react';
import { listProperties } from '@/lib/properties';
import { PROPERTY_LABELS, type PropertySlug } from '@/lib/colors';
import { absoluteUrl, defaultOgImageUrl } from '@/lib/site';
import { FincaLead } from '@/components/finca/FincaLead';
import fincaData from '@config/finca.json';

export const metadata: Metadata = {
  title: 'Properties',
  description: `The four properties of Finca ${fincaData.name} — ${fincaData.subtitle}, ${fincaData.location.country}. Choose your sanctuary, 300 m from the beach.`,
  alternates: { canonical: absoluteUrl('/finca') },
  openGraph: {
    title: `Properties · Finca ${fincaData.name}`,
    description: `Browse the four properties of Finca ${fincaData.name} in ${fincaData.subtitle}.`,
    url: absoluteUrl('/finca'),
    images: [defaultOgImageUrl()],
  },
};

// ============================================================================
// /finca — public collection page.
//
// Composes the shared finca scaffold:
//   1. FincaLead       — estate-level lead (heading + description)
//   2. Property cards  — the booking lead
//   3. AmenityRibbon   — estate-wide amenities, persistent
//   4. HostsRow        — David + Tano, persistent
//
// The layout (`/finca/layout.tsx`) owns the banner + the "Punta Paloma"
// eyebrow above. /finca/[slug] composes the same scaffold but swaps the
// FincaLead copy for the property's name + description, and inserts
// PropertyView between the lead and the AmenityRibbon.
// ============================================================================

export default async function FincaIndexPage() {
  const properties = await listProperties();

  return (
    <>
      <FincaLead
        heading={
          <>
            Pick your corner of{' '}
            <span className="italic text-ocean">{fincaData.name}</span>.
          </>
        }
        description="Each home has its own character, its own light. Every one comes with Starlink, a private terrace, your own parking, and a welcome for your dog."
      />

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
                  <div className="relative md:w-72 lg:w-80 aspect-[4/3] md:aspect-auto md:min-h-full shrink-0 bg-slate-100">
                    <Image
                      src={`/images/${p.slug}.png`}
                      alt={`${label} — ${p.title}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 320px"
                    />
                  </div>

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

    </>
  );
}
