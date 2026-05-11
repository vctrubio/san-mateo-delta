'use server';

import { revalidatePath } from 'next/cache';
import { pool } from '@db/client';
import type { BookingStatus } from '@db/enums';
import { BLOCKING_BOOKING_STATUSES } from '@/lib/colors';

// ============================================================================
// property_blocks actions.
//
// Block ↔ block overlap is rejected by the gist exclusion constraint on the
// table. Block ↔ confirmed-booking overlap can't be enforced by Postgres
// (cross-table), so createBlock runs an explicit overlap check inside a tx and
// throws a useful, named conflict message if one is found.
// ============================================================================

type CreateBlockResult =
  | { ok: true; blockId: string }
  | { ok: false; error: string };

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function ymdRe(s: string | null): boolean {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function fmtDate(d: string): string {
  // d is YYYY-MM-DD; produce a short label like "Sep 10".
  const date = new Date(`${d}T00:00:00Z`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export async function createBlock(formData: FormData): Promise<CreateBlockResult> {
  const slug = str(formData, 'slug');
  const propertyId = str(formData, 'property_id');
  const start = str(formData, 'date_check_in');
  const end = str(formData, 'date_check_out');
  const reason = str(formData, 'reason');

  if (!propertyId && !slug) return { ok: false, error: 'Missing property reference (slug or property_id).' };
  if (!ymdRe(start)) return { ok: false, error: 'date_check_in must be YYYY-MM-DD.' };
  if (!ymdRe(end))   return { ok: false, error: 'date_check_out must be YYYY-MM-DD.' };
  if (start! >= end!) return { ok: false, error: 'date_check_out must be after date_check_in.' };

  // Resolve propertyId from slug if needed (so the form can pass either).
  let resolvedId = propertyId;
  let resolvedSlug = slug;
  if (!resolvedId) {
    const r = await pool.query<{ id: string; slug: string }>(
      `SELECT id::text, slug FROM properties WHERE slug = $1`,
      [slug],
    );
    if (r.rows.length === 0) return { ok: false, error: `Unknown property slug: ${slug}` };
    resolvedId = r.rows[0].id;
    resolvedSlug = r.rows[0].slug;
  } else if (!resolvedSlug) {
    const r = await pool.query<{ slug: string }>(
      `SELECT slug FROM properties WHERE id = $1`,
      [resolvedId],
    );
    resolvedSlug = r.rows[0]?.slug ?? null;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock any held bookings for this property whose dates overlap [start, end).
    // FOR UPDATE prevents a concurrent confirm from sneaking a held booking in
    // between our check and our insert. Note: `FOR UPDATE OF b` only — Postgres
    // refuses to lock the nullable side of a LEFT JOIN, and admin ghost
    // bookings (user_id NULL) make `users u` nullable here.
    const conflicts = await client.query<{
      id: string;
      status: BookingStatus;
      date_check_in: string;
      date_check_out: string;
      user_name: string | null;
    }>(
      `
      SELECT b.id::text,
             b.status::text         AS status,
             b.date_check_in::text  AS date_check_in,
             b.date_check_out::text AS date_check_out,
             u.name                 AS user_name
        FROM bookings b
        LEFT JOIN users u ON u.id = b.user_id
       WHERE b.property_id = $1
         AND b.status::text = ANY($4::text[])
         AND b.date_check_in  <  $3::date
         AND b.date_check_out >  $2::date
       ORDER BY b.date_check_in ASC
       FOR UPDATE OF b
      `,
      [resolvedId, start, end, [...BLOCKING_BOOKING_STATUSES]],
    );

    if (conflicts.rows.length > 0) {
      await client.query('ROLLBACK');
      const c = conflicts.rows[0];
      const who = c.user_name ?? 'admin booking';
      const dates = `${fmtDate(c.date_check_in)} → ${fmtDate(c.date_check_out)}`;
      const more = conflicts.rows.length > 1 ? ` (and ${conflicts.rows.length - 1} more)` : '';
      return {
        ok: false,
        error: `Cannot block: overlaps booking #${c.id} (${who}, ${dates}, ${c.status})${more}.`,
      };
    }

    let blockId: string;
    try {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO property_blocks (property_id, date_check_in, date_check_out, reason)
         VALUES ($1, $2::date, $3::date, $4)
         RETURNING id::text`,
        [resolvedId, start, end, reason],
      );
      blockId = ins.rows[0].id;
    } catch (err) {
      await client.query('ROLLBACK');
      const msg = err instanceof Error ? err.message : 'Unknown error';
      // exclusion constraint: another block already covers part of this range.
      if (msg.includes('property_blocks_property_id_daterange_excl') || msg.includes('conflicting key value')) {
        return { ok: false, error: 'Cannot block: overlaps an existing block on this property.' };
      }
      return { ok: false, error: msg };
    }

    await client.query('COMMIT');

    if (resolvedSlug) {
      revalidatePath(`/finca/${resolvedSlug}`);
      revalidatePath(`/admin/properties/${resolvedSlug}`);
    }
    revalidatePath('/admin/properties');
    revalidatePath('/admin');

    return { ok: true, blockId };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}

type DeleteBlockResult = { ok: true } | { ok: false; error: string };

export async function deleteBlock(formData: FormData): Promise<DeleteBlockResult> {
  const blockId = str(formData, 'block_id');
  if (!blockId) return { ok: false, error: 'block_id required.' };

  const r = await pool.query<{ slug: string }>(
    `
    DELETE FROM property_blocks pb
     USING properties p
     WHERE pb.property_id = p.id AND pb.id = $1
     RETURNING p.slug
    `,
    [blockId],
  );
  const slug = r.rows[0]?.slug;
  if (!slug) return { ok: false, error: `Block ${blockId} not found.` };

  revalidatePath(`/finca/${slug}`);
  revalidatePath(`/admin/properties/${slug}`);
  revalidatePath('/admin/properties');
  revalidatePath('/admin');

  return { ok: true };
}
