'use server';

import { revalidatePath } from 'next/cache';
import { pool } from '@db/client';
import type { PaymentType } from '@db/enums';
import { totalPaidForBooking } from '@/lib/payments';

const DEPOSIT_PCT = 0.30;

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
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
      `INSERT INTO booking_payments (booking_id, type, amount_cents, cash)
       VALUES ($1, $2::payment_type, $3, true)
       RETURNING id::text`,
      [bookingId, type, amount_cents],
    );
    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, 'payment.recorded', $2::jsonb)`,
      [bookingId, JSON.stringify({ payment_id: rows[0].id, type, amount_cents, cash: true })],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  revalidatePath('/admin');
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/payments');
  if (booking.user_id) revalidatePath(`/user/${booking.user_id}`);
}
