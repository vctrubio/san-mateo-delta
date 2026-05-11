// Formatting helpers shared across server + client. Pure functions only —
// nothing here should pull in React or other client-only modules so this can
// be imported from server components, server actions, and client components
// without a 'use client' boundary fight.

/** "€4.620" — euros from cents, no fractional digits, Spanish grouping
 *  (matches the locale used elsewhere in the app). */
export function eur(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** "Cash" / "Stripe" / fallback to the raw string. The DB enum is lowercase
 *  but most prose contexts want a Title-Case noun — translate at the edge. */
export function paymentMethodLabel(method: string | null | undefined): string {
  if (method === 'cash')   return 'Cash';
  if (method === 'stripe') return 'Stripe';
  return method ?? 'Payment';
}

/** "14:30" — 24h time-of-day from an ISO timestamp string. Returns "—" for
 *  null/invalid input so consumers don't have to guard. */
export function fmtTime(input: string | Date | null | undefined): string {
  if (input == null) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
