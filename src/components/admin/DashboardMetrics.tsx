import { sql } from '@db/client';
import { CalendarRange, Coins, Plane, Home, Inbox } from 'lucide-react';

type Metric = { label: string; value: string; sub?: string; icon: typeof CalendarRange; tone: 'sky' | 'emerald' | 'amber' | 'slate' };

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function DashboardMetrics() {
  const [byStatus, paid, arrivals, inHouse, requests] = await Promise.all([
    sql<{ status: string; count: string }>(`SELECT status::text, count(*)::text FROM bookings GROUP BY status`),
    sql<{ paid_cents: string }>(`
      SELECT COALESCE(SUM(bp.amount_cents) - COALESCE((SELECT SUM(amount_cents) FROM payment_refunds), 0), 0)::text AS paid_cents
      FROM booking_payments bp
    `),
    sql<{ count: string }>(`
      SELECT count(*)::text
      FROM bookings
      WHERE status IN ('confirmed','checked_in')
        AND date_check_in BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
    `),
    sql<{ count: string }>(`SELECT count(*)::text FROM bookings WHERE status = 'checked_in'`),
    sql<{ count: string }>(`SELECT count(*)::text FROM bookings WHERE status = 'request'`),
  ]);

  const totalBookings = byStatus.reduce((sum, r) => sum + Number(r.count), 0);

  const metrics: Metric[] = [
    {
      label: 'Bookings',
      value: String(totalBookings),
      sub: byStatus.map((r) => `${r.count} ${r.status.replace('_', ' ')}`).join(' · '),
      icon: CalendarRange,
      tone: 'sky',
    },
    {
      label: 'Collected',
      value: eur(Number(paid[0]?.paid_cents ?? 0)),
      sub: 'all payments minus refunds',
      icon: Coins,
      tone: 'emerald',
    },
    {
      label: 'Arrivals (7d)',
      value: arrivals[0]?.count ?? '0',
      sub: 'confirmed + checked-in starting in next week',
      icon: Plane,
      tone: 'sky',
    },
    {
      label: 'In-house now',
      value: inHouse[0]?.count ?? '0',
      sub: 'currently checked in',
      icon: Home,
      tone: 'emerald',
    },
    {
      label: 'Requests',
      value: requests[0]?.count ?? '0',
      sub: 'awaiting host approval',
      icon: Inbox,
      tone: 'amber',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {metrics.map((m) => (
        <Tile key={m.label} {...m} />
      ))}
    </div>
  );
}

function Tile({ label, value, sub, icon: Icon, tone }: Metric) {
  const tones: Record<Metric['tone'], string> = {
    sky:     'bg-sky-50 text-ocean ring-sky-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber:   'bg-amber-50 text-amber-700 ring-amber-200',
    slate:   'bg-slate-50 text-slate-700 ring-slate-200',
  };
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-4">
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{label}</h4>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ring-1 ${tones[tone]}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-1 leading-snug">{sub}</div>}
    </div>
  );
}
