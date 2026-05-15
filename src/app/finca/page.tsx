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
import { iconByName } from '@/lib/amenityIcons';
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
//   1. Lead — eyebrow + h2 + paragraph. Mirrors PropertyShowcase's voice on
//      the homepage; the paragraph names the estate-wide amenities so the
//      guest understands what every home includes before scrolling.
//   2. Property cards — the booking lead. Existing design unchanged.
//   3. Amenity ribbon — a thin inline strip of icon + label pairs below
//      the cards. Reinforces the lead without a header label.
//   4. Hosts — David + Tano in a two-card row at the bottom. No header;
//      faces and quotes carry the section.
// ============================================================================

type AmenityEntry = { name: string; icon: string };

type Host = {
  name: string;
  role: string;
  quote: string;
  image: string;
  haloClass: string;
};

export default async function FincaIndexPage() {
  const properties = await listProperties();

  return (
    <>
      <PageLead />

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

      <AmenityRibbon amenities={fincaData.amenities} />

      <HostsRow hosts={fincaData.hosts} />
    </>
  );
}

// ─── Lead ──────────────────────────────────────────────────────────────────
// Mirrors PropertyShowcase on the homepage — small ocean eyebrow, big bold
// h2, descriptive paragraph that names the estate-wide amenities so the
// guest knows what's included before scrolling.

function PageLead() {
  return (
    <div className="mb-12 max-w-2xl">
      <span className="text-xs font-mono uppercase tracking-[0.3em] text-ocean">
        Punta Paloma · 300 m walk from the beach 
      </span>
      <h1 className="mt-4 text-4xl md:text-6xl font-bold text-slate-900 tracking-tighter text-balance">
        Pick your corner of <span className="italic text-ocean">San Mateo</span>.
      </h1>
      <p className="mt-6 text-slate-500 text-lg leading-relaxed">
        Each home has its own character, its own light. Every one comes with
        Starlink, a private terrace, your own parking, and a welcome for
        your dog.
      </p>
    </div>
  );
}

// ─── Amenity ribbon ────────────────────────────────────────────────────────
// Inline icon + label pairs, wrapping. No header; the lead paragraph above
// already framed what these are. A thin top border separates the ribbon
// from the property cards.

function AmenityRibbon({ amenities }: { amenities: readonly AmenityEntry[] }) {
  return (
    <ul className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap gap-x-7 gap-y-4">
      {amenities.map(({ name, icon }) => {
        const Icon = iconByName(icon);
        return (
          <li key={name} className="inline-flex items-center gap-2 text-sm text-slate-700">
            <Icon className="w-4 h-4 text-ocean shrink-0" />
            <span>{name}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Hosts row ─────────────────────────────────────────────────────────────
// Two cards side-by-side. Avatar (halo + ring), name + role pill, italic
// quote. No header label.

function HostsRow({ hosts }: { hosts: readonly Host[] }) {
  return (
    <ul className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-5">
      {hosts.map((h) => (
        <li
          key={h.name}
          className="flex items-start gap-4 rounded-2xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5"
        >
          <div className={`relative w-14 h-14 rounded-full overflow-hidden shrink-0 ring-2 ring-white shadow-sm ${h.haloClass}`}>
            <Image src={h.image} alt={h.name} fill className="object-cover" sizes="56px" />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-slate-900">{h.name}</span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                {h.role}
              </span>
            </div>
            <p className="text-sm text-slate-600 italic leading-relaxed mt-1">
              &ldquo;{h.quote}&rdquo;
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
