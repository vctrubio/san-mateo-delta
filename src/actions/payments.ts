'use server';

import { revalidatePath } from 'next/cache';
import { pool } from '@db/client';
import type { PaymentType } from '@db/enums';
import { totalPaidForBooking } from '@/lib/payments';
import { stripe } from '@/lib/stripe/server';

const DEPOSIT_PCT = 0.30;

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function revalidateForBookingPayment(bookingId: string, userId: string | null) {
  revalidatePath('/admin');
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/payments');
  if (userId) revalidatePath(`/user/${userId}`);
}

export async function recordPayment(formData: FormData): Promise<void> {
  const bookingId = str(formData, 'booking_id');
  const type = str(formData, 'type') as PaymentType | null;
  if (!bookingId || !type) throw new Error('Missing booking_id or payment type.');

  const bookingRows = await pool.query<{
    agreed_total_cents: number;
    user_id: string | null;
    status: string;
  }>(
    `SELECT (agreed_property_cents + agreed_cleaning_cents)::int AS agreed_total_cents,
            user_id::text AS user_id,
            status::text AS status
     FROM bookings WHERE id = $1`,
    [bookingId],
  );
  const booking = bookingRows.rows[0];
  if (!booking) throw new Error(`Booking ${bookingId} not found.`);
  if (booking.status === 'cancelled') {
    throw new Error('Cannot record payment on a cancelled booking.');
  }

  let amount_cents: number;
  switch (type) {
    case 'deposit':
      amount_cents = Math.round(booking.agreed_total_cents * DEPOSIT_PCT);
      break;
    case 'reservation':
      amount_cents = booking.agreed_total_cents;
      break;
    case 'balance': {
      const paid = await totalPaidForBooking(bookingId);
      amount_cents = Math.max(0, booking.agreed_total_cents - paid);
      if (amount_cents === 0) throw new Error('Booking already fully paid.');
      break;
    }
    case 'extra_guest': {
      const explicit = str(formData, 'amount_cents');
      const n = explicit ? parseInt(explicit, 10) : NaN;
      if (!Number.isFinite(n) || n <= 0) throw new Error('extra_guest needs amount_cents.');
      amount_cents = n;
      break;
    }
    default:
      throw new Error(`Unknown payment type: ${type}`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO booking_payments (booking_id, type, amount_cents, method, status)
       VALUES ($1, $2::payment_type, $3, 'cash', 'succeeded')
       RETURNING id::text`,
      [bookingId, type, amount_cents],
    );
    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, 'payment.recorded', $2::jsonb)`,
      [bookingId, JSON.stringify({ payment_id: rows[0].id, type, amount_cents, method: 'cash' })],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  revalidateForBookingPayment(bookingId, booking.user_id);
}

// ---------------------------------------------------------------------------
// markCashReceived — admin clicks "Mark received" on a pending cash payment.
// Flips status pending → succeeded and updates paid_at to now. The original
// row was inserted at booking-request time as the "owed cash" promise.
// ---------------------------------------------------------------------------

export async function markCashReceived(formData: FormData): Promise<void> {
  const paymentId = str(formData, 'payment_id');
  if (!paymentId) throw new Error('payment_id required');

  const result = await pool.query<{
    booking_id: string;
    user_id: string | null;
    method: string;
    status: string;
  }>(
    `SELECT bp.booking_id::text                AS booking_id,
            b.user_id::text                    AS user_id,
            bp.method::text                    AS method,
            bp.status::text                    AS status
       FROM booking_payments bp
       JOIN bookings b ON b.id = bp.booking_id
      WHERE bp.id = $1`,
    [paymentId],
  );
  const p = result.rows[0];
  if (!p) throw new Error(`Payment ${paymentId} not found.`);
  if (p.method !== 'cash') throw new Error('Only cash payments can be marked received here.');
  if (p.status !== 'pending') throw new Error(`Payment is already ${p.status}.`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE booking_payments SET status = 'succeeded', paid_at = now() WHERE id = $1`,
      [paymentId],
    );
    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, 'payment.cash_received', $2::jsonb)`,
      [p.booking_id, JSON.stringify({ payment_id: paymentId })],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  revalidateForBookingPayment(p.booking_id, p.user_id);
}

// ---------------------------------------------------------------------------
// refundStripePayment — admin issues a refund through Stripe. Stripe sends
// a charge.refunded webhook which inserts the payment_refunds row, so we do
// NOT write to the DB here. We also don't error if the API call fails — we
// surface the message so the host can act on it.
//
// `amount_cents` optional. If omitted, refunds the full charge amount.
// ---------------------------------------------------------------------------

export async function refundStripePayment(formData: FormData): Promise<void> {
  const paymentId = str(formData, 'payment_id');
  const amountStr = str(formData, 'amount_cents');
  const reason = str(formData, 'reason');
  if (!paymentId) throw new Error('payment_id required');

  const result = await pool.query<{
    booking_id: string;
    user_id: string | null;
    method: string;
    status: string;
    stripe_payment_intent: string | null;
    amount_cents: number;
  }>(
    `SELECT bp.booking_id::text                AS booking_id,
            b.user_id::text                    AS user_id,
            bp.method::text                    AS method,
            bp.status::text                    AS status,
            bp.stripe_payment_intent           AS stripe_payment_intent,
            bp.amount_cents::int               AS amount_cents
       FROM booking_payments bp
       JOIN bookings b ON b.id = bp.booking_id
      WHERE bp.id = $1`,
    [paymentId],
  );
  const p = result.rows[0];
  if (!p) throw new Error(`Payment ${paymentId} not found.`);
  if (p.method !== 'stripe') throw new Error('Only Stripe payments can be refunded via Stripe.');
  if (p.status !== 'succeeded') throw new Error(`Payment is ${p.status}, can’t refund.`);
  if (!p.stripe_payment_intent) throw new Error('Missing Stripe PaymentIntent on this payment.');

  let amount: number | undefined;
  if (amountStr) {
    const n = parseInt(amountStr, 10);
    if (!Number.isFinite(n) || n <= 0 || n > p.amount_cents) {
      throw new Error(`Invalid amount: ${amountStr}. Must be 1–${p.amount_cents} cents.`);
    }
    amount = n;
  }

  try {
    await stripe().refunds.create({
      payment_intent: p.stripe_payment_intent,
      amount,
      reason: 'requested_by_customer',
      metadata: {
        payment_id: paymentId,
        booking_id: p.booking_id,
        admin_reason: reason ?? '',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    throw new Error(`Stripe refund failed: ${msg}`);
  }

  // The DB write happens in the charge.refunded webhook handler. We just nudge
  // the cache so the host sees the in-flight state.
  revalidateForBookingPayment(p.booking_id, p.user_id);
}
