import Image from 'next/image';
import fincaData from '@config/finca.json';

// HostsRow — host cards stacked, no header. Reads `config/finca.json#hosts`.
// Server component.
//
// Lives in the narrow 1/3 column of FincaLayout's closing strip, alongside
// the wider FincaLocation card. Single-column always — the parent grid
// gives it the right width; stacking keeps the host cards readable.
export function HostsRow() {
  return (
    <ul className="grid grid-cols-1 gap-5">
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
