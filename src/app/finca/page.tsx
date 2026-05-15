import Link from 'next/link';
import Image from 'next/image';
import {
  BedDouble,
  Bath,
  Maximize,
  Users,
  MoveRight,
  Sparkles,
  Quote,
} from 'lucide-react';
import { listProperties } from '@/lib/properties';
import { PROPERTY_LABELS, type PropertySlug } from '@/lib/colors';
import fincaData from '@config/finca.json';

// ============================================================================
// /finca — public collection page. Banner lives in `src/app/finca/layout.tsx`,
// so this page dives straight into the four property cards. Supplementary
// info (estate amenities + hosts) sits below the cards as a two-column
// "beyond the properties" strip — present but not competing with the lead.
// ============================================================================

export default async function FincaIndexPage() {
  const properties = await listProperties();

  return (
    <>
      {/* Tight lead — eyebrow only. The banner above already says where you
          are; this just frames the list. No big "The Collection" header,
          no description chrome — properties carry the story. */}
      <p className="text-[10px] font-mono text-ocean uppercase tracking-[0.4em] mb-6">
        Choose your home · {properties.length}
      </p>

      {/* Property cards — the lead. Untouched on purpose; you like these. */}
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

      {/* ─── Beyond the properties ────────────────────────────────────────
          Section after the lead. Two cards on desktop: estate amenities
          (left) + hosts (right). Same `rounded-2xl bg-white border` shell
          as the property cards so the page reads as one family. */}
      <section className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-5">
        <EstateAmenitiesCard amenities={fincaData.amenities} />
        <HostsCard hosts={fincaData.hosts} />
      </section>
    </>
  );
}

// ─── Estate amenities ──────────────────────────────────────────────────────

function EstateAmenitiesCard({ amenities }: { amenities: string[] }) {
  return (
    <article className="rounded-2xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6">
      <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400 mb-1 inline-flex items-center gap-1.5">
        <Sparkles className="w-3 h-3" /> Included on every stay
      </p>
      <h3 className="text-base font-bold text-slate-900 tracking-tight mb-4">
        Estate-wide amenities
      </h3>
      <ul className="flex flex-wrap gap-2">
        {amenities.map((a) => (
          <li
            key={a}
            className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-xs font-mono text-slate-700"
          >
            {a}
          </li>
        ))}
      </ul>
    </article>
  );
}

// ─── Hosts ─────────────────────────────────────────────────────────────────

type Host = {
  name: string;
  role: string;
  quote: string;
  image: string;
  haloClass: string;
};

function HostsCard({ hosts }: { hosts: readonly Host[] }) {
  return (
    <article className="rounded-2xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6">
      <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400 mb-1 inline-flex items-center gap-1.5">
        <Quote className="w-3 h-3" /> The people behind it
      </p>
      <h3 className="text-base font-bold text-slate-900 tracking-tight mb-4">
        Your hosts
      </h3>
      <ul className="space-y-4">
        {hosts.map((h) => (
          <li key={h.name} className="flex items-start gap-3.5">
            <div className={`relative w-12 h-12 rounded-full overflow-hidden shrink-0 ring-2 ring-white shadow-sm ${h.haloClass}`}>
              <Image src={h.image} alt={h.name} fill className="object-cover" sizes="48px" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-slate-900">{h.name}</span>
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
    </article>
  );
}
