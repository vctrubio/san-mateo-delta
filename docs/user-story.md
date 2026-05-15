# User story — booking + payments

Branch: `user-story`. The end-to-end guest journey + the admin payment
controls that wrap around it.

The admin side was hardened on `main` (notification bell, search command
palette, user dashboard, history-only seed). This branch made the guest
path match that quality, then layered on a runtime-switchable payment
policy with a dedicated **Payments HQ** at `/admin/payments`.

## Today's flow

```
   /                          /finca/[slug]                          submit
┌─────────────────┐  card  ┌──────────────────────────────┐    ┌───────────────────┐
│ HeroLanding     │ ─────▶ │ PropertyView                 │    │ requestBooking    │
│  + "See homes ↓"│        │  · hero + 4-prop carousel    │    │  upsert user      │
│ PropertyShowcase│        │  · characteristics           │    │  insert booking   │
│  (2-CTA modal)  │        │  · about · what's included   │    │    status=request │
│ AboutSection    │        │  · hosts (souls)             │    │    + payment_policy
│ Footer          │        │ ┌──────────────────────────┐ │    │    snapshot       │
└─────────────────┘        │ │ PricingCard (sidebar)    │ │    │  revalidate /admin│
                           │ │  rates + describePolicy()│ │    └──────┬────────────┘
                           │ │  [Book your stay]        │ │           │
                           │ └──────────┬───────────────┘ │           │
                           │            │ click           │           │
                           │            ▼                 │           │
                           │  Calendar replaces features  │           │
                           │  Guests + Identity reveal    │           │
                           │  Receipt adapts to resolved  │           │
                           │  policy (split / full / cash)│           │
                           │  [Reserve | Pay deposit | …] │           ▼
                           │            │                 │    chargesCardAtBooking?
                           └────────────│─────────────────┘    │
                                        ▼                      ├── yes → createCheckoutSession
                                                               │           ('deposit')
                                                               │            │
                                                               │            ▼
                                                               │       Stripe Checkout
                                                               │       (deposit charged)
                                                               │            │
                                                               └── no  ────┤
                                                                            ▼
                                                                 /checkout/success
                                                                            │
                                                                            ▼
                                                                  /user/[id]?just_booked=…
                                                                  UserDashboard
                                                                  + JustBookedBanner
                                                                  (Request received /
                                                                   Booking confirmed /
                                                                   Reserve · pay on arrival)
```

**The booking row carries the policy.** At creation we read the active
estate policy (or admin's per-booking override), resolve it against the
check-in date (collapse to 100% upfront when too close), and freeze the
result on `bookings.payment_policy`. Every downstream surface — receipt,
banner, balance button, admin payments HQ — derives copy and amounts
from that snapshot. Policy switches at `/admin/payments` never reach
back into existing bookings. See [`docs/payment.md`](./payment.md).

Concurrently on the admin side: `getAdminAlerts()` reruns on the next
`/admin` render, the `request_awaiting` alert appears in the bell (⌘K),
and admin confirms to move the booking to `confirmed`. The same booking
also surfaces under `/admin/payments` → "Outstanding" if anything is
owed.

## What this branch added

1. **Two-CTA property modal** (`PropertyShowcaseGrid.tsx`) on `/` — "Book
   now" → `/finca/[slug]#book`, "View full property" → `/finca/[slug]`.
   Modal dismisses on click so the transition doesn't flash.

2. **Hero CTA** on `/` ("See the homes ↓") smooth-scrolls to the
   property collection (`html` has `scroll-smooth`; `PropertyShowcase`
   anchored at `#homes`).

3. **Persistent `/finca` banner** (`src/app/finca/layout.tsx`) with the
   shared `<Title>` brand stamp on a cream surface + context-aware back
   pill ("Home" on `/finca`, "All properties" on `/finca/[slug]`).

4. **`/finca` collection page** — properties first, then estate
   amenities, then `<HostsSpotlight>` (shared with the landing page).

5. **`/finca/[slug]` rebuild** (`PropertyView.tsx` — client):
   - Hero photo + 4-property carousel; switching properties cross-fades
     in place and resets any in-flight booking.
   - Stats row (sleeps · beds · baths · m²) — beta-style pill cards.
   - About + What's included; `<HostsSpotlight>` fills the space when
     the booking flow is closed.
   - Sidebar `PricingCard`: rate table + `describePolicy()` line +
     [Book your stay].
   - **Inline booking flow** — Book click cross-fades What's included →
     `Calendar`, reveals Guests + Identity + Submit below; sidebar
     flips to detailed `PricingReceipt`. No modal.
   - **`#book` hash** auto-opens the flow and scrolls the calendar into
     view so the homepage "Book now" CTA works end-to-end.

6. **Runtime-switchable payment policy** — full vocabulary in
   [`docs/payment.md`](./payment.md):
   - Four named presets (`split_14`, `split_7`, `full_now`, `cash`) in
     `src/lib/payment.ts`.
   - **Estate-wide active** key on `system_settings` (singleton DB row).
     Flippable from the new `/admin/payments` page; instant, no restart.
   - **Per-booking override** on `SelectionActionModal` —
     `PaymentPolicyPresetPicker` preselects the active default; admin
     can switch on a booking-by-booking basis without changing the
     estate setting.
   - **Snapshot** to `bookings.payment_policy` at creation; every
     consumer reads from there.
   - **Too-close resolver**: a split policy whose `balance_days_before`
     window can't clear before check-in auto-collapses to 100% upfront
     (same method) and surfaces the reason ("Check-in is in 5 days;
     balance can't clear 14 days before arrival.") in the receipt and
     the picker caption.
   - **Adaptive submit** — `chargesCardAtBooking(policy)`: cash + 0%
     skip Stripe entirely and redirect straight to
     `/user/[id]?just_booked=`; split + full open Checkout.

7. **Payments HQ** (`/admin/payments`) replaces `/admin/settings`. Five
   composable sections, all derived state (mirrors the
   [admin-notifications](./admin-notifications.md) pattern):
   - Policy switcher — 4 preset cards.
   - **Outstanding** — bookings with `paid < agreed_total`, grouped by
     urgency (`checked_in_unpaid` / `overdue_checkin` → rose;
     `check_in_today` / `request_awaiting` → amber; `upcoming` →
     slate). Total owed in the header.
   - **Upcoming balance** — split-policy bookings whose computed
     balance-due-date (`check_in − balance_days_before`) is in the next
     30 days. Per-row "due in Nd / due today / due Nd ago" with tone.
   - **Recent payments** — last 20 succeeded `booking_payments` rows
     (last 30d), with Stripe/Banknote icon and total collected.
   - **Stale pending sessions** — Stripe `booking_payments` stuck in
     `pending > 1h`. Surfaces abandoned checkouts and webhook gaps.
   - Every booking row deep-links to `/admin/bookings/[id]`.

8. **Confirmation moment** on `/user/[id]` — fresh bookings arrive with
   `?just_booked=<id>` from `/checkout/success`. `<JustBookedBanner>`
   echoes the booking back, with body copy derived from
   `booking.payment_policy` (three flavours: cash / full / split).

9. **Guest BookingActions** (`src/components/user/BookingActions.tsx`)
   on every dashboard row:
   - "Pay €X balance" — manual fallback for the scheduled balance
     charge. Reuses `createCheckoutSession(id, 'balance')`.
   - "Cancel booking" → modal previewing the refund tier from
     `computeRefund` (capped at `paid_cents`) before submitting.

10. **`/user` privacy gate** — public list of demo accounts now hidden
    by default; show with `?demo=1`. Default view is the sign-up
    surface.

11. **Admin nav** order: Finca · Bookings · Payments · Users. New
    `Wallet` icon for Payments.

## What's left

The guest can: land, browse, book under any policy, pay (or not, if
cash), get a confirmation, see their bookings, settle the balance, and
cancel with a clear refund preview. The admin can: switch payment terms
instantly, override per-booking, see who owes what, watch payments
land, spot stale Stripe sessions. End-to-end testable.

What still needs to land for a real launch:

| Tier | Item | Why |
|------|------|-----|
| **Critical** | **Scheduled balance charge.** Stripe auto-pull N days before check-in (N = `booking.payment_policy.balance_days_before`). Today the "Pay balance" button + the /admin/payments "Upcoming balance" section are the manual path. `balanceDueDate()` already exists; needs a cron / scheduled PI. | Trust + revenue. |
| **Critical** | **Real auth.** Today `/user/[id]` is URL-typeable; `/user` is sign-up only. Once auth lands, `/user` resolves to the logged-in user. `// FUTURE — auth gate` comments in PropertyView mark the spot. | Privacy + UX. |
| **Polish** | **Upcoming-booking banner** on `/finca/[slug]` — when the logged-in user has an upcoming booking for the property, show it so they don't re-book the same dates. Depends on auth. | Awareness. |
| **Polish** | **Stripe refund on guest cancel** — today `cancelBooking` writes `booking_cancellations.refund_amount_cents` but doesn't fire the Stripe refund. Host issues it manually from admin. Should be automatic on guest-side cancel. | Money. |
| **Polish** | **Stripe webhook audit + stale-session cleanup action.** `/admin/payments` surfaces them; needs a one-click "void this pending row" affordance. | Hygiene. |
| **Comms** (deferred) | Booking confirmation email · status-change notifications · payment receipts · cancellation confirmations. | Not started. `booking.access_token` already exists for the future accept-link. |

## Source files this branch touched

### New

- `src/lib/payment.ts` — presets, resolver, helpers (pure module).
- `src/lib/systemSettings.ts` — singleton row reader.
- `src/lib/adminPayments.ts` — Payments HQ data layer.
- `src/actions/settings.ts` — `updateActivePaymentPolicy` action.
- `src/app/admin/payments/page.tsx` — Payments HQ.
- `src/app/finca/layout.tsx` — persistent banner.
- `src/components/admin/PaymentPolicyCard.tsx` — preset tile on Payments HQ.
- `src/components/admin/PaymentPolicyPresetPicker.tsx` — 2×2 picker in SelectionActionModal.
- `src/components/finca/FincaBackPill.tsx` — context-aware back link.
- `src/components/landing/Title.tsx` · `HostsSpotlight.tsx` — shared primitives.
- `src/components/user/BookingActions.tsx` — Pay balance + Cancel dialog.
- `src/components/user/UserDashboard.tsx` — rebuilt with grouped sections + JustBookedBanner.
- `docs/payment.md` · `docs/user-story.md` (this).

### Modified

- `db/schema.sql` — `system_settings` table, `bookings.payment_policy` column + CHECK.
- `db/seed.ts` · `db/seed_fullseason.ts` — snapshot policies on every seeded booking.
- `db/drop.sql` — drops `system_settings`.
- `src/actions/bookings.ts` — `requestBooking` + `createAdminBooking` resolve + snapshot policy.
- `src/actions/checkout.ts` · `src/actions/payments.ts` — derive deposit from booking snapshot; reject Stripe path for cash bookings.
- `src/lib/bookings.ts` — `BookingRow.payment_policy`, SELECT updated.
- `src/components/finca/PropertyView.tsx` — accepts `activePolicy`, resolves against picked dates, adaptive submit path + button label + footer copy.
- `src/components/shared/SelectionActionModal.tsx` — new "Payment policy" section, deposit-tile label derives from picked policy.
- `src/components/admin/AdminNavigation.tsx` — Payments link (Wallet icon).
- `src/components/admin/AdminCalendarView.tsx` · `src/app/admin/page.tsx` — thread `defaultPaymentPolicyKey` through.
- `src/app/user/page.tsx` — `?demo=1` privacy gate.
- `src/app/user/[id]/page.tsx` — accept `?just_booked`.
- `src/app/checkout/success/page.tsx` — dashboard link carries `?just_booked`.
- `src/app/finca/[slug]/page.tsx` — fetches active payment policy.
- `src/app/layout.tsx` — `scroll-smooth`.
- `AGENTS.md` — documents `docs/payment.md`.

### Removed

- `src/app/admin/settings/` — replaced by `/admin/payments`.
- `src/components/finca/BookNowForm.tsx` · `BookingFlow.tsx` · `BookingPanel.tsx` — replaced by the inline flow in PropertyView (earlier iterations).

## Shared primitives

- `@/lib/payment` — `PAYMENT_PRESETS`, `resolvePolicy`, `computeDepositCents`, `balanceDueDate`, `describePolicy`, `chargesCardAtBooking`.
- `@/lib/systemSettings` — `getActivePaymentPolicy()`.
- `@/lib/adminPayments` — `getPaymentsHqData()` + per-section queries.
- `@/components/shared/GuestConfig` — adults/children/infants/pets picker.
- `@/lib/guests` — `GuestCounts`, `DEFAULT_GUESTS`, `totalGuests`, `formatGuests`.
- `@/lib/bookingState` — `paymentState(b)`, `bookingBucket(status)`, alert kinds.
- `@/lib/refund` — `computeRefund(...)` policy math.
- `@/actions/bookings` — `requestBooking`, `transitionStatus`, `cancelBooking`, `createAdminBooking`.
- `@/actions/checkout` — `createCheckoutSession` (`deposit` derives amount from booking snapshot).
- `@/actions/settings` — `updateActivePaymentPolicy`.
