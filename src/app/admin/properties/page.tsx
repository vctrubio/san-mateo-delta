import { BedDouble, Bath, Maximize, Users, Coins } from 'lucide-react';
import AdminSection from '@/components/admin/AdminSection';
import AdminTable, { type AdminTableColumn } from '@/components/admin/AdminTable';
import { listProperties, listPropertyStats, type Property, type PropertyStats } from '@/lib/properties';
import { PROPERTY_LABELS } from '@/lib/colors';
import { eur } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Row = Property & { stats: PropertyStats | undefined };

const COLUMNS: AdminTableColumn<Row>[] = [
  {
    key: 'identity',
    header: 'Property',
    width: 'minmax(0,1.6fr)',
    render: (p) => {
      const label = PROPERTY_LABELS[p.slug as keyof typeof PROPERTY_LABELS] ?? p.title;
      return (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: `var(--color-property-${p.slug})` }} />
            <span className="text-sm font-semibold text-slate-900">{label}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono truncate">{p.title}</div>
        </div>
      );
    },
  },
  {
    key: 'spec',
    header: 'Spec',
    width: 'minmax(0,1.4fr)',
    render: (p) => (
      <div className="flex flex-wrap gap-3 text-xs font-mono text-slate-600">
        <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5 text-slate-400" /> {p.bedrooms}</span>
        <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5 text-slate-400" /> {p.bathrooms}</span>
        <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5 text-slate-400" /> {p.m2}m²</span>
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" /> max {p.max_guests}</span>
      </div>
    ),
  },
  {
    key: 'cleaning',
    header: 'Cleaning',
    align: 'right',
    width: '110px',
    render: (p) => (
      <span className="inline-flex items-center gap-1 text-xs font-mono text-amber-700">
        <Coins className="w-3.5 h-3.5" /> {eur(p.cleaning_fee_cents)}
      </span>
    ),
  },
  {
    key: 'bookings',
    header: 'Bookings',
    align: 'right',
    width: '90px',
    render: (p) => <span className="font-mono tabular-nums text-sm text-slate-700">{p.stats?.total_bookings ?? 0}</span>,
  },
  {
    key: 'upcoming',
    header: 'Upcoming 30d',
    align: 'right',
    width: '120px',
    render: (p) => <span className="font-mono tabular-nums text-sm text-slate-700">{p.stats?.upcoming_arrivals ?? 0}</span>,
  },
  {
    key: 'collected',
    header: 'Collected',
    align: 'right',
    width: '120px',
    render: (p) => <span className="font-mono tabular-nums text-sm text-slate-900">{eur(p.stats?.gross_collected_cents ?? 0)}</span>,
  },
];

export default async function AdminPropertiesPage() {
  const [properties, stats] = await Promise.all([listProperties(), listPropertyStats()]);
  const byId = new Map(stats.map((s) => [s.property_id, s] as const));
  const rows: Row[] = properties.map((p) => ({ ...p, stats: byId.get(p.id) }));

  return (
    <>
      <AdminSection eyebrow="All properties">
        <AdminTable
          columns={COLUMNS}
          rows={rows}
          rowKey={(p) => p.id}
          rowHref={(p) => `/admin/properties/${p.slug}`}
        />
      </AdminSection>
    </>
  );
}
