// Estate-wide payment policy — pure module. No DB, no React. Importable
// from server actions, client components, and seed scripts alike.
//
// Vocabulary: four named presets. Both the /admin/payments switch and the
// per-booking admin override (SelectionActionModal) pick from this exact
// list — no free-form numbers anywhere in the UI.
//
//   split_14 → 50% on booking · balance 14 days before · stripe   (default)
//   split_7  → 50% on booking · balance  7 days before · stripe
//   full_now → 100% upfront                            · stripe
//   cash     → 0% on booking · pay on arrival          · cash
//
// At booking creation the requested policy gets RESOLVED against the
// check-in date — see `resolvePolicy`. If a split policy was picked but
// the booking is closer than its `balance_days_before` window, we collapse
// to 100% upfront (same method) and surface a plain-English reason. The
// resolved policy is then snapshotted onto the booking row (immutable for
// the lifetime of the booking).
//
// See docs/payment.md for the full spec.

export type PaymentMethod = 'stripe' | 'cash';

export type PaymentPolicy = {
  /** 0..100. Percent of agreed_total due at booking. */
  deposit_pct: number;
  /** ≥0. Days before check_in the balance must clear. Ignored when deposit_pct === 100. */
  balance_days_before: number;
  /** How the money moves. `stripe` = card via Checkout; `cash` = admin records on arrival. */
  method: PaymentMethod;
};

export type PaymentPolicyKey = 'split_14' | 'split_7' | 'full_now' | 'cash';

export const PAYMENT_POLICY_KEYS = ['split_14', 'split_7', 'full_now', 'cash'] as const satisfies readonly PaymentPolicyKey[];

export const PAYMENT_PRESETS: Record<PaymentPolicyKey, {
  key: PaymentPolicyKey;
  label: string;
  description: string;
  policy: PaymentPolicy;
}> = {
  split_14: {
    key: 'split_14',
    label: '50% now · balance 14 days before',
    description: 'Standard split. Half the total clears on Stripe at booking, the rest 14 days before arrival.',
    policy: { deposit_pct: 50, balance_days_before: 14, method: 'stripe' },
  },
  split_7: {
    key: 'split_7',
    label: '50% now · balance 7 days before',
    description: 'Same split, tighter balance window. Useful when bookings are typically last-minute.',
    policy: { deposit_pct: 50, balance_days_before: 7, method: 'stripe' },
  },
  full_now: {
    key: 'full_now',
    label: '100% upfront · card',
    description: 'Full payment cleared at booking. No outstanding balance to chase later.',
    policy: { deposit_pct: 100, balance_days_before: 0, method: 'stripe' },
  },
  cash: {
    key: 'cash',
    label: '0% now · pay on arrival in cash',
    description: "No card collected at booking. Admin records the guest's cash payment when they arrive.",
    policy: { deposit_pct: 0, balance_days_before: 0, method: 'cash' },
  },
};

/** Fallback if `system_settings` can't be read (DB unavailable, fresh schema). */
export const FALLBACK_POLICY_KEY: PaymentPolicyKey = 'split_14';

export function isValidPolicyKey(v: unknown): v is PaymentPolicyKey {
  return typeof v === 'string' && (PAYMENT_POLICY_KEYS as readonly string[]).includes(v);
}

/** Coerce any string to a known preset. Unknown / missing input → FALLBACK_POLICY_KEY. */
export function getPresetByKey(key: string | null | undefined): { key: PaymentPolicyKey; policy: PaymentPolicy } {
  if (isValidPolicyKey(key)) {
    return { key, policy: PAYMENT_PRESETS[key].policy };
  }
  return { key: FALLBACK_POLICY_KEY, policy: PAYMENT_PRESETS[FALLBACK_POLICY_KEY].policy };
}

// ---------------------------------------------------------------------------
// Resolver — applies the "too-close" rule.
// ---------------------------------------------------------------------------

export type ResolvedPolicy = {
  /** What the booking actually pays — what gets snapshotted on bookings.payment_policy. */
  effective: PaymentPolicy;
  /** What was originally picked (estate-wide default OR admin override). */
  requested: PaymentPolicy;
  /** True when the too-close rule fired and `effective` differs from `requested`. */
  collapsed: boolean;
  /** Plain-English reason shown to the user when `collapsed` is true. */
  collapseReason?: string;
};

/**
 * Resolve a requested policy against a check-in date.
 *
 * If the policy is already simple (deposit_pct ∈ {0, 100}) we pass it
 * through. If it's a split (e.g. 50/14) but check-in is closer than
 * `balance_days_before`, we collapse to 100%/0/same-method so the booking
 * isn't sitting on an impossible "balance due 14 days before check-in
 * which is in 4 days" schedule.
 *
 * Both dates are YYYY-MM-DD, evaluated in local time.
 */
export function resolvePolicy(
  requested: PaymentPolicy,
  checkInYmd: string,
  todayYmd: string,
): ResolvedPolicy {
  const daysUntil = daysBetweenYmd(todayYmd, checkInYmd);

  // Already simple — nothing to collapse.
  if (requested.deposit_pct === 0 || requested.deposit_pct === 100) {
    return { effective: requested, requested, collapsed: false };
  }

  // Split policy but check-in is sooner than the balance window can clear.
  if (daysUntil < requested.balance_days_before) {
    const effective: PaymentPolicy = {
      deposit_pct: 100,
      balance_days_before: 0,
      method: requested.method,
    };
    const dayWord = daysUntil === 1 ? 'day' : 'days';
    return {
      effective,
      requested,
      collapsed: true,
      collapseReason: daysUntil <= 0
        ? `Check-in is today or earlier; full payment is due now.`
        : `Check-in is in ${daysUntil} ${dayWord}; balance can't clear ${requested.balance_days_before} days before arrival.`,
    };
  }

  return { effective: requested, requested, collapsed: false };
}

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------

/** EUR cents due at booking under the given policy. Always rounds half-up. */
export function computeDepositCents(totalCents: number, policy: PaymentPolicy): number {
  return Math.round((totalCents * policy.deposit_pct) / 100);
}

/**
 * YYYY-MM-DD on which the balance must clear. Returns `checkInYmd` when
 * `deposit_pct === 100` (no balance) or `balance_days_before === 0`.
 */
export function balanceDueDate(checkInYmd: string, policy: PaymentPolicy): string {
  if (policy.deposit_pct === 100) return checkInYmd;
  if (policy.balance_days_before <= 0) return checkInYmd;
  return addDaysYmdLocal(checkInYmd, -policy.balance_days_before);
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** One-line plain-English summary of the policy. Reused by PricingCard,
 *  JustBookedBanner, debug panels, and any future digest. */
export function describePolicy(policy: PaymentPolicy): string {
  if (policy.deposit_pct === 0) {
    return policy.method === 'cash'
      ? 'Pay on arrival in cash. No card required at booking.'
      : 'No deposit. Full payment due before arrival.';
  }
  if (policy.deposit_pct === 100) {
    return 'Full payment due at booking.';
  }
  const balanceCopy = policy.balance_days_before === 0
    ? 'Balance on arrival.'
    : `Balance ${policy.balance_days_before} days before arrival.`;
  return `${policy.deposit_pct}% on booking. ${balanceCopy}`;
}

/** True when the guest's submit flow should open Stripe Checkout. False when
 *  the booking should be inserted with no card collected (cash on arrival,
 *  or a 0%-deposit policy). */
export function chargesCardAtBooking(policy: PaymentPolicy): boolean {
  return policy.deposit_pct > 0 && policy.method === 'stripe';
}

// ---------------------------------------------------------------------------
// Internal date helpers — keep this module pure (no `@/lib/dates` import so
// it stays trivially importable from anywhere, including seed scripts).
//
// All math is in UTC. Local-time math is wrong here: across a DST
// transition the day delta loses an hour and Math.floor rounds it down,
// turning a 14-day window into 13 and spuriously firing the too-close
// collapse for bookings made exactly 14 days before check-in. UTC midnight
// + Math.round on the day delta is exact for calendar arithmetic.
// ---------------------------------------------------------------------------

function parseYmdUtc(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmtYmdUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function addDaysYmdLocal(ymd: string, days: number): string {
  const d = parseYmdUtc(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return fmtYmdUtc(d);
}

/** Whole calendar days from `fromYmd` to `toYmd`. Negative when `toYmd` is
 *  in the past. UTC math so DST transitions don't shave the delta. */
function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const from = parseYmdUtc(fromYmd).getTime();
  const to = parseYmdUtc(toYmd).getTime();
  return Math.round((to - from) / 86_400_000);
}
