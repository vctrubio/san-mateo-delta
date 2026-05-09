import AdminSection from '@/components/admin/AdminSection';
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
    <>
      <AdminSection eyebrow="The money">
        <DashboardMetrics />
      </AdminSection>

      <AdminSection eyebrow="By property" hint="Held bookings · David vs Tano split">
        <PerPropertyMoneyStrip />
      </AdminSection>

      <AdminSection eyebrow="Revenue over time">
        <ChartCard title="Revenue by month" sub={`Last 12 months · net ${eur(totalRevenue)}`}>
          <RevenueByMonthChart data={revenue} />
        </ChartCard>
      </AdminSection>

      <AdminSection eyebrow="Pipeline" hint="Request → confirmed · what to work next">
        <PipelinePanel />
      </AdminSection>

      <AdminSection eyebrow="Insights">
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
      </AdminSection>
    </>
  );
}

function ChartCard({ title, sub, children }: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 p-5">
      <header className="mb-3">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400">{sub}</p>
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
    <div className="rounded-2xl bg-white border border-slate-200/80 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900">Recent activity</h3>
        <span className="text-xs font-mono text-slate-300">last {events.length}</span>
      </div>
      {events.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No activity yet.</p>
      ) : (
        <ul>
          {events.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs text-slate-400 shrink-0">#{e.booking_id}</span>
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-ocean truncate">
                  {e.event_type}
                </span>
                <span className="text-xs text-slate-700 truncate">
                  {e.user_name ?? 'admin'} · {e.property_slug}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
                {fmtDate(e.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
