'use server';

import { revalidatePath } from 'next/cache';
import { pool } from '@db/client';

// ============================================================================
// Invitations — admin issues a booking with custom snapshot pricing for
// friends & family. The booking carries status='invite' and the agreed_*
// columns are admin-supplied (not returned by computeQuote).
//
// Creation flows through `createAdminBooking` in actions/bookings.ts (called
// from SelectionActionModal's booking view when status='invite'); this file
// owns only the revoke path.
//
// docs/invitations.md describes the lifecycle in full.
// ============================================================================

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
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

  revalidatePath('/admin/users');
  revalidatePath('/admin/bookings');
  revalidatePath(`/admin/bookings/${inv.booking_id}`);
  if (inv.user_id) revalidatePath(`/admin/users/${inv.user_id}`);
}
