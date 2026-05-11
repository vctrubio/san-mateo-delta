import BookingsExplorer from '@/components/admin/BookingsExplorer';
import { listBookings } from '@/lib/bookings';

export const dynamic = 'force-dynamic';

// /admin/bookings — server fetches every booking once, hands them to the
// client explorer. Filtering/sorting/aggregation all live in the client so
// the cards, sliders, and table can stay in lockstep without round-trips.

export default async function AdminBookingsPage() {
  const { rows: bookings } = await listBookings({ limit: 5000 });
  return <BookingsExplorer bookings={bookings} />;
}
