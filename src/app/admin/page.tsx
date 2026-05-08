import DashboardMetrics from '@/components/admin/DashboardMetrics';
import RevenueByMonthChart from '@/components/admin/charts/RevenueByMonthChart';
import PerPropertyMoneyStrip from '@/components/admin/dashboard/PerPropertyMoneyStrip';
import PipelinePanel from '@/components/admin/dashboard/PipelinePanel';
import TopGuestsPanel from '@/components/admin/dashboard/TopGuestsPanel';
import { listRecentBookingEvents } from '@/lib/bookings';
import { revenueByMonth } from '@/lib/dashboard';
import { fmtDate } from '@/lib/dates';

export const dynamic = 'force-dynamic';

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function AdminDashboardPage() {
  const [revenue, events] = await Promise.all([
    revenueByMonth({ months: 12 }),
    listRecentBookingEvents(10),
  ]);

  const totalRevenue = revenue.reduce(
    (sum, m) => sum + m.levante + m.estrecho + m.marea + m.cala,
    0,
  );

  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Money + pipeline · what was earned, who&apos;s owed, what&apos;s waiting.
        </p>
      </header>

      <Section label="The money">
        <DashboardMetrics />
      </Section>

      <Section label="By property" hint="Held bookings · David vs Tano split">
        <PerPropertyMoneyStrip />
      </Section>

      <Section label="Revenue over time">
        <ChartCard title="Revenue by month" sub={`Last 12 months · net ${eur(totalRevenue)}`}>
          <RevenueByMonthChart data={revenue} />
        </ChartCard>
      </Section>

      <Section label="Pipeline" hint="Request → confirmed · what to work next">
        <PipelinePanel />
      </Section>

      <Section label="Insights">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopGuestsPanel />
          <RecentActivity
            events={events.map((e) => ({
              id: e.id,
              booking_id: e.booking_id,
              event_type: e.event_type,
              created_at: e.created_at,
              property_slug: e.property_slug,
              user_name: e.user_name,
            }))}
          />
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{label}</h2>
        {hint && <span className="text-[10px] font-mono text-slate-300">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function ChartCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5">
      <header className="mb-3">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{sub}</p>
      </header>
      {children}
    </div>
  );
}

type RecentEvent = {
  id: string;
  booking_id: string;
  event_type: string;
  created_at: string;
  property_slug: string;
  user_name: string | null;
};

function RecentActivity({ events }: { events: RecentEvent[] }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900">Recent activity</h3>
        <span className="text-[10px] font-mono text-slate-300">last {events.length}</span>
      </div>
      {events.length === 0 ? (
        <p className="text-[12px] text-slate-400 italic">No activity yet.</p>
      ) : (
        <ul>
          {events.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[10px] text-slate-400 shrink-0">#{e.booking_id}</span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-ocean truncate">
                  {e.event_type}
                </span>
                <span className="text-[12px] text-slate-700 truncate">
                  {e.user_name ?? 'admin'} · {e.property_slug}
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                {fmtDate(e.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
