# Admin + User routes — full booking automation (no auth, no Stripe)

> Branch: `admin` · Working draft. See also `db/schema.sql`, `db/rates.md`, `AGENTS.md`.

## Goal

Wire the operational surface of the booking system. By the end of this branch every step of the booking lifecycle works end-to-end without any UI polish:

```
guest fills BookNowForm on /finca/[slug]
  ↓ (server action: requestBooking)
guest lands on /user/[id] with status=request
  ↓ (admin one-click on /admin/bookings)
status=confirmed
  ↓ (guest pays from /user/[id])
booking_payments row recorded
  ↓ (admin one-click)
checked_in → checked_out
```

Auth is still deferred. To work without it, `/user` is a public list that mirrors `/finca`. The booking form on `/finca/[slug]` collects name + email and creates the user as part of the booking action. Stripe is still deferred — `Pay deposit` / `Pay full` insert `booking_payments` with `cash = true`.

## Routes

| URL | Purpose |
|---|---|
| `/admin` | Dashboard: metrics tiles + quick actions + recent activity |
| `/admin/bookings` | Table with inline one-click status transitions per row |
| `/admin/bookings/[id]` | Full record + payment actions + audit timeline |
| `/admin/payments` | All payments + refunds, joined |
| `/admin/users` | Table + UserSignUpForm |
| `/admin/users/[id]` | User detail: bookings + lifetime spend |
| `/user` | Public list of users + UserSignUpForm |
| `/user/[id]` | Guest dashboard: their bookings + Pay deposit/Pay full once confirmed |
| `/finca/[slug]` | (existing) Gains a `BookNowForm` block |

## Architecture

**Mutations** — Next 16 Server Actions (`'use server'`), one file per resource under `src/actions/`. Always `revalidatePath` the affected paths.

**Reads** — server components hit Neon directly via `@db/client`. Per-resource query helpers under `src/lib/`.

**State machine** — guarded in the action layer:

```
request    →  confirmed | cancelled
invite     →  confirmed | cancelled
confirmed  →  checked_in | cancelled
checked_in →  checked_out
checked_out, cancelled  →  (terminal)
```

Every transition writes a `booking_events` row. Stamp `time_check_in` / `time_check_out` / `cancelled_at` as appropriate.

**Pricing** — `lib/bookings.ts#computeQuote` runs the algorithm from `db/rates.md` (filter active rates by month + min_nights + public; pick highest min_nights, then lowest night_rate). `agreed_price_cents` is snapshotted into the booking at request time so future rate edits don't retroactively change the price.

**Payment amounts** — computed in the action layer, not collected from the UI:
- `deposit` = 30% of agreed_price
- `reservation` = full agreed_price
- `balance` = agreed_price − sum of prior non-refunded payments

## Files

```
src/
  actions/
    users.ts            # createUser
    bookings.ts         # requestBooking, transitionStatus
    payments.ts         # recordPayment
  lib/
    users.ts            # listUsers, getUserById
    bookings.ts         # listBookings (joined), getBookingById, listBookingsForUser, computeQuote
    payments.ts         # listPayments (joined), totalPaidForBooking
  components/
    admin/
      AdminSidebar.tsx
      BookingsTable.tsx          # inline transition buttons per row
      PaymentsTable.tsx
      UsersTable.tsx
      StatusBadge.tsx
      BookingActionButtons.tsx
      PaymentActionButtons.tsx
      DashboardMetrics.tsx
      QuickActions.tsx
    shared/
      UserSignUpForm.tsx          # used on /user, /admin/users, /admin
    user/
      UserDashboard.tsx
    finca/
      BookNowForm.tsx             # on /finca/[slug]
  app/
    admin/
      layout.tsx
      page.tsx
      bookings/page.tsx
      bookings/[id]/page.tsx
      payments/page.tsx
      users/page.tsx
      users/[id]/page.tsx
    user/
      page.tsx
      [id]/page.tsx
```

## Out of scope (this branch)

- Auth, sessions, password hashing.
- Stripe / real card processing — `cash=true` everywhere.
- Email sending.
- Permissions on `/admin/*` — still wide open.
- Refunds with custom amounts (deferred to T2).
- Filters/search on tables (deferred to T2).
- Charts on the dashboard (deferred to T3).

## Verification

The canonical end-to-end story (run after Tier 1 complete):

1. Open `/finca/levante`, fill BookNowForm: 2026-09-10 → 2026-09-17, 4 adults, name "Alice", email `alice@test.com`. Submit.
2. Land on `/user/[alice-id]`: see request, status=`request`.
3. `/admin/bookings`: Alice's row at top. One-click "Confirm".
4. Reload `/user/[alice-id]`: status=`confirmed`, "Pay deposit" / "Pay full" appear.
5. "Pay deposit" → 30% recorded.
6. `/admin/payments` shows the deposit.
7. `/admin/bookings`: one-click "Check-in" → `time_check_in` stamped.
8. One-click "Check-out" → `time_check_out` stamped.
9. `/admin/bookings/[id]` audit timeline: created → confirmed → payment.recorded → checked_in → checked_out.
