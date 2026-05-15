import { MapPin, Plane, Ship } from 'lucide-react';
import finca from '@config/finca.json';
import travel from '@config/travel.json';

// ============================================================================
// FincaLocation — "where it is" card at the closing of every /finca* route.
//
// Reads location identity from `config/finca.json#location` and the travel
// logistics from `config/travel.json` (airports, ferry crossing). The
// card sits in the wider 2/3 column of the bottom strip, with the two
// host cards stacked in the narrower 1/3 column next to it; `h-full` lets
// the grid stretch the location card to match the combined hosts height.
//
// Server component — no state, no client bundle.
// ============================================================================


const desc = "We are a laid-back beach town with a vibrant kitesurfing scene, and stunning views of the Strait of Gibraltar. Combining the perfect blend of natural beauty and outdoor adventure, we seek travelers looking for both relaxation and excitement."
export function FincaLocation() {
  return (
    <article className="h-full rounded-2xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6 lg:p-8 flex flex-col gap-6">
      <header>
        <p className="text-[10px] font-mono  tracking-[0.4em] text-ocean inline-flex items-center gap-1.5">
          <MapPin className="w-3 h-3" /> Tarifa, Spain
        </p>
        <p className="mt-3 text-sm text-slate-400  leading-relaxed">
          {desc}
        </p>
      </header>

      <hr className="border-slate-100" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <section>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3 inline-flex items-center gap-1.5">
            <Plane className="w-3 h-3" /> Arrival
          </p>
          <ul className="space-y-2.5">
            {travel.airports.map((a) => (
              <li key={a.name}>
                <p className="text-sm font-semibold text-slate-900">{a.name}</p>
                <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500">
                  {a.distance} · {a.time}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3 inline-flex items-center gap-1.5">
            <Ship className="w-3 h-3" /> The Strait
          </p>
          <p className="text-sm font-semibold text-slate-900">{travel.strait.name}</p>
          <p className="text-[11px] font-mono uppercase tracking-widest text-slate-500 mt-1">
            {travel.strait.country} · {travel.strait.time}
          </p>
          <p className="text-[11px] font-mono uppercase tracking-widest text-ocean mt-1">
            {travel.strait.difference}
          </p>
        </section>
      </div>
    </article>
  );
}
