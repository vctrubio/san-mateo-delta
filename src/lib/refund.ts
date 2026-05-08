// Refund policy. See db/refund.md for the full spec.
//
// Edit DEFAULT_REFUND_POLICY below to change the policy. Past cancellations
// snapshot their numbers into booking_cancellations.refund_amount_cents at
// cancellation time, so policy edits never alter history.

export type RefundTier = {
  /** Stay must be at least this many days away to qualify for this tier. */
  daysBefore: number;
  /** Whole percent (0–100). */
  refundPercent: number;
};

export type RefundPolicy = readonly RefundTier[];

// Tiers are evaluated highest daysBefore first. Always end with a 0-day floor.
export const DEFAULT_REFUND_POLICY: RefundPolicy = [
  { daysBefore: 15, refundPercent: 100 },
  { daysBefore: 7,  refundPercent: 50 },
  { daysBefore: 0,  refundPercent: 0 },
];

export type RefundResult = {
  refundAmountCents: number;
  /** Human-readable label of the tier that fired, stored in booking_cancellations.policy_applied. */
  policyApplied: string;
  /** Days between cancellation date and check-in. Negative if cancellation is after check-in. */
  daysBeforeCheckIn: number;
};

export function computeRefund(args: {
  agreedPropertyCents: number;
  agreedCleaningCents: number;
  /** YYYY-MM-DD */
  checkInDate: string;
  /** When the cancellation is being processed; defaults to now. */
  cancelledAt?: Date;
  policy?: RefundPolicy;
}): RefundResult {
  const policy = [...(args.policy ?? DEFAULT_REFUND_POLICY)].sort(
    (a, b) => b.daysBefore - a.daysBefore,
  );
  const cancelledAt = args.cancelledAt ?? new Date();
  const checkInMs = Date.parse(args.checkInDate + 'T00:00:00Z');
  const daysBefore = Math.floor((checkInMs - cancelledAt.getTime()) / 86_400_000);

  const total = args.agreedPropertyCents + args.agreedCleaningCents;

  for (const tier of policy) {
    if (daysBefore >= tier.daysBefore) {
      return {
        refundAmountCents: Math.round((total * tier.refundPercent) / 100),
        policyApplied: `${tier.refundPercent}% (${
          tier.daysBefore === 0 ? '<7 days' : `≥${tier.daysBefore} days`
        } before check-in)`,
        daysBeforeCheckIn: daysBefore,
      };
    }
  }
  // Should not reach here if a 0-day tier exists, but be safe.
  return {
    refundAmountCents: 0,
    policyApplied: 'no tier matched',
    daysBeforeCheckIn: daysBefore,
  };
}
