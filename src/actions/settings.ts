'use server';

import { revalidatePath } from 'next/cache';
import { pool } from '@db/client';
import { isValidPolicyKey } from '@/lib/payment';

// ============================================================================
// updateActivePaymentPolicy — flips the estate-wide active payment policy
// preset on `system_settings`. Called from `/admin/payments` form action.
// Existing bookings are unaffected: each booking row carries its own
// snapshot in `bookings.payment_policy` frozen at creation.
//
// Returns void so it slots directly into <form action={...}>. Invalid input
// throws (Next.js surfaces it on the page) rather than silently no-op.
// ============================================================================

export async function updateActivePaymentPolicy(formData: FormData): Promise<void> {
  const raw = formData.get('key');
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('Missing policy key.');
  }
  const key = raw.trim();
  if (!isValidPolicyKey(key)) {
    throw new Error(`Unknown payment policy preset: ${key}.`);
  }

  await pool.query(
    `UPDATE system_settings
        SET active_payment_policy_key = $1
      WHERE id = 1`,
    [key],
  );

  // Every surface that derives copy or amounts from the active policy.
  revalidatePath('/admin');
  revalidatePath('/admin/payments');
  revalidatePath('/finca');
  revalidatePath('/finca/[slug]', 'page');
  revalidatePath('/');
}
