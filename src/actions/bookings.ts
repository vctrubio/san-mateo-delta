'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { pool } from '@db/client';
import type { BookingStatus } from '@db/enums';
import { computeQuote } from '@/lib/bookings';

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

// ---------------------------------------------------------------------------
// requestBooking — entry point from /finca/[slug] BookNowForm.
// Upserts the user, computes the quote, inserts booking + first event.
// On success, redirects to /user/[userId].
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

  // Use a transaction so a constraint failure doesn't leave an orphan user with no booking.
  // (We still keep the user in pre-existing rows by ON CONFLICT; only NEW rows get rolled back.)
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
         agreed_price_cents, status, guests
       ) VALUES (
         $1, $2, $3::date, $4::date,
         $5, 'request', $6::jsonb
       )
       RETURNING id::text AS id`,
      [property.id, userId, check_in, check_out, quote.agreed_price_cents, guestsJson],
    );
    const bookingId = bookingRows.rows[0].id;

    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, 'booking.created', $2::jsonb)`,
      [
        bookingId,
        JSON.stringify({
          rate_id: quote.rate_id,
          rate_name: quote.rate_name,
          nights: quote.nights,
          night_rate_cents: quote.night_rate_cents,
          cleaning_fee_cents: quote.cleaning_fee_cents,
        }),
      ],
    );

    await client.query('COMMIT');

    revalidatePath('/admin');
    revalidatePath('/admin/bookings');
    revalidatePath(`/user/${userId}`);
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
// transitionStatus — admin one-click transitions.
// Guarded; throws on invalid transitions.
// ---------------------------------------------------------------------------

const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  request:     ['confirmed', 'cancelled'],
  invite:      ['confirmed', 'cancelled'],
  confirmed:   ['checked_in', 'cancelled'],
  checked_in:  ['checked_out'],
  checked_out: [],
  cancelled:   [],
};

export async function transitionStatus(formData: FormData): Promise<void> {
  const bookingId = str(formData, 'booking_id');
  const to = str(formData, 'to') as BookingStatus | null;
  const reason = str(formData, 'reason');
  if (!bookingId || !to) throw new Error('Missing booking_id or target status.');

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
  if (to === 'cancelled') {
    setFragments.push(`cancelled_at = $${++p}`);          params.push(now);
    setFragments.push(`cancellation_reason = $${++p}`);   params.push(reason);
  }
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
      [
        bookingId,
        `booking.${to}`,
        JSON.stringify({ from: current.status, to, reason: reason ?? undefined }),
      ],
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
  if (current.user_id) revalidatePath(`/user/${current.user_id}`);
}
