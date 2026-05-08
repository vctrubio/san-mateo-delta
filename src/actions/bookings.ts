'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { pool } from '@db/client';
import type { BookingStatus, CancelledBy } from '@db/enums';
import { computeQuote, type Quote } from '@/lib/bookings';
import { computeRefund } from '@/lib/refund';

type RequestBookingResult =
  | { ok: true; userId: string; bookingId: string }
  | { ok: false; error: string };

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function int(form: FormData, key: string, fallback = 0): number {
  const v = form.get(key);
  if (typeof v !== 'string') return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function normaliseEmail(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

function revalidateForBooking(bookingId: string, userId: string | null) {
  revalidatePath('/admin');
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath('/admin/properties');
  if (userId) {
    revalidatePath(`/user/${userId}`);
    revalidatePath(`/admin/users/${userId}`);
  }
}

// ---------------------------------------------------------------------------
// requestBooking — entry point from /finca/[slug] BookNowForm.
// Snapshots the price components onto the booking row so future fee edits
// don't alter past totals (see memory/snapshots_principle.md).
// ---------------------------------------------------------------------------

export async function requestBooking(formData: FormData): Promise<RequestBookingResult> {
  const slug = str(formData, 'slug');
  const check_in = str(formData, 'check_in');
  const check_out = str(formData, 'check_out');
  const adults = int(formData, 'adults', 0);
  const children = int(formData, 'children', 0);
  const infants = int(formData, 'infants', 0);
  const pets = int(formData, 'pets', 0);
  const name = str(formData, 'name');
  const email = normaliseEmail(str(formData, 'email'));
  const tif = str(formData, 'tif');
  const nationality = str(formData, 'nationality');
  const dob = str(formData, 'dob');

  if (!slug)        return { ok: false, error: 'Property slug missing.' };
  if (!check_in)    return { ok: false, error: 'Check-in date required.' };
  if (!check_out)   return { ok: false, error: 'Check-out date required.' };
  if (adults < 1)   return { ok: false, error: 'At least one adult required.' };
  if (!name)        return { ok: false, error: 'Name required.' };
  if (!email)       return { ok: false, error: 'Valid email required.' };

  const props = await pool.query<{ id: string; max_guests: number }>(
    `SELECT id::text, max_guests::int FROM properties WHERE slug = $1`,
    [slug],
  );
  const property = props.rows[0];
  if (!property) return { ok: false, error: `Unknown property: ${slug}` };

  const totalGuests = adults + children + infants;
  if (totalGuests > property.max_guests) {
    return { ok: false, error: `This property sleeps ${property.max_guests}; you entered ${totalGuests}.` };
  }

  const quote = await computeQuote({
    propertyId: property.id,
    check_in,
    check_out,
  });
  if ('error' in quote) return { ok: false, error: quote.error };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRows = await client.query<{ id: string }>(
      `INSERT INTO users (name, email, tif, nationality, dob)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             tif = COALESCE(EXCLUDED.tif, users.tif),
             nationality = COALESCE(EXCLUDED.nationality, users.nationality),
             dob = COALESCE(EXCLUDED.dob, users.dob)
       RETURNING id::text AS id`,
      [name, email, tif, nationality, dob],
    );
    const userId = userRows.rows[0].id;

    const guestsJson = JSON.stringify({ adults, children, infants, pets });
    const bookingRows = await client.query<{ id: string }>(
      `INSERT INTO bookings (
         property_id, user_id, date_check_in, date_check_out,
         agreed_property_cents, agreed_cleaning_cents,
         status, guests
       ) VALUES (
         $1, $2, $3::date, $4::date,
         $5, $6,
         'request', $7::jsonb
       )
       RETURNING id::text AS id`,
      [
        property.id, userId, check_in, check_out,
        quote.agreed_property_cents, quote.agreed_cleaning_cents,
        guestsJson,
      ],
    );
    const bookingId = bookingRows.rows[0].id;

    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, 'booking.created', $2::jsonb)`,
      [
        bookingId,
        JSON.stringify({
          rate_month: quote.rate_month,
          rate_month_label: quote.rate_month_label,
          nights: quote.nights,
          night_rate_cents: quote.night_rate_cents,
          agreed_property_cents: quote.agreed_property_cents,
          agreed_cleaning_cents: quote.agreed_cleaning_cents,
        }),
      ],
    );

    // Cash on arrival: record an upfront pending payment so /admin/payments
    // shows the outstanding cash before check-in. Stripe intents create their
    // own pending row inside createCheckoutSession after this transaction
    // commits — we don't insert anything here for them.
    const payment_intent = str(formData, 'payment_intent') ?? 'cash_on_arrival';
    if (payment_intent === 'cash_on_arrival') {
      const totalCents = quote.agreed_property_cents + quote.agreed_cleaning_cents;
      await client.query(
        `INSERT INTO booking_payments (booking_id, type, amount_cents, method, status, paid_at)
         VALUES ($1, 'reservation', $2, 'cash', 'pending', now())`,
        [bookingId, totalCents],
      );
      await client.query(
        `INSERT INTO booking_events (booking_id, event_type, payload)
         VALUES ($1, 'payment.cash_pending', $2::jsonb)`,
        [bookingId, JSON.stringify({ amount_cents: totalCents, due: 'on arrival' })],
      );
    }

    await client.query('COMMIT');

    revalidateForBooking(bookingId, userId);
    revalidatePath('/user');

    return { ok: true, userId, bookingId };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('no_overlap_when_held')) {
      return { ok: false, error: 'Those dates overlap an existing confirmed booking on this property.' };
    }
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}

export async function requestBookingAndRedirect(formData: FormData): Promise<void> {
  const result = await requestBooking(formData);
  if (!result.ok) throw new Error(result.error);
  redirect(`/user/${result.userId}`);
}

// ---------------------------------------------------------------------------
// previewQuote — UI-only helper for the BookNowForm calendar. Same algorithm
// as requestBooking's pricing path (computeQuote), just exposed without
// inserting anything. Returned as a discriminated union so the client can
// render either the price summary or the error.
// ---------------------------------------------------------------------------

type PreviewQuoteResult =
  | { ok: true; quote: Quote }
  | { ok: false; error: string };

export async function previewQuote(args: {
  slug: string;
  check_in: string;
  check_out: string;
}): Promise<PreviewQuoteResult> {
  const props = await pool.query<{ id: string }>(
    `SELECT id::text FROM properties WHERE slug = $1`,
    [args.slug],
  );
  const property = props.rows[0];
  if (!property) return { ok: false, error: `Unknown property: ${args.slug}` };

  const quote = await computeQuote({
    propertyId: property.id,
    check_in: args.check_in,
    check_out: args.check_out,
  });
  if ('error' in quote) return { ok: false, error: quote.error };
  return { ok: true, quote };
}

// ---------------------------------------------------------------------------
// transitionStatus — admin one-click transitions for non-cancellation moves.
// Cancellation is its own action because it inserts a booking_cancellations
// row and computes refund per policy.
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  request:     ['confirmed'],
  invite:      ['confirmed'],
  confirmed:   ['checked_in'],
  checked_in:  ['checked_out'],
  checked_out: [],
  cancelled:   [],
};

export async function transitionStatus(formData: FormData): Promise<void> {
  const bookingId = str(formData, 'booking_id');
  const to = str(formData, 'to') as BookingStatus | null;
  if (!bookingId || !to) throw new Error('Missing booking_id or target status.');

  if (to === 'cancelled') {
    throw new Error('Use cancelBooking action to cancel.');
  }

  const cur = await pool.query<{ status: BookingStatus; user_id: string | null }>(
    `SELECT status::text AS status, user_id::text AS user_id FROM bookings WHERE id = $1`,
    [bookingId],
  );
  const current = cur.rows[0];
  if (!current) throw new Error(`Booking ${bookingId} not found.`);
  const allowed = TRANSITIONS[current.status];
  if (!allowed.includes(to)) {
    throw new Error(`Cannot transition ${current.status} → ${to}.`);
  }

  const now = new Date().toISOString();
  const setFragments: string[] = [`status = $1::booking_status`];
  const params: unknown[] = [to];
  let p = 1;

  if (to === 'checked_in')  { setFragments.push(`time_check_in = $${++p}`); params.push(now); }
  if (to === 'checked_out') { setFragments.push(`time_check_out = $${++p}`); params.push(now); }
  params.push(bookingId);
  const idParam = `$${++p}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE bookings SET ${setFragments.join(', ')} WHERE id = ${idParam}`,
      params,
    );
    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, $2, $3::jsonb)`,
      [bookingId, `booking.${to}`, JSON.stringify({ from: current.status, to })],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  revalidateForBooking(bookingId, current.user_id);
}

// ---------------------------------------------------------------------------
// cancelBooking — runs the refund policy and writes booking_cancellations.
// Any non-terminal booking can be cancelled. Both guest and admin can call.
// ---------------------------------------------------------------------------

export async function cancelBooking(formData: FormData): Promise<void> {
  const bookingId = str(formData, 'booking_id');
  const cancelled_by = str(formData, 'cancelled_by') as CancelledBy | null;
  const reason = str(formData, 'reason');
  if (!bookingId) throw new Error('booking_id required');
  if (!cancelled_by) throw new Error('cancelled_by required (guest or admin)');

  const result = await pool.query<{
    status: BookingStatus;
    user_id: string | null;
    date_check_in: string;
    agreed_property_cents: number;
    agreed_cleaning_cents: number;
  }>(
    `SELECT status::text AS status,
            user_id::text AS user_id,
            date_check_in::text AS date_check_in,
            agreed_property_cents::int AS agreed_property_cents,
            agreed_cleaning_cents::int AS agreed_cleaning_cents
       FROM bookings WHERE id = $1`,
    [bookingId],
  );
  const booking = result.rows[0];
  if (!booking) throw new Error(`Booking ${bookingId} not found.`);
  if (booking.status === 'cancelled' || booking.status === 'checked_out') {
    throw new Error(`Cannot cancel a ${booking.status} booking.`);
  }

  const refund = computeRefund({
    agreedPropertyCents: booking.agreed_property_cents,
    agreedCleaningCents: booking.agreed_cleaning_cents,
    checkInDate: booking.date_check_in,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE bookings SET status = 'cancelled' WHERE id = $1`,
      [bookingId],
    );

    await client.query(
      `INSERT INTO booking_cancellations (
         booking_id, cancelled_by, reason, refund_amount_cents, policy_applied
       ) VALUES ($1, $2::cancelled_by, $3, $4, $5)`,
      [bookingId, cancelled_by, reason, refund.refundAmountCents, refund.policyApplied],
    );

    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, 'booking.cancelled', $2::jsonb)`,
      [
        bookingId,
        JSON.stringify({
          cancelled_by,
          reason,
          refund_amount_cents: refund.refundAmountCents,
          policy_applied: refund.policyApplied,
          days_before_check_in: refund.daysBeforeCheckIn,
        }),
      ],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  revalidateForBooking(bookingId, booking.user_id);
}
