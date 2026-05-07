import { notFound } from 'next/navigation';
import UserDashboard from '@/components/user/UserDashboard';
import { getUserById } from '@/lib/users';
import { listBookingsForUser } from '@/lib/bookings';

export const dynamic = 'force-dynamic';

export default async function UserDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, bookings] = await Promise.all([
    getUserById(id),
    listBookingsForUser(id),
  ]);
  if (!user) notFound();
  return <UserDashboard user={user} bookings={bookings} />;
}
