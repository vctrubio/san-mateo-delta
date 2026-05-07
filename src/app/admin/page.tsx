import DashboardMetrics from '@/components/admin/DashboardMetrics';
import QuickActions from '@/components/admin/QuickActions';
import UserSignUpForm from '@/components/shared/UserSignUpForm';
import { listRecentBookingEvents } from '@/lib/bookings';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const events = await listRecentBookingEvents(10);

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Operational view of Finca San Mateo.</p>
      </div>

      <section className="mb-10">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">Metrics</h2>
        <DashboardMetrics />
      </section>

      <section className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">Quick actions</h2>
          <QuickActions />
        </div>
        <div>
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">Create user</h2>
          <UserSignUpForm variant="card" />
        </div>
      </section>

      <section>
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">Recent activity</h2>
        <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
          {events.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">No activity yet.</div>
          ) : (
            <ul>
              {events.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between px-5 py-3 border-b border-slate-50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-slate-400">#{e.booking_id}</span>
                    <span className="text-[11px] font-mono uppercase tracking-widest text-ocean">
                      {e.event_type}
                    </span>
                    <span className="text-sm text-slate-700">
                      {e.user_name ?? 'admin'} · {e.property_slug}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(e.created_at).toLocaleString('en-GB')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
