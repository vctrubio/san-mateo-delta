import { iconByName } from '@/lib/amenityIcons';
import fincaData from '@config/finca.json';

// AmenityRibbon — inline icon + label pairs, no header. Reads
// `config/finca.json#amenities` ({ name, icon } pairs) and resolves each
// icon via `@/lib/amenityIcons#iconByName`. Server component.
//
// Lives at the bottom of every /finca* page (rendered by each page, not
// the Next layout, because both /finca and /finca/[slug] want it but the
// /finca/[slug] page also wants PropertyView between the lead and this
// strip).
export function AmenityRibbon() {
  return (
    <ul className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap gap-x-7 gap-y-4">
      {fincaData.amenities.map(({ name, icon }) => {
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
