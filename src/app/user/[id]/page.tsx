import { notFound } from 'next/navigation';
import UserDashboard from '@/components/user/UserDashboard';
import { getUserById } from '@/lib/users';
import { listBookingsForUser } from '@/lib/bookings';

export const dynamic = 'force-dynamic';

export default async function UserDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ just_booked?: string }>;
}) {
  const { id } = await params;
  const { just_booked } = await searchParams;
  const [user, bookings] = await Promise.all([
    getUserById(id),
    listBookingsForUser(id),
  ]);
  if (!user) notFound();
  return <UserDashboard user={user} bookings={bookings} justBookedId={just_booked} />;
}
