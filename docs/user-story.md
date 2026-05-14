# User story — booking + payments

Branch: `user-story`. Tracks what's shipped and what's still ahead for the
guest-side journey: landing → property → booking → payment → dashboard.

The admin side has been hardened on `main` (notification bell, search
command palette, user dashboard, history-only seed). This branch is about
making the guest path feel as polished.

## Today's flow (what works)

```
   /                          /finca/[slug]                          submit
┌─────────────────┐  card  ┌──────────────────────────────┐    ┌───────────────────┐
│ HeroLanding     │ ─────▶ │ PropertyView                 │    │ requestBooking    │
│ PropertyShowcase│        │  · hero + 4-prop carousel    │    │  upsert user      │
│ AboutSection    │        │  · characteristics           │    │  insert booking   │
│ Footer          │        │  · about · what's included   │    │    status=request │
└─────────────────┘        │  · hosts (souls)             │    │  revalidate /admin│
                           │ ┌──────────────────────────┐ │    └──────┬────────────┘
                           │ │ PricingCard (sidebar)    │ │           │
                           │ │  rates + deposit policy  │ │           ▼
                           │ │  [Book your stay]        │ │    createCheckoutSession
                           │ └──────────┬───────────────┘ │       ('deposit' = 50%)
                           │            │ click           │           │
                           │            ▼                 │           ▼
                           │  Calendar replaces features  │    Stripe Checkout
                           │  Guests + Identity reveal    │    (50% deposit charged)
                           │  Receipt mode in sidebar     │           │
                           │   · nights × rate            │           ▼
                           │   · cleaning fee             │    /checkout/success
                           │   · 50% deposit on booking   │           │
                           │   · 50% balance 14d before   │           ▼
                           │  [Pay €X deposit] ───────────│──▶  /user/[id]
                           └──────────────────────────────┘    UserDashboard
                                                               (Pending host approval)
```

**Guest pays by card only.** Cash is admin-only — recorded from
`/admin/bookings/[id]` after the guest arrives.

**Deposit 50% / balance 14 days before arrival.** Deposit lands on
Stripe immediately. The balance charge is currently manual — scheduled
charge is a follow-up (see "Payment management" below).

Concurrently on the admin side: `getAdminAlerts()` re-runs on the next
`/admin` render, the `request_awaiting` alert appears in the bell (⌘K),
and admin clicks **Confirm** to move the booking to `confirmed`.

## What this branch added

1. **Two-CTA property modal** (`src/components/landing/PropertyShowcaseGrid.tsx`)
   — clicking a card on `/` opens a modal with **Book now** (primary →
   `/finca/[slug]#book`) and **View full property** (secondary →
   `/finca/[slug]`).

2. **Persistent `/finca` banner** (`src/app/finca/layout.tsx`)
   — cream `#F5F2ED` surface, hosts the shared `<Title>` typographic stamp
   from the homepage hero so the brand voice carries across `/finca` and
   `/finca/[slug]`. `FincaBackPill` is context-aware: "Home" on `/finca`,
   "All properties" on `/finca/[slug]`.

3. **`/finca` collection page** — properties first (no header chrome above
   them), followed by an Estate amenities card and a "Your hosts" card
   (shared `HostsSpotlight`).

4. **`/finca/[slug]` rebuild** (`src/components/finca/PropertyView.tsx` — client):
   - Hero photo on the left + 4-property carousel on the right. Switching
     a property in the carousel cross-fades the hero, updates all stats
     in place, resets any in-flight booking.
   - Stats row (sleeps · beds · baths · m²) — beta-style pill cards.
   - About + What's included (per-property features + estate-wide amenities).
   - `HostsSpotlight` below "What's included" while the booking flow is
     closed — same component as the landing page's "Souls of San Mateo".
   - **Sidebar `PricingCard`** carries the booking control. Two modes:
     - **Browse** — rate table (low / peak / cleaning) + 50%/14d deposit
       policy + Book CTA.
     - **Receipt** — nights × rate + cleaning + total + deposit/balance
       split. "Close" button resets all booking state.
   - **Inline booking flow.** Clicking "Book your stay" in the sidebar
     cross-fades "What's included" → `Calendar` in the main column and
     reveals Guests + Identity + Submit below. No modal anywhere.

5. **Payment policy = 50% deposit + 14-day balance**
   (`src/actions/checkout.ts`, `src/actions/payments.ts`). `DEPOSIT_PCT`
   bumped from `0.30` → `0.50`. UI clearly shows what's due now vs later.

6. **Calendar `monthsDefault` accepts `1`** — minor type widening for
   compact single-month previews if needed (currently the booking flow
   uses 2 months).

## Plan of action — booking story polish

| #  | Item | Why it matters |
|----|------|----------------|
| 1  | **Hero CTA on `/`.** A "See the homes ↓" or "Book a stay" pill under the giant `FINCA SAN MATEO` title. | Orientation — the giant wireframe is beautiful but doesn't tell guests what they can do. |
| 2  | **Confirmation moment on `/user/[id]`.** After submitting, the guest lands on the dashboard but there's no "Request sent — Levante, Mar 5→12. The host will respond within 24h." beat. | Trust — the guest just trusted a form with their personal info and gets dropped into a list view. |
| 3  | **Modal dismiss before navigation.** Clicking "Book now" in the property modal navigates to `/finca/[slug]#book` but the modal stays mounted for a tick — visible flash. Call `setSelected(null)` before the link fires. | Polish — small fix, noticeable. |
| 4  | **`/user` privacy.** "Sign in as anyone" + a public list of every user with their email and lifetime spend is fine for demo but uncomfortable for a real walkthrough. Gate behind `?demo=1` or only show after explicit consent. | Trust — demo flag, but easy to miss. |
| 5  | **Auth → `/user` resolves to the logged-in user.** Today `/user/[id]` is reachable by URL-typing. When auth is wired, `/user` resolves automatically. PropertyView has `// FUTURE — auth gate` comment marking the spot. | Privacy + UX — the URL pattern is already correct; just needs auth. |
| 6  | **Upcoming-booking banner on `/finca/[slug]`.** When the logged-in user has an upcoming booking on this property, show it ("Your stay: May 19 → 26, 5 nights · view details") so they don't re-book the same dates. Stub: `<UserUpcomingForProperty propertySlug={...} />`. | Awareness — comment marks the spot in PropertyView. |

## Plan of action — payment management

The booking-side flow works: guest pays 50% by card via Stripe, webhook
flips pending → succeeded, dashboard reflects it. Cash is admin-recorded
after the fact (no `cash + pending` state). What's missing is the
guest-side surface for the balance, viewing what's collected, and
cancelling cleanly.

| # | Item | Where to look |
|---|------|---------------|
| A | **Scheduled balance charge.** Stripe charges the remaining 50% automatically 14 days before check-in. Today this is manual. Needs a cron / scheduled Stripe payment intent — flagged in `src/actions/checkout.ts` near `DEPOSIT_PCT`. | New: scheduled job + `payment_type='balance'` insert; webhook reconciliation. |
| B | **Pay outstanding balance from `/user/[id]`** (manual fallback). Reuses `createCheckoutSession(bookingId, 'balance')` which already exists. | `src/components/user/UserDashboard.tsx` + guest-facing pay button. Admin's `PaymentActionButtons` is cash-only and stays admin-only. |
| C | **Paid / owed breakdown per booking** on the user dashboard. The vocabulary already exists — `paymentState(b)` returns `paid / partial / unpaid / not_applicable`. | `UserDashboard` row — add a payment chip alongside the status chip. |
| D | **Cancellation UX with policy preview.** Guest clicks Cancel → sees the refund tier ("8+ days out: 75% refund of property fee"). `computeRefund` already returns the math. | `src/lib/refund.ts` + new `CancelBookingDialog` for the guest side. Admin variant exists. |
| E | **Refund visibility.** When admin issues a refund, the guest dashboard surfaces "€350 refunded on Apr 12". | `booking_cancellations.refund_amount_cents` + `payment_refunds` already capture this; needs surfacing. |
| F | **Stripe webhook audit.** Confirm the `pending → succeeded` flip is reliable, abandoned sessions get cleaned. | `docs/stripe.md` + `src/app/api/webhooks/stripe/route.ts`. |

## Plan of action — communications (deferred)

| # | Item | State |
|---|------|-------|
| α | **Booking confirmation email** ("Request sent" / "Booking confirmed" / "Payment received"). | Not started. `booking.access_token` already exists for the future accept-link flow. |
| β | **Status-change notifications** to the guest when admin confirms / cancels. | Not started. Triggered off `booking_events` rows. |
| γ | **Payment receipts.** Stripe sends its own; cash-on-arrival needs a manual sender. | Not started. |
| δ | **Cancellation confirmations** with policy outcome. | Not started. |

## Source files this branch touched

- `src/app/finca/layout.tsx` — new persistent banner
- `src/app/finca/page.tsx` — properties-first collection
- `src/app/finca/[slug]/page.tsx` — server shell, fetches all 4 properties + items
- `src/components/finca/PropertyView.tsx` — client view: hero + carousel + sections + inline booking flow + PricingCard / LocationCard
- `src/components/finca/FincaBackPill.tsx` — context-aware back link
- `src/components/landing/Title.tsx` — shared brand stamp
- `src/components/landing/HostsSpotlight.tsx` — shared hosts block
- `src/components/landing/HeroLanding.tsx` + `AboutSection.tsx` — switched to the shared components
- `src/components/landing/PropertyShowcaseGrid.tsx` — two-CTA modal
- `src/actions/checkout.ts` · `src/actions/payments.ts` — `DEPOSIT_PCT` raised to 50%
- `public/banner.jpg` — banner placeholder (Cloudinary swap later)

**Removed** (no longer used):
- `src/components/finca/BookNowForm.tsx` — replaced by the inline flow in PropertyView
- `src/components/finca/BookingFlow.tsx` — earlier modal iteration
- `src/components/finca/BookingPanel.tsx` — earlier iteration

## Shared primitives

- `@/components/shared/GuestConfig` — adults/children/infants/pets picker
- `@/lib/guests` — `GuestCounts`, `DEFAULT_GUESTS`, `totalGuests`, `formatGuests`
- `@/lib/bookingState` — `paymentState(b)`, `bookingBucket(status)`, alert kinds
- `@/lib/refund` — `computeRefund(...)` policy math
- `@/actions/bookings` — `requestBooking`, `transitionStatus`, `cancelBooking`
- `@/actions/checkout` — `createCheckoutSession` (`deposit` = 50%)
