import {
  Wifi,
  Tv,
  AirVent,
  TreePine,
  PawPrint,
  ParkingCircle,
  WashingMachine,
  Sparkles,
  MapPin,
  Mail,
  Phone,
  type LucideIcon,
} from 'lucide-react';
import fincaData from '../../../finca.json';

// Visual mapping only — labels come from finca.json. Adding "BBQ" to the JSON
// renders fine without touching this map; map a new key here if you want a
// specific icon, otherwise it falls back to Sparkles.
const AMENITY_ICONS: Record<string, LucideIcon> = {
  'Starlink WiFi': Wifi,
  'Smart TV': Tv,
  'Air Conditioning': AirVent,
  'Private Terrace': TreePine,
  'Pets Allowed': PawPrint,
  'Private Parking': ParkingCircle,
  Washer: WashingMachine,
};

function AmenitiesGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
      {fincaData.amenities.map((label) => {
        const Icon = AMENITY_ICONS[label] ?? Sparkles;
        return (
          <div
            key={label}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-100 hover:border-sand transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-sand flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-slate-700" />
            </div>
            <span className="text-[12px] font-medium text-slate-700">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function EstateMeta() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-2">Location</h4>
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-ocean shrink-0 mt-0.5" />
          <div className="text-[12px]">
            <div className="font-bold text-slate-900">{fincaData.location.city}, {fincaData.location.region}</div>
            <div className="text-slate-500">{fincaData.location.country} · {fincaData.location.timezone}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-2">Contact</h4>
        <div className="space-y-1.5 text-[12px]">
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-ocean" />
            <span className="text-slate-700 font-mono">{fincaData.contact.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-ocean" />
            <span className="text-slate-700 font-mono">{fincaData.contact.phone}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-2">Hosts</h4>
        <div className="space-y-1.5">
          {fincaData.hosts.map((h) => (
            <div key={h.name} className="text-[12px]">
              <span className="font-bold text-slate-900">{h.name}</span>
              <span className="text-slate-400"> · {h.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DebugFincaPanel() {
  return (
    <section className="p-8 bg-sand/40 border-t border-slate-200">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
          <h2 className="text-sm font-mono uppercase tracking-widest text-slate-400">Debug Finca</h2>
          <span className="text-[10px] font-mono text-slate-400">
            source: <code className="px-1 rounded bg-white border border-slate-200">/finca.json</code>
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Estate-wide config — applies uniformly to all {' '}
          <span className="font-mono">properties</span> rows. Edit{' '}
          <code className="font-mono px-1 rounded bg-white border border-slate-200">finca.json</code>{' '}
          to add a new amenity (e.g. <span className="font-mono">&quot;BBQ&quot;</span>) — no DB migration needed.
        </p>

        <div className="mb-5">
          <h3 className="text-xs font-mono uppercase text-slate-400 mb-3">
            Estate Amenities · {fincaData.amenities.length} items
          </h3>
          <AmenitiesGrid />
        </div>

        <EstateMeta />
      </div>
    </section>
  );
}
