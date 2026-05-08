'use server';

import { revalidatePath } from 'next/cache';
import { pool } from '@db/client';
import type { PaymentType } from '@db/enums';
import { stripe, appUrl } from '@/lib/stripe/server';
import { totalPaidForBooking } from '@/lib/payments';

const DEPOSIT_PCT = 0.30;

/**
 * Stripe Checkout kind. Maps onto the existing payment_type enum:
 *   - 'deposit'     → 30% of agreed total, type='deposit'
 *   - 'full'        → 100% of agreed total, type='reservation'
 *   - 'balance'     → outstanding (agreed total − sum of succeeded payments), type='balance'
 */
export type CheckoutKind = 'deposit' | 'full' | 'balance';

export type CheckoutResult =
  | { ok: true; url: string; sessionId: string; amount_cents: number }
  | { ok: false; error: string };

/**
 * Create a Stripe Checkout Session for a booking, insert a pending
 * booking_payments row tracking it, and return the redirect URL.
 *
 * Lifecycle:
 *   1. booking_payments.status starts at 'pending', stripe_session_id is set.
 *   2. Guest pays on Stripe's hosted page.
 *   3. checkout.session.completed webhook flips status to 'succeeded' and
 *      populates stripe_payment_intent + stripe_charge_id.
 *   4. payment_intent.payment_failed webhook flips status to 'failed'.
 *
 * The booking_payments row exists from step 1 onward so the admin /payments
 * page reflects in-flight Stripe sessions, not just settled ones.
 */
export async function createCheckoutSession(
  bookingId: string,
  kind: CheckoutKind,
): Promise<CheckoutResult> {
  if (!bookingId) return { ok: false, error: 'bookingId required.' };

  const bookingRows = await pool.query<{
    id: string;
    status: string;
    user_email: string | null;
    user_name: string | null;
    property_title: string;
    property_slug: string;
    check_in: string;
    check_out: string;
    agreed_property_cents: number;
    agreed_cleaning_cents: number;
  }>(
    `SELECT b.id::text                              AS id,
            b.status::text                          AS status,
            u.email                                 AS user_email,
            u.name                                  AS user_name,
            p.title                                 AS property_title,
            p.slug                                  AS property_slug,
            b.date_check_in::text                   AS check_in,
            b.date_check_out::text                  AS check_out,
            b.agreed_property_cents::int            AS agreed_property_cents,
            b.agreed_cleaning_cents::int            AS agreed_cleaning_cents
       FROM bookings b
       JOIN properties p ON p.id = b.property_id
       LEFT JOIN users u ON u.id = b.user_id
      WHERE b.id = $1`,
    [bookingId],
  );
  const booking = bookingRows.rows[0];
  if (!booking) return { ok: false, error: `Booking ${bookingId} not found.` };
  if (booking.status === 'cancelled') {
    return { ok: false, error: 'Cannot pay on a cancelled booking.' };
  }

  const agreedTotal = booking.agreed_property_cents + booking.agreed_cleaning_cents;

  let amount_cents: number;
  let payment_type: PaymentType;
  switch (kind) {
    case 'deposit':
      amount_cents = Math.round(agreedTotal * DEPOSIT_PCT);
      payment_type = 'deposit';
      break;
    case 'full':
      amount_cents = agreedTotal;
      payment_type = 'reservation';
      break;
    case 'balance': {
      const paid = await totalPaidForBooking(bookingId);
      amount_cents = Math.max(0, agreedTotal - paid);
      if (amount_cents === 0) return { ok: false, error: 'Booking already fully paid.' };
      payment_type = 'balance';
      break;
    }
    default:
      return { ok: false, error: `Unknown checkout kind: ${kind as string}` };
  }

  let session;
  try {
    session = await stripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      currency: 'eur',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: amount_cents,
            product_data: {
              name: `${booking.property_title} · ${kind === 'deposit' ? 'Deposit' : kind === 'full' ? 'Full payment' : 'Balance'}`,
              description: `${booking.check_in} → ${booking.check_out}`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: booking.user_email ?? undefined,
      client_reference_id: booking.id,
      metadata: {
        booking_id: booking.id,
        payment_kind: kind,
        payment_type,
        property_slug: booking.property_slug,
      },
      success_url: `${appUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/checkout/cancel?booking_id=${booking.id}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    return { ok: false, error: `Stripe rejected the checkout session: ${msg}` };
  }

  if (!session.url || !session.id) {
    return { ok: false, error: 'Stripe did not return a session URL.' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO booking_payments (
         booking_id, type, amount_cents, method, status, stripe_session_id, paid_at
       ) VALUES (
         $1, $2::payment_type, $3, 'stripe', 'pending', $4, now()
       )`,
      [bookingId, payment_type, amount_cents, session.id],
    );
    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, 'payment.checkout_started', $2::jsonb)`,
      [
        bookingId,
        JSON.stringify({
          kind,
          payment_type,
          amount_cents,
          stripe_session_id: session.id,
        }),
      ],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const msg = err instanceof Error ? err.message : 'Database error';
    return { ok: false, error: `Failed to record pending payment: ${msg}` };
  } finally {
    client.release();
  }

  revalidatePath('/admin/payments');
  revalidatePath(`/admin/bookings/${bookingId}`);

  return { ok: true, url: session.url, sessionId: session.id, amount_cents };
}
