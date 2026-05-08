# Refund policy on cancellation

Single source of truth for the cancellation policy. The numbers below live in code at `src/lib/refund.ts` (`DEFAULT_REFUND_POLICY`) — change them there, the doc table here, and that's it.

## Current policy

| Days before check-in | Refund |
|---|---|
| 15 or more   | **100%** of the booking total |
| 7 to 14      | **50%** of the booking total |
| Less than 7  | **0%** (no refund) |

"Booking total" = `agreed_property_cents + agreed_cleaning_cents`. Both portions scale by the same percent — the cleaning fee is refundable here because if the guest doesn't stay, Tano isn't going to clean. Change the formula in `computeRefund` if you want a different split.

## How it works at runtime

1. Guest or admin clicks "Cancel" on a booking.
2. The `cancelBooking` action runs:
   - Loads `bookings.agreed_property_cents` and `agreed_cleaning_cents` (snapshots from booking time).
   - Calls `computeRefund({ agreedPropertyCents, agreedCleaningCents, checkInDate, cancelledAt })`.
   - Inserts a `booking_cancellations` row with the computed `refund_amount_cents` and the human-readable `policy_applied` label.
   - Sets `bookings.status = 'cancelled'`.
   - Writes a `booking.cancelled` row to `booking_events`.
3. The actual money movement still goes through `payment_refunds` (linked to the original `booking_payments` row). The cancellation row tells you **what we owe**; `payment_refunds` tells you **what we paid back**. Compare them to know whether a refund is owed, partial, or complete.

## Snapshot principle

`booking_cancellations.refund_amount_cents` and `policy_applied` are **frozen at cancellation time**. If the policy changes next month, last week's cancellations keep their original numbers. This matches the project's snapshot rule (see `memory/snapshots_principle.md`).

## Changing the policy

Edit `src/lib/refund.ts`:

```ts
export const DEFAULT_REFUND_POLICY: RefundPolicy = [
  { daysBefore: 15, refundPercent: 100 },
  { daysBefore: 7,  refundPercent:  50 },
  { daysBefore: 0,  refundPercent:   0 },
];
```

Tiers are evaluated highest-`daysBefore` first. The first tier where `daysBefore <= actualDaysBefore` wins. Always include a `daysBefore: 0` floor tier so every cancellation matches something.

Then update the table at the top of this doc so policy and code stay in lockstep. No migration is needed — past `booking_cancellations` rows keep their snapshots.

## Out of scope (today)

- **Refund processing automation.** When a card payment provider lands (Stripe), the cancellation flow can fire the refund automatically. Today the action only records the entitlement; an admin still has to record a `payment_refund` row manually.
- **Per-property policy overrides.** All four properties share the same policy. If you want Levante to be stricter than Cala, add a `policy_id` reference on `properties` and look up by booking → property → policy.
- **Force-majeure overrides.** "Hurricane: 100% refund regardless" needs an admin override path that bypasses the tier match. Could be a `policy_applied = 'override'` row with a manual `refund_amount_cents`.
- **Non-refundable cleaning fee.** Currently the cleaning fee scales with the policy. If Tano should keep the cleaning fee even on cancellations less than 15 days out, change `computeRefund` to split the formula.
