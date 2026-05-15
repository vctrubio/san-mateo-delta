import 'server-only';
import { sql } from '@db/client';
import {
  FALLBACK_POLICY_KEY,
  PAYMENT_PRESETS,
  getPresetByKey,
  type PaymentPolicy,
  type PaymentPolicyKey,
} from './payment';

// ============================================================================
// systemSettings — singleton-row config that admin flips at runtime from
// `/admin/payments`. Read by:
//   - server actions (requestBooking, createAdminBooking) when snapshotting
//     the policy onto a new booking row
//   - the `/finca/[slug]` server page when rendering the guest receipt
//   - the `/admin/payments` server page when highlighting the active card
//
// The row's existence is guaranteed by `INSERT INTO system_settings (id)
// VALUES (1)` in schema.sql. If the row is missing or holds an unknown key
// we fall back to FALLBACK_POLICY_KEY so the app keeps working on a half-
// migrated DB; the caller still gets a valid policy.
// ============================================================================

type Row = {
  active_payment_policy_key: string;
  updated_at: string;
};

export type ActivePolicy = {
  key: PaymentPolicyKey;
  policy: PaymentPolicy;
  /** ISO timestamp of the most recent /admin/payments change. */
  updated_at: string | null;
};

export async function getActivePaymentPolicy(): Promise<ActivePolicy> {
  const rows = await sql<Row>(
    `SELECT active_payment_policy_key, updated_at::text AS updated_at
       FROM system_settings
      WHERE id = 1
      LIMIT 1`,
  );
  const row = rows[0];
  if (!row) {
    return {
      key: FALLBACK_POLICY_KEY,
      policy: PAYMENT_PRESETS[FALLBACK_POLICY_KEY].policy,
      updated_at: null,
    };
  }
  const { key, policy } = getPresetByKey(row.active_payment_policy_key);
  return { key, policy, updated_at: row.updated_at };
}
