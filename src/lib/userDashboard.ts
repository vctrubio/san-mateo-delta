import 'server-only';
import { listBookingsForUser, type BookingRow } from './bookings';
import { paymentSplitForUser } from './payments';
import { getUserById, type User } from './users';
import { aggregateBookings, type BookingsAggregate } from './bookingState';
import { todayYmd } from './dates';

// ============================================================================
// getUserDashboard — single aggregator for /admin/users/[id].
//
// Folds together: user record + full booking history + lifetime cash/stripe
// split + booking-state rollup (counts, money, alerts). One helper means one
// place to evolve when the dashboard sprouts another card.
//
// Returns null when the user doesn't exist so the page can `notFound()`.
// ============================================================================

export type UserDashboard = {
  user: User;
  bookings: BookingRow[];
  aggregate: BookingsAggregate;
  /** Lifetime cash + stripe split — needs a separate query because BookingRow's
   *  paid_cents doesn't carry the method. */
  paymentSplit: { cash: number; stripe: number };
};

export async function getUserDashboard(id: string): Promise<UserDashboard | null> {
  const user = await getUserById(id);
  if (!user) return null;

  const [bookings, paymentSplit] = await Promise.all([
    listBookingsForUser(id),
    paymentSplitForUser(id),
  ]);

  return {
    user,
    bookings,
    aggregate: aggregateBookings(bookings, todayYmd()),
    paymentSplit,
  };
}
