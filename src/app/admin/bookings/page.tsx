import BookingsTable from '@/components/admin/BookingsTable';
import { listBookings } from '@/lib/bookings';

export const dynamic = 'force-dynamic';

export default async function AdminBookingsPage() {
  const bookings = await listBookings();
  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bookings</h1>
        <p className="text-sm text-slate-500 mt-1">
          {bookings.length} total · click a row for full detail · use the inline buttons for one-click status changes.
        </p>
      </div>
      <BookingsTable bookings={bookings} />
    </div>
  );
}
