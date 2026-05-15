# Payment policy

Estate-wide payment terms (how much guests pay at booking, when the
balance is due, by what method) are configurable at runtime from
[`/admin/payments`](../src/app/admin/payments/page.tsx). One click, no
restart. Existing bookings carry their own snapshot and are immune to
later changes.

## The four presets

| Key | Label | deposit_pct | balance_days_before | method |
|---|---|---|---|---|
| `split_14` | 50% now · balance 14 days before | 50 | 14 | stripe |
| `split_7`  | 50% now · balance 7 days before  | 50 | 7  | stripe |
| `full_now` | 100% upfront · card              | 100 | 0  | stripe |
| `cash`     | 0% now · pay on arrival in cash  | 0  | 0  | cash   |

These keys are the entire vocabulary. The estate-wide switcher and the
per-booking override picker (in the admin calendar's booking modal) both
pick from this exact list — no free-form numbers anywhere.

Defined in [`src/lib/payment.ts`](../src/lib/payment.ts) as
`PAYMENT_PRESETS`.

## Two scopes

1. **Estate-wide default** — `system_settings.active_payment_policy_key`.
   One row, one click to flip. Drives the default for every NEW booking
   coming in from `/finca/[slug]` and pre-selects the picker in the admin
   calendar modal.

2. **Per-booking override** — admin can pick any preset from the
   `PaymentPolicyPresetPicker` in the calendar's booking modal without
   changing the estate default. Useful for friends-and-family
   ("`cash`" on a guest's booking even though the estate is on `split_14`).

## The too-close rule

A split policy (50/14 or 50/7) doesn't make sense when the booking is
created closer to check-in than the `balance_days_before` window. The
resolver — [`resolvePolicy`](../src/lib/payment.ts) — automatically
**collapses** to `{ deposit_pct: 100, balance_days_before: 0, method:
<same> }` and surfaces a plain-English reason ("Check-in is in 5 days;
balance can't clear 14 days before arrival.").

The resolver runs in three places, all calling the same function:

- **`PropertyView` preview** (`src/components/finca/PropertyView.tsx`) —
  receipt and submit button reflect the resolved policy live.
- **`PaymentPolicyPresetPicker` caption**
  (`src/components/admin/PaymentPolicyPresetPicker.tsx`) — admin sees
  the collapse preview before clicking submit.
- **Server actions at insert time** — `requestBooking` /
  `createAdminBooking` in `src/actions/bookings.ts` snapshot the
  resolved (effective) policy onto `bookings.payment_policy`.

## Snapshot principle

When a booking is created, the **resolved** policy is frozen on the
`bookings.payment_policy` JSONB column. From that moment on:

- `/admin/payments` changes never reach back into the booking.
- Money columns (`agreed_property_cents`, `agreed_cleaning_cents`,
  `booking_payments.amount_cents`) are also snapshots — they were
  already.
- Display copy (PricingReceipt, JustBookedBanner, BookingActions)
  derives from `booking.payment_policy`, so the guest sees the same
  terms they originally agreed to even months later.

This mirrors how [`DEFAULT_REFUND_POLICY`](../src/lib/refund.ts) works:
past cancellations keep their `policy_applied` string forever; future
cancellations use the policy at cancellation time.

## How to change

### Estate-wide (the usual path)

1. Open `/admin/payments` in the admin UI.
2. Pick a preset card → "Switch to this".
3. `updateActivePaymentPolicy` UPDATEs `system_settings`, revalidates
   `/`, `/finca`, `/finca/[slug]`, `/admin`.
4. Next booking inherits the new default.

### Per booking (admin overrides)

1. Open the admin calendar, click-drag a date range.
2. In the booking modal's "Payment policy" section, pick a different
   preset.
3. Submit. That booking's snapshot uses the override; estate default
   stays put.

### Adding a fifth preset (rare)

Edit `PAYMENT_PRESETS` + `PaymentPolicyKey` + `PAYMENT_POLICY_KEYS` in
`src/lib/payment.ts`. Update the CHECK constraint in
`db/schema.sql` (`active_payment_policy_key IN (...)`) and reset with
`bun db:init`.

## Money flow per preset

| Policy | Guest submit flow | Admin override flow | Banner on `/user/[id]` |
|---|---|---|---|
| split_14 | Stripe Checkout, 50% deposit | Optional inline cash deposit recorded | "Deposit received · balance 14 days before arrival" |
| split_7  | Stripe Checkout, 50% deposit | Same, 7-day window | "Deposit received · balance 7 days before arrival" |
| full_now | Stripe Checkout, 100% | Optional inline cash recorded | "Full payment received" |
| cash     | No Stripe; insert + redirect | Admin records cash via booking detail modal on arrival | "Reserve received — pay on arrival in cash" |
| Collapsed (split booked too close) | Stripe Checkout, 100% + notice | Picker caption explains, snapshot is 100/0 | "Full payment received" |

## Files

| Path | Role |
|---|---|
| [`src/lib/payment.ts`](../src/lib/payment.ts) | Presets, resolver, helpers (pure module) |
| [`src/lib/systemSettings.ts`](../src/lib/systemSettings.ts) | Reads the singleton `system_settings` row |
| [`src/actions/settings.ts`](../src/actions/settings.ts) | `updateActivePaymentPolicy` server action |
| [`src/app/admin/payments/page.tsx`](../src/app/admin/payments/page.tsx) | Admin switcher UI |
| [`src/components/admin/PaymentPolicyCard.tsx`](../src/components/admin/PaymentPolicyCard.tsx) | Preset card on `/admin/payments` |
| [`src/components/admin/PaymentPolicyPresetPicker.tsx`](../src/components/admin/PaymentPolicyPresetPicker.tsx) | 2×2 picker in the booking modal |
| [`db/schema.sql`](../db/schema.sql) | `system_settings` table + `bookings.payment_policy` column |

## Out of scope (deferred)

- **Scheduled balance charge cron** — Stripe-side automatic balance pull
  N days before check-in. Today the guest pays the balance manually via
  the "Pay €X balance" button on the user dashboard. See
  `docs/user-story.md`.
- **History of switches** — `system_settings.updated_at` is the only
  audit. A `system_settings_log` table could record every switch with
  the admin who made it.
- **Per-property override** — explicitly rejected; estate-wide only.
- **Free-form custom policy** — explicitly rejected; preset-only
  vocabulary keeps the UI grounded.
