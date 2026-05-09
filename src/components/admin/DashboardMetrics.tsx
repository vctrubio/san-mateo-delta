import { CalendarRange, Coins, Wallet, Sparkles, Hourglass, Banknote } from 'lucide-react';
import { moneyHeadline } from '@/lib/dashboard';

// ============================================================================
// Money-forward dashboard hero. Six tiles:
//   1. Total bookings — volume
//   2. Collected      — succeeded payments minus refunds (real money in)
//   3. David earned   — SUM agreed_property_cents on held bookings
//   4. Tano earned    — SUM agreed_cleaning_cents on held bookings
//   5. Outstanding    — held bookings' agreed total minus collected
//   6. Pending cash   — cash payments that are pending (owed at check-in)
//
// All driven by lib/dashboard#moneyHeadline so the SQL stays in one place.
// ============================================================================

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(cents / 100);
}

type Metric = {
  label: string;
  value: string;
  sub: string;
  icon: typeof CalendarRange;
  tone: 'sky' | 'emerald' | 'ocean' | 'amber' | 'rose' | 'violet';
};

export default async function DashboardMetrics() {
  const m = await moneyHeadline();

  const metrics: Metric[] = [
    {
      label: 'Total bookings',
      value: String(m.total_bookings),
      sub: 'all time',
      icon: CalendarRange,
      tone: 'sky',
    },
    {
      label: 'Collected',
      value: eur(m.collected_cents),
      sub: 'succeeded payments − refunds',
      icon: Coins,
      tone: 'emerald',
    },
    {
      label: 'David earned',
      value: eur(m.david_earned_cents),
      sub: 'host · property revenue',
      icon: Wallet,
      tone: 'ocean',
    },
    {
      label: 'Tano earned',
      value: eur(m.tano_earned_cents),
      sub: 'cleaner · cleaning fees',
      icon: Sparkles,
      tone: 'amber',
    },
    {
      label: 'Outstanding',
      value: eur(m.outstanding_cents),
      sub: 'agreed but not yet paid',
      icon: Hourglass,
      tone: 'rose',
    },
    {
      label: 'Pending cash',
      value: eur(m.pending_cash_cents),
      sub: 'owed at check-in',
      icon: Banknote,
      tone: 'violet',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map((mt) => (
        <Tile key={mt.label} {...mt} />
      ))}
    </div>
  );
}

function Tile({ label, value, sub, icon: Icon, tone }: Metric) {
  const tones: Record<Metric['tone'], string> = {
    sky:     'bg-sky-50 text-ocean ring-sky-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    ocean:   'bg-ocean/10 text-ocean ring-ocean/30',
    amber:   'bg-amber-50 text-amber-700 ring-amber-200',
    rose:    'bg-rose-50 text-rose-700 ring-rose-200',
    violet:  'bg-violet-50 text-violet-700 ring-violet-200',
  };
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-4">
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400">{label}</h4>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ring-1 ${tones[tone]}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
      <div className="text-xs text-slate-400 mt-1 leading-snug">{sub}</div>
    </div>
  );
}
