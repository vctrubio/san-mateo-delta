'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { pool } from '@db/client';
import type { BookingStatus, CancelledBy, PaymentType } from '@db/enums';
import { computeQuote, type Quote } from '@/lib/bookings';
import { computeRefund } from '@/lib/refund';
import { todayYmd } from '@/lib/dates';
import { getActivePaymentPolicy } from '@/lib/systemSettings';
import { getPresetByKey, resolvePolicy } from '@/lib/payment';

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

// Optional integer — returns null when the field is missing or unparseable,
// rather than collapsing to a fallback. Lets callers tell "not provided"
// apart from "explicitly zero".
function strInt(form: FormData, key: string): number | null {
  const v = form.get(key);
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
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
  revalidatePath('/admin/payments');
  if (userId) {
    revalidatePath(`/user/${userId}`);
    revalidatePath(`/admin/users/${userId}`);
  }
}

// ---------------------------------------------------------------------------
// requestBooking — entry point from /book (the single guest reservation
// surface). Invoked by ReservationForm.submit via useReservation; the form
// data is assembled by buildRequestBookingFormData(ctx, state).
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

  // Resolve the estate-wide active policy against this booking's check-in
  // date. If a split policy was active but check-in is too close for the
  // balance window to clear, `resolvePolicy` collapses to 100% upfront.
  // The effective policy is what gets frozen on the booking row.
  const activePolicy = await getActivePaymentPolicy();
  const resolved = resolvePolicy(activePolicy.policy, check_in, todayYmd());

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
    const policyJson = JSON.stringify(resolved.effective);
    const bookingRows = await client.query<{ id: string }>(
      `INSERT INTO bookings (
         property_id, user_id, date_check_in, date_check_out,
         agreed_property_cents, agreed_cleaning_cents,
         status, guests, payment_policy
       ) VALUES (
         $1, $2, $3::date, $4::date,
         $5, $6,
         'request', $7::jsonb, $8::jsonb
       )
       RETURNING id::text AS id`,
      [
        property.id, userId, check_in, check_out,
        quote.agreed_property_cents, quote.agreed_cleaning_cents,
        guestsJson, policyJson,
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

    // Payments are inserted by Stripe (`createCheckoutSession` adds the
    // pending Stripe row right after this commits, the webhook flips it to
    // succeeded) or by admin recording cash from the booking detail page.
    // Guests never pay cash through this form — the public path is
    // card-only. So no payment row gets inserted here.

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
// createAdminBooking — admin issues a booking directly from the calendar
// selection modal. The only "admin booking" entry point — friend-and-family
// invitations also go through here with status='invite'.
//
// Two notable behaviours:
//   1. The user is OPTIONAL — admin can hold dates without attaching anyone
//      yet (user_id stays NULL; the schema allows it).
//   2. An optional initial booking_payment row can be inserted in the same
//      tx — used when admin is recording a cash deposit / full pre-payment.
//
// Status is restricted to 'invite' (requires user) or 'confirmed' (locks
// dates via the EXCLUDE constraint). 'request' is the public-form state and
// not exposed here.
// ---------------------------------------------------------------------------

type CreateAdminBookingResult =
  | { ok: true; bookingId: string; userId: string | null; paymentId: string | null }
  | { ok: false; error: string };

export async function createAdminBooking(formData: FormData): Promise<CreateAdminBookingResult> {
  const slug = str(formData, 'slug');
  const check_in = str(formData, 'check_in');
  const check_out = str(formData, 'check_out');
  const email = normaliseEmail(str(formData, 'email'));
  const name = str(formData, 'name');
  const tif = str(formData, 'tif');
  const nationality = str(formData, 'nationality');

  const agreed_property_cents = strInt(formData, 'agreed_property_cents');
  const agreed_cleaning_cents = strInt(formData, 'agreed_cleaning_cents');

  const status = str(formData, 'status') as BookingStatus | null;
  const time_check_in = str(formData, 'time_check_in');
  const time_check_out = str(formData, 'time_check_out');

  const payment_amount_cents = strInt(formData, 'payment_amount_cents');
  const payment_type = (str(formData, 'payment_type') ?? 'reservation') as PaymentType;
  const payment_policy_key = str(formData, 'payment_policy_key');

  if (!slug)         return { ok: false, error: 'Property slug missing.' };
  if (!check_in || !check_out) return { ok: false, error: 'Both check-in and check-out dates required.' };
  if (status !== 'invite' && status !== 'confirmed') {
    return { ok: false, error: "status must be 'invite' or 'confirmed'." };
  }
  if (status === 'invite' && (!email || !name)) {
    return { ok: false, error: "'invite' status requires both email and name." };
  }
  if (email && !name) {
    return { ok: false, error: 'Name required when email is provided.' };
  }
  if (agreed_property_cents == null || agreed_property_cents < 0) {
    return { ok: false, error: 'agreed_property_cents must be a non-negative integer (cents).' };
  }
  if (agreed_cleaning_cents == null || agreed_cleaning_cents < 0) {
    return { ok: false, error: 'agreed_cleaning_cents must be a non-negative integer (cents).' };
  }
  if (payment_amount_cents != null && payment_amount_cents < 0) {
    return { ok: false, error: 'payment_amount_cents must be non-negative.' };
  }

  const adults = int(formData, 'adults', 2);
  const children = int(formData, 'children', 0);
  const infants = int(formData, 'infants', 0);
  const pets = int(formData, 'pets', 0);

  const props = await pool.query<{ id: string; max_guests: number }>(
    `SELECT id::text, max_guests::int FROM properties WHERE slug = $1`,
    [slug],
  );
  const property = props.rows[0];
  if (!property) return { ok: false, error: `Unknown property: ${slug}` };
  if (adults + children + infants > property.max_guests) {
    return { ok: false, error: `This property sleeps ${property.max_guests}; party of ${adults + children + infants} exceeds it.` };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert user only if email was provided. Otherwise booking is a "ghost"
    // admin booking with user_id=NULL — useful for holding dates ahead of
    // attribution (e.g. friend-of-friend who'll send their details later).
    let userId: string | null = null;
    if (email && name) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO users (name, email, tif, nationality)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE
           SET name = COALESCE(EXCLUDED.name, users.name),
               tif = COALESCE(EXCLUDED.tif, users.tif),
               nationality = COALESCE(EXCLUDED.nationality, users.nationality)
         RETURNING id::text AS id`,
        [name, email, tif, nationality],
      );
      userId = rows[0].id;
    }

    // The exclusion constraint only fires for held statuses. Pre-check inside
    // the tx (row-locking) to surface a clean error rather than a raw
    // constraint violation, regardless of the target status.
    const overlapCheck = await client.query<{ id: string; status: string }>(
      `SELECT id::text, status::text
         FROM bookings
        WHERE property_id = $1
          AND status IN ('confirmed','checked_in','checked_out')
          AND daterange(date_check_in, date_check_out, '[)') &&
              daterange($2::date, $3::date, '[)')
        FOR UPDATE`,
      [property.id, check_in, check_out],
    );
    if (overlapCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      const conflict = overlapCheck.rows[0];
      return { ok: false, error: `Dates overlap held booking #${conflict.id} (${conflict.status}).` };
    }

    // Resolve the payment policy for this booking. Admin may override the
    // estate-wide default via the preset picker on SelectionActionModal
    // (payment_policy_key); when absent we fall back to whatever is active
    // in system_settings. Either way the policy is resolved against the
    // check-in date (too-close → collapse to 100% upfront).
    const requestedPolicy = payment_policy_key
      ? getPresetByKey(payment_policy_key).policy
      : (await getActivePaymentPolicy()).policy;
    const resolved = resolvePolicy(requestedPolicy, check_in, todayYmd());
    const policyJson = JSON.stringify(resolved.effective);

    const guestsJson = JSON.stringify({ adults, children, infants, pets });
    const { rows: bookingRows } = await client.query<{ id: string }>(
      `INSERT INTO bookings (
         property_id, user_id, date_check_in, date_check_out,
         agreed_property_cents, agreed_cleaning_cents,
         status, guests, payment_policy, time_check_in, time_check_out
       ) VALUES (
         $1, $2, $3::date, $4::date,
         $5, $6,
         $7::booking_status, $8::jsonb, $9::jsonb,
         $10::timestamptz, $11::timestamptz
       )
       RETURNING id::text AS id`,
      [
        property.id, userId, check_in, check_out,
        agreed_property_cents, agreed_cleaning_cents,
        status, guestsJson, policyJson,
        time_check_in, time_check_out,
      ],
    );
    const bookingId = bookingRows[0].id;

    // When status='invite' we also write a booking_invitations row so the
    // /admin/users Invitations section can list it and the future accept
    // flow has somewhere to update.
    if (status === 'invite' && email && userId) {
      await client.query(
        `INSERT INTO booking_invitations (booking_id, email, status)
         VALUES ($1, $2, 'invited'::invitation_status)`,
        [bookingId, email],
      );
    }

    // Optional initial payment — registered as cash + succeeded by default.
    // Use case: admin already collected money in person and is recording it.
    let paymentId: string | null = null;
    if (payment_amount_cents != null && payment_amount_cents > 0) {
      const { rows: payRows } = await client.query<{ id: string }>(
        `INSERT INTO booking_payments
           (booking_id, type, amount_cents, method, status)
         VALUES ($1, $2::payment_type, $3, 'cash', 'succeeded')
         RETURNING id::text AS id`,
        [bookingId, payment_type, payment_amount_cents],
      );
      paymentId = payRows[0].id;
    }

    // Audit trail. Snapshot the default-vs-custom delta so future-us can see
    // how aggressive the admin override was; computed best-effort.
    let defaultPropertyCents: number | null = null;
    let defaultCleaningCents: number | null = null;
    try {
      const def = await computeQuote({
        propertyId: property.id,
        check_in, check_out,
      });
      if (!('error' in def)) {
        defaultPropertyCents = def.agreed_property_cents;
        defaultCleaningCents = def.agreed_cleaning_cents;
      }
    } catch { /* swallow — missing rate isn't fatal here */ }

    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, 'booking.admin_created', $2::jsonb)`,
      [
        bookingId,
        JSON.stringify({
          status,
          has_user: userId !== null,
          email: email ?? null,
          custom_property_cents: agreed_property_cents,
          custom_cleaning_cents: agreed_cleaning_cents,
          default_property_cents: defaultPropertyCents,
          default_cleaning_cents: defaultCleaningCents,
          time_check_in: time_check_in ?? null,
          time_check_out: time_check_out ?? null,
          initial_payment_cents: payment_amount_cents ?? null,
          initial_payment_type: payment_amount_cents ? payment_type : null,
        }),
      ],
    );

    await client.query('COMMIT');

    revalidateForBooking(bookingId, userId);
    revalidatePath('/admin/users');

    return { ok: true, bookingId, userId, paymentId };
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

// ---------------------------------------------------------------------------
// previewQuote — UI-only helper for the public booking calendar. Same algorithm
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

  const cur = await pool.query<{ status: BookingStatus; user_id: string | null; date_check_in: string }>(
    `SELECT status::text AS status, user_id::text AS user_id, date_check_in::text AS date_check_in
       FROM bookings WHERE id = $1`,
    [bookingId],
  );
  const current = cur.rows[0];
  if (!current) throw new Error(`Booking ${bookingId} not found.`);
  const allowed = TRANSITIONS[current.status];
  if (!allowed.includes(to)) {
    throw new Error(`Cannot transition ${current.status} → ${to}.`);
  }

  // Hard rule from docs/admin-notifications.md: check-in only on the
  // booked date. Without this, admins can backdate-check-in stale bookings
  // and flood the `checked_in_unpaid` notification. If admin needs to
  // check a guest in early/late, they adjust date_check_in first
  // (UI for that is a follow-up — see docs/bugs.md).
  if (to === 'checked_in' && current.date_check_in !== todayYmd()) {
    throw new Error(
      `Cannot check in: booking is for ${current.date_check_in}, today is ${todayYmd()}. ` +
      `Adjust the check-in date first, or cancel the booking.`,
    );
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

// ---------------------------------------------------------------------------
// updateBookingTime — admin manually adjusts time_check_in / time_check_out.
// These columns are normally auto-stamped by `transitionStatus` (when admin
// clicks the Check-in / Check-out tile), but the actual arrival/departure
// often differs from when the click happened — guest arrives late, admin
// remembers to mark check-out the next morning, etc. This action lets admin
// rewrite the stamp without changing booking status.
//
// Pass an empty `value` to clear the column back to NULL.
// ---------------------------------------------------------------------------

type UpdateBookingTimeResult =
  | { ok: true; bookingId: string; field: 'check_in' | 'check_out'; value: string | null }
  | { ok: false; error: string };

export async function updateBookingTime(formData: FormData): Promise<UpdateBookingTimeResult> {
  const bookingId = str(formData, 'booking_id');
  const field     = str(formData, 'field') as 'check_in' | 'check_out' | null;
  const raw       = formData.get('value');
  const value     = typeof raw === 'string' ? raw.trim() : '';

  if (!bookingId) return { ok: false, error: 'booking_id required' };
  if (field !== 'check_in' && field !== 'check_out') {
    return { ok: false, error: "field must be 'check_in' or 'check_out'" };
  }

  // Empty string → clear. Otherwise parse + validate.
  let iso: string | null = null;
  if (value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: `Invalid timestamp: ${value}` };
    }
    iso = parsed.toISOString();
  }

  const cur = await pool.query<{ user_id: string | null }>(
    `SELECT user_id::text AS user_id FROM bookings WHERE id = $1`,
    [bookingId],
  );
  if (cur.rows.length === 0) return { ok: false, error: `Booking ${bookingId} not found.` };

  const column = field === 'check_in' ? 'time_check_in' : 'time_check_out';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE bookings SET ${column} = $1::timestamptz WHERE id = $2`,
      [iso, bookingId],
    );
    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, 'booking.time_updated', $2::jsonb)`,
      [bookingId, JSON.stringify({ field, value: iso })],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  } finally {
    client.release();
  }

  revalidateForBooking(bookingId, cur.rows[0].user_id);
  return { ok: true, bookingId, field, value: iso };
}

// ---------------------------------------------------------------------------
// assignUserToBooking — attach an existing user to a ghost booking
// (user_id IS NULL). Only ghost bookings are candidates: once a booking has
// a user, swapping users would scramble accounting + audit semantics, so we
// reject re-assignment outright.
// ---------------------------------------------------------------------------

type AssignUserResult =
  | { ok: true; bookingId: string; userId: string }
  | { ok: false; error: string };

export async function assignUserToBooking(formData: FormData): Promise<AssignUserResult> {
  const bookingId = str(formData, 'booking_id');
  const userId = str(formData, 'user_id');
  if (!bookingId) return { ok: false, error: 'booking_id required' };
  if (!userId)    return { ok: false, error: 'user_id required'    };

  const cur = await pool.query<{ user_id: string | null; status: string }>(
    `SELECT user_id::text AS user_id, status::text AS status FROM bookings WHERE id = $1`,
    [bookingId],
  );
  const booking = cur.rows[0];
  if (!booking)              return { ok: false, error: `Booking ${bookingId} not found.` };
  if (booking.user_id)       return { ok: false, error: 'Booking already has a user attached.' };
  if (booking.status === 'cancelled') {
    return { ok: false, error: 'Cannot attach a user to a cancelled booking.' };
  }

  const userCheck = await pool.query<{ id: string }>(
    `SELECT id::text FROM users WHERE id = $1`,
    [userId],
  );
  if (userCheck.rows.length === 0) {
    return { ok: false, error: `User ${userId} not found.` };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE bookings SET user_id = $1 WHERE id = $2`,
      [userId, bookingId],
    );
    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, 'booking.user_assigned', $2::jsonb)`,
      [bookingId, JSON.stringify({ user_id: userId, source: 'admin' })],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  } finally {
    client.release();
  }

  revalidateForBooking(bookingId, userId);
  return { ok: true, bookingId, userId };
}
