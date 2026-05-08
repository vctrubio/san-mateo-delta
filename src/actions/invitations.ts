'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { pool } from '@db/client';
import { computeQuote, type Quote } from '@/lib/bookings';

// ============================================================================
// Invitations — admin issues a booking with custom snapshot pricing for
// friends & family. The booking carries status='invite' and the agreed_*
// columns are admin-supplied (not returned by computeQuote).
//
// createInvitation     — atomic: upsert user + insert booking + insert
//                        booking_invitations. Re-checks date overlap inside
//                        the tx so we don't double-book held dates.
// revokeInvitation     — flips booking → cancelled and invitation → declined.
// previewInviteQuote   — surfaces what computeQuote would have returned, so
//                        the admin form can show "default vs custom" diff.
//
// docs/invitations.md describes the lifecycle in full.
// ============================================================================

type CreateInvitationResult =
  | { ok: true; invitationId: string; bookingId: string; userId: string }
  | { ok: false; error: string };

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function int(form: FormData, key: string): number | null {
  const v = form.get(key);
  if (typeof v !== 'string') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function normaliseEmail(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

// ---------------------------------------------------------------------------
// previewInviteQuote — for the admin form's "default" column.
// Returns either the would-be Quote or an error if no rate is configured for
// the check-in month. The rate engine is now just a JSONB lookup — there's
// no public/private split, so no flag is needed here.
// ---------------------------------------------------------------------------

export async function previewInviteQuote(args: {
  slug: string;
  check_in: string;
  check_out: string;
}): Promise<{ ok: true; quote: Quote } | { ok: false; error: string }> {
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
// createInvitation — the workhorse.
// ---------------------------------------------------------------------------

export async function createInvitation(formData: FormData): Promise<CreateInvitationResult> {
  const slug = str(formData, 'slug');
  const check_in = str(formData, 'check_in');
  const check_out = str(formData, 'check_out');
  const email = normaliseEmail(str(formData, 'email'));
  const name = str(formData, 'name');
  const tif = str(formData, 'tif');
  const nationality = str(formData, 'nationality');
  const dob = str(formData, 'dob');

  // Custom prices arrive as integer cents straight from the form. Both
  // required so the snapshot is unambiguous (admin can set 0 explicitly for
  // "free stay, no cleaning fee").
  const agreed_property_cents = int(formData, 'agreed_property_cents');
  const agreed_cleaning_cents = int(formData, 'agreed_cleaning_cents');

  if (!slug)        return { ok: false, error: 'Property required.' };
  if (!check_in || !check_out) return { ok: false, error: 'Both check-in and check-out dates required.' };
  if (!email)       return { ok: false, error: 'Valid email required.' };
  if (!name)        return { ok: false, error: 'Guest name required.' };
  if (agreed_property_cents == null || agreed_property_cents < 0) {
    return { ok: false, error: 'agreed_property_cents must be a non-negative integer (cents).' };
  }
  if (agreed_cleaning_cents == null || agreed_cleaning_cents < 0) {
    return { ok: false, error: 'agreed_cleaning_cents must be a non-negative integer (cents).' };
  }

  // Adults default to 2 (admin can override). Optional.
  const adults = int(formData, 'adults') ?? 2;
  const children = int(formData, 'children') ?? 0;
  const infants = int(formData, 'infants') ?? 0;
  const pets = int(formData, 'pets') ?? 0;

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

    // Upsert the invitee user, keyed on email. Same pattern as requestBooking.
    const { rows: userRows } = await client.query<{ id: string }>(
      `INSERT INTO users (name, email, tif, nationality, dob)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
         SET name = COALESCE(EXCLUDED.name, users.name),
             tif = COALESCE(EXCLUDED.tif, users.tif),
             nationality = COALESCE(EXCLUDED.nationality, users.nationality),
             dob = COALESCE(EXCLUDED.dob, users.dob)
       RETURNING id::text AS id`,
      [name, email, tif, nationality, dob],
    );
    const userId = userRows[0].id;

    const guestsJson = JSON.stringify({ adults, children, infants, pets });

    // Insert booking with status='invite'. Postgres' EXCLUDE constraint on
    // bookings (no_overlap_when_held) doesn't fire for 'invite' status, so
    // we'd be allowed to overlap a held booking — manually re-check inside
    // the tx with a row-locking query first.
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

    const { rows: bookingRows } = await client.query<{ id: string; access_token: string }>(
      `INSERT INTO bookings (
         property_id, user_id, date_check_in, date_check_out,
         agreed_property_cents, agreed_cleaning_cents,
         status, guests
       ) VALUES (
         $1, $2, $3::date, $4::date,
         $5, $6,
         'invite', $7::jsonb
       )
       RETURNING id::text AS id, access_token::text AS access_token`,
      [
        property.id, userId, check_in, check_out,
        agreed_property_cents, agreed_cleaning_cents,
        guestsJson,
      ],
    );
    const bookingId = bookingRows[0].id;

    const { rows: inviteRows } = await client.query<{ id: string }>(
      `INSERT INTO booking_invitations (booking_id, email, status)
       VALUES ($1, $2, 'invited')
       RETURNING id::text AS id`,
      [bookingId, email],
    );
    const invitationId = inviteRows[0].id;

    // Audit: snapshot deviation from the would-be default so future-us can see
    // how aggressive the discount was. Compute alongside (best-effort, swallow
    // errors so a missing rate doesn't break invitation creation).
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
    } catch { /* swallow */ }

    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, 'booking.invited', $2::jsonb)`,
      [
        bookingId,
        JSON.stringify({
          invitation_id: invitationId,
          email,
          custom_property_cents: agreed_property_cents,
          custom_cleaning_cents: agreed_cleaning_cents,
          default_property_cents: defaultPropertyCents,
          default_cleaning_cents: defaultCleaningCents,
        }),
      ],
    );

    await client.query('COMMIT');

    revalidatePath('/admin');
    revalidatePath('/admin/invite');
    revalidatePath('/admin/bookings');
    revalidatePath(`/admin/bookings/${bookingId}`);
    revalidatePath(`/admin/users/${userId}`);

    return { ok: true, invitationId, bookingId, userId };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}

/** Form-friendly: throws on error so the form's catch surfaces it. */
export async function createInvitationAndRedirect(formData: FormData): Promise<void> {
  const result = await createInvitation(formData);
  if (!result.ok) throw new Error(result.error);
  redirect('/admin/invite');
}

// ---------------------------------------------------------------------------
// revokeInvitation — admin pulls a pending invitation. Booking flips to
// 'cancelled', invitation flips to 'declined' (server-initiated decline).
// ---------------------------------------------------------------------------

export async function revokeInvitation(formData: FormData): Promise<void> {
  const invitationId = str(formData, 'invitation_id');
  if (!invitationId) throw new Error('invitation_id required');

  const { rows } = await pool.query<{ booking_id: string; status: string; user_id: string | null }>(
    `SELECT bi.booking_id::text  AS booking_id,
            bi.status::text      AS status,
            b.user_id::text      AS user_id
       FROM booking_invitations bi
       JOIN bookings b ON b.id = bi.booking_id
      WHERE bi.id = $1`,
    [invitationId],
  );
  const inv = rows[0];
  if (!inv) throw new Error(`Invitation ${invitationId} not found.`);
  if (inv.status !== 'invited') throw new Error(`Invitation already ${inv.status}, can't revoke.`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE booking_invitations
          SET status = 'declined',
              responded_at = now()
        WHERE id = $1`,
      [invitationId],
    );
    await client.query(
      `UPDATE bookings SET status = 'cancelled' WHERE id = $1`,
      [inv.booking_id],
    );
    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, 'booking.invitation_revoked', $2::jsonb)`,
      [inv.booking_id, JSON.stringify({ invitation_id: invitationId })],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  revalidatePath('/admin/invite');
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/bookings/${inv.booking_id}`);
  if (inv.user_id) revalidatePath(`/admin/users/${inv.user_id}`);
}
