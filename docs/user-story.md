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

7. **Booking handoff polish.** `#book` hash on `/finca/[slug]` now
   auto-opens the booking flow and scrolls the calendar into view (the
   homepage "Book now" CTA actually works again). The property modal
   on `/` dismisses before navigation so there's no flash. After paying
   the deposit, `/checkout/success` redirects to
   `/user/[id]?just_booked=<id>` and the dashboard surfaces a
   confirmation banner echoing the booking back to the guest.

8. **Guest payment + cancellation.** `BookingActions` on each dashboard
   row gives the guest a "Pay €X balance" button (manual fallback for
   the scheduled balance charge — reuses `createCheckoutSession(id, 'balance')`)
   and a Cancel dialog that previews the refund tier from
   `computeRefund` before submitting. Cancellations go through the
   existing `cancelBooking` action with `cancelled_by='guest'`.

9. **Polish.** Hero on `/` now has a "See the homes ↓" pill that
   smooth-scrolls to the `#homes` section. `/user` defaults to a
   sign-up surface; the public list of demo accounts is gated behind
   `?demo=1` so casual visitors don't see other users' emails. `html`
   gets `scroll-smooth` for anchor navigation.

## Plan of action — what's left

The guest can land, browse, book, pay deposit, get a confirmation,
land on a dashboard with all their bookings, settle the balance, and
cancel with a clear refund preview. End-to-end testable. What still
needs to land for a real launch (not a walkthrough):

| #  | Item | Why |
|----|------|-----|
| A  | **Scheduled balance charge.** Stripe charges the remaining 50% automatically 14 days before check-in. Today the "Pay balance" button is the manual path. | Needs a cron / scheduled Stripe payment intent — flagged near `DEPOSIT_PCT` in `src/actions/checkout.ts`. |
| B  | **Real auth.** Today `/user/[id]` is reachable by URL-typing and `/user` is sign-up only. Once auth lands, `/user` resolves to the logged-in user, and PropertyView's `// FUTURE — auth gate` comments wire up to the real check. | Privacy + UX. The URL pattern is already correct. |
| C  | **Upcoming-booking banner on `/finca/[slug]`.** When the logged-in user has an upcoming booking for this property, show it ("Your stay: May 19 → 26 · view details") so they don't re-book the same dates. Stub: `<UserUpcomingForProperty propertySlug={...} />`. Marker comment in PropertyView. | Awareness — depends on auth. |
| D  | **Stripe refund on guest cancellation.** Today `cancelBooking` writes `booking_cancellations.refund_amount_cents` but doesn't fire the refund through Stripe — the host has to issue it from the admin side. | Money — webhook-driven refund + reconciliation. |
| E  | **Stripe webhook audit.** Confirm the `pending → succeeded` flip is reliable for hosted checkout; abandoned sessions get cleaned up. | Trust — `docs/stripe.md` + `src/app/api/webhooks/stripe/route.ts`. |

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
- `src/app/user/page.tsx` — sign-up surface; user list gated behind `?demo=1`
- `src/app/user/[id]/page.tsx` — reads `?just_booked` and threads it to the dashboard
- `src/app/checkout/success/page.tsx` — dashboard link now carries `?just_booked`
- `src/app/layout.tsx` — `scroll-smooth` for anchor navigation
- `src/components/finca/PropertyView.tsx` — client view + `#book` hash listener
- `src/components/finca/FincaBackPill.tsx` — context-aware back link
- `src/components/landing/HeroLanding.tsx` — "See the homes ↓" CTA
- `src/components/landing/PropertyShowcase.tsx` — `id="homes"` anchor target
- `src/components/landing/PropertyShowcaseGrid.tsx` — modal dismiss-on-click
- `src/components/landing/Title.tsx` · `HostsSpotlight.tsx` — shared primitives
- `src/components/user/UserDashboard.tsx` — `JustBookedBanner` + `BookingActions`
- `src/components/user/BookingActions.tsx` — Pay balance + Cancel dialog with refund preview
- `src/actions/checkout.ts` · `src/actions/payments.ts` — `DEPOSIT_PCT` at 50%
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
