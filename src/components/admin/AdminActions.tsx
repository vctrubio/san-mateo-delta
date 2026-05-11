'use client';

import type { AdminAlert } from '@/lib/adminAlerts';
import type { BookingChipSource } from '@/lib/bookingAdapters';
import { AdminAlertsBell } from './AdminAlertsBell';
import { AdminSearchBell } from './AdminSearchBell';

// Admin shell actions slot. Hosts the search + notifications widgets.
// Both are self-contained — this component just routes the server-fetched
// data into the right one.

export default function AdminActions({
  alerts,
  allBookings,
}: {
  alerts: AdminAlert[];
  allBookings: BookingChipSource[];
}) {
  return (
    <>
      <AdminSearchBell bookings={allBookings} />
      <AdminAlertsBell alerts={alerts} />
    </>
  );
}
