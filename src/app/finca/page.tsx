import Link from 'next/link';
import { listProperties } from '@/lib/properties';
import { BedDouble, Bath, Maximize, Users, MoveRight } from 'lucide-react';

function displayName(slug: string) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export default async function FincaIndexPage() {
  const properties = await listProperties();

  return (
    <main className="min-h-screen px-6 py-16 md:py-24">
      <div className="max-w-5xl mx-auto">
        <span className="text-xs font-mono text-ocean uppercase tracking-[0.4em]">Finca San Mateo</span>
        <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tighter mt-2 mb-3">
          The Collection
        </h1>
        <p className="text-slate-500 mb-12 max-w-xl">
          Four properties, one estate. Tap a card for the full details, rates, and cleaning fee.
        </p>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {properties.map((p) => (
            <li key={p.id}>
              <Link
                href={`/finca/${p.slug}`}
                className="group block p-6 rounded-2xl border border-slate-100 bg-white hover:border-ocean hover:shadow-lg hover:shadow-ocean/5 transition-all"
              >
                <div className="flex items-baseline justify-between mb-1">
                  <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">
                    {displayName(p.slug)}
                  </h2>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                    {p.title}
                  </span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed mb-5">{p.description}</p>

                <div className="flex flex-wrap gap-4 text-[12px] font-mono text-slate-600 mb-4">
                  <span className="flex items-center gap-1.5"><BedDouble className="w-3.5 h-3.5 text-ocean" /> {p.bedrooms} bed</span>
                  <span className="flex items-center gap-1.5"><Bath className="w-3.5 h-3.5 text-ocean" /> {p.bathrooms} bath</span>
                  <span className="flex items-center gap-1.5"><Maximize className="w-3.5 h-3.5 text-ocean" /> {p.m2} m²</span>
                  <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-ocean" /> sleeps {p.max_guests}</span>
                </div>

                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-ocean group-hover:gap-2.5 transition-all">
                  Open <MoveRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
