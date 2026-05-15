import Image from 'next/image';
import fincaData from '@config/finca.json';

// HostsRow — two host cards side-by-side, no header. Reads
// `config/finca.json#hosts`. Server component.
//
// Rendered as the closing strip on every /finca* page so David + Tano
// always frame the bottom of the surface — same approach as the amenity
// ribbon above it.
export function HostsRow() {
  return (
    <ul className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-5">
      {fincaData.hosts.map((h) => (
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
