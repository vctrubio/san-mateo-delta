# Known bugs & untackled risks

Running list of issues spotted but not (yet) fixed. Each entry: **what's
wrong**, **why it matters**, **where to look**. Tier by severity:

- 🔴 **Real bug** — user-visible incorrect behavior, money/data risk.
- 🟡 **Smell** — works today but will bite under specific conditions.
- 🟢 **Follow-up** — known TODO, deliberately deferred.

Update the tier as the codebase moves; close an item by deleting it once
the bug is gone (the commit message is the audit trail).

---

## 🔴 Real bugs

### `agreedTotal` includes cancelled bookings in % math

`aggregateBookings` (and the user dashboard) compute `money.agreedTotal` as
the sum of **all** bookings — cancelled included. The SplitBar percentages on
`/admin/users/[id]`'s PAYMENTS card divide by `agreedTotal`, so a user with
half their bookings cancelled sees Cash/Stripe percentages roughly half of
what they actually represent against revenue collected.

**Why it matters:** the bar reads as if "paid" is a smaller slice than
reality. Decision-supporting, low-stakes — but the math is wrong.

**Where to look:** `src/lib/bookingState.ts` aggregator (or compute a
separate "non-cancelled agreed" sum and divide by that).

### `paid_cents` on bookings counts pending payments

The `BOOKING_SELECT` SQL in `src/lib/bookings.ts` already filters `bp.status
= 'succeeded'` for `paid_cents`, which is correct. But the `getEstateOverview`
CTE in `src/lib/dashboard.ts` ALSO filters succeeded — so this is fine. **Not
actually a bug; verified.** _(Keeping the heading as a marker that this was
audited.)_

---

## 🟡 Smells / latent risks

### `BookingsExplorer` still receives full `BookingRow[]` from the server

`/admin/bookings/page.tsx` passes `BookingRow[]` straight into the client
component. `BookingRow` carries `access_token` (sensitive — it's the guest's
magic-link credential) plus other internal fields. RSC serializes the whole
object into the client bundle.

**Why it matters:** access_token is the guest's bookable URL. If an admin
session is shared, screenshotted, or sniffed in browser devtools, those
tokens leak.

**Where to look:** mirror the `BookingChipSource` pattern used by
`UserBookingChips` — map at the server/client boundary in
`/admin/bookings/page.tsx` and narrow `BookingsExplorer`'s prop type.

### `BookingActionModal` revalidation isn't proven from the chips strip

`UserBookingChips` opens the modal in-place over the users table. Server
actions inside the modal (status transitions, payments, cancellations) all
call `revalidatePath('/admin/users')` via `revalidateForBooking`. **The cache
is invalidated, but the chip strip inside the modal's host row only refreshes
on the next user-driven navigation** — the modal closes against stale chip
data.

**Why it matters:** admin clicks "confirm" on a request chip; modal closes;
the chip still says "request" until they navigate away and back. Visually
confusing.

**Where to look:** `UserBookingChips` — pass an `onSaved` callback into the
modal that triggers `router.refresh()`, or close the modal and refresh on
unmount.

### `/admin/users` list scans unbounded

`listUsers` accepts a `limit` and the page passes one (`DEFAULT_PAGE_LIMIT`),
so the user-row query is bounded. But the embedded **Invitations** section
hard-codes `listInvitations({ limit: 25 })` with no pagination control. Same
for `listLiveBookingsByUser` — bounded per-user now (6 rows each) but
unbounded across the user set on the page.

**Why it matters:** scales fine at seed size. Once invitations grow past 25,
older ones silently disappear from the section. Once the user count grows,
each page load fans out one LATERAL-ish ROW_NUMBER scan across all visible
users.

**Where to look:** `src/app/admin/users/page.tsx` — wire a separate
pagination control for invitations, or split it onto its own page once
volume warrants.

### `EstateOverview` and `BookingsExplorer` duplicate aggregate logic

The shared `aggregateBookings` helper in `src/lib/bookingState.ts` is the
canonical rollup, but it's only wired into the user dashboard.
`getEstateOverview` does the same math in SQL `FILTER` clauses, and
`BookingsExplorer`'s `accumulateMath` does it in JS with richer per-property
bucketing.

**Why it matters:** three places to keep in lockstep when bucket definitions
change. Already drifted once (`BookingsExplorer` splits confirmed into
"unpaid" vs "completed" by paid-in-full; `EstateOverview` doesn't).

**Where to look:** consider whether `EstateOverview` should call
`aggregateBookings` against `listBookings({ from: today })` rather than its
own SQL — pricier in DB cycles but kills the drift risk. `BookingsExplorer`
can layer its property × bucket cross-tab on top of `aggregateBookings`.

### Cleanup payment column hidden, paid_cents may include cleaning

`paid_cents` on `BookingRow` sums all succeeded payments on the booking —
cleaning fees included if they were paid separately. The user-detail
PAYMENTS card shows Cash/Stripe/Unpaid with no Cleaning slice (matches the
booking detail). Fine for the user view, but worth confirming that
"cash + stripe + unpaid === agreed_total" always holds, including when
cleaning is paid in a separate transaction.

**Where to look:** `src/lib/payments.ts:paymentSplitForUser` — currently
groups by method without filtering on `bp.type`. If a booking has both a
`reservation` and a `cleaning` payment row, both flow into the same bucket.
Probably correct, but undocumented.

---

## 🟢 Deliberate follow-ups

### No UI to adjust `date_check_in` after booking creation

`transitionStatus` now enforces `confirmed → checked_in` only when
`date_check_in === today` (per `docs/admin-notifications.md`). If a guest
arrives a day late or early, admin needs to shift the booking's
`date_check_in` before checking them in — but there's no UI for that yet.

**Why it matters:** the `overdue_checkin` notification points admin at a
booking they can't currently resolve cleanly (other than cancel + re-create).

**Where to look:** add an "adjust dates" action on the booking detail
page (`/admin/bookings/[id]`). Server action mutates `date_check_in` /
`date_check_out` with the same exclusion-constraint guard
`createAdminBooking` already uses.

### Live mode for Stripe is gated

App is hardcoded test mode. Auth + admin gate + guest double-confirmation +
real refund UX must land before live keys. See `AGENTS.md` Stripe section.

### Invitation accept flow

`booking.access_token` exists on the schema. No `/booking/[token]` route or
email delivery. See `docs/invitations.md` "What's not built yet".

### Pagination on bookings list

`listBookings` defaults to `limit: 1000` so the bookings page can split
upcoming/history client-side. Fine for now; switch to real pagination once
the dataset crosses ~500 rows.
