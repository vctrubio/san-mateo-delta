import AdminNavigation from '@/components/admin/AdminNavigation';
import { getAdminAlerts } from '@/lib/adminAlerts';
import { listBookings } from '@/lib/bookings';
import { toBookingChipSource } from '@/lib/bookingAdapters';

// Async because the admin shell hydrates two server-fetched datasets that
// every admin route needs:
//   - alerts: drive the notifications bell + count badge
//   - bookings: feed the search modal (filter by scope/property/guest,
//     then click through to /admin/bookings/[id])
//
// Both run in parallel. Alerts is a small LATERAL-join query; bookings
// returns the full set (currently ~1k cap in listBookings) so the search
// can filter client-side without round-trips. Both invalidate via
// `revalidateForBooking` when admin acts on a booking, so the bell count
// and search list stay live.
//
// Narrow bookings through `toBookingChipSource` at this boundary so
// internal fields (access_token, time stamps, cancellation metadata)
// don't ship to the client bundle.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [alerts, allBookingsPage] = await Promise.all([
    getAdminAlerts(),
    listBookings({}),
  ]);
  const allBookings = allBookingsPage.rows.map(toBookingChipSource);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid grid-cols-1 2xl:grid-cols-[1fr_minmax(0,1536px)_1fr]">
        <Gutter side="left" />
        <div className="min-w-0">
          <AdminNavigation alerts={alerts} allBookings={allBookings} />
          <main className="p-4 sm:px-6">{children}</main>
        </div>
        <Gutter side="right" />
      </div>
    </div>
  );
}

function Gutter({ side }: { side: 'left' | 'right' }) {
  const text = side === 'left' ? 'finca · san · mateo' : 'admin · console · v0.4';
  return (
    <div className="hidden 2xl:flex items-center justify-center py-12 min-w-0">
      <span
        className="text-xs font-mono uppercase tracking-[0.45em] text-slate-300 whitespace-nowrap"
        style={{
          writingMode: 'vertical-rl',
          transform: side === 'left' ? 'rotate(180deg)' : undefined,
        }}
      >
        {text}
      </span>
    </div>
  );
}
