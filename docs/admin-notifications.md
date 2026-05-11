# Admin notifications

Source of truth for what the bell icon in the admin nav surfaces. If a
condition isn't on this page, it does NOT trigger a notification.

A booking has a **state** (`bookingBucket`) and a **payment** state
(`paymentState`). Every notification is a tuple of those plus a date check
— nothing more. The vocabulary lives in `src/lib/bookingState.ts`; the
notifications below are compositions of it.

## The four notifications

| Icon | Kind                  | Trigger                                                        | Severity | What admin should do |
|------|-----------------------|----------------------------------------------------------------|----------|----------------------|
| 💰   | `checked_in_unpaid`   | `status='checked_in'` AND `paid_cents < agreed_total_cents`    | Urgent   | Collect / record outstanding payment |
| 📅   | `check_in_today`      | `status='confirmed'` AND `date_check_in === today`             | Warning  | Mark guest as checked in |
| ⚠️   | `overdue_checkin`     | `status='confirmed'` AND `date_check_in < today`               | Urgent   | Backdate + check in, push the date, or cancel |
| 📧   | `request_awaiting`    | `status='request'`                                             | Warning  | Accept (→ confirmed) or cancel |

## Why these and not others

The bell is "action required right now", not "everything happening on the
estate". Cancellations, check-outs, paid bookings, and far-future requests
are visible from `/admin` directly — they don't need a nudge.

`invite` status (admin-issued, awaiting friend acceptance) is deliberately
NOT alerted. Friends-and-family invites have no SLA; surfacing them as
nags would train admin to ignore the bell.

## Hard rule: check-in only on the booked date

`transitionStatus` rejects `confirmed → checked_in` unless
`date_check_in === today`. If admin needs to check a guest in on a
different day (early arrival, late arrival), they first adjust the
booking's `date_check_in` (UI for this is a follow-up — see
`docs/bugs.md`), then transition.

Without this rule the `checked_in_unpaid` notification becomes meaningless
— admin can backdate-check-in a stack of seed bookings and flood the bell.

## Reusability — where else alerts surface

The same `AdminAlert[]` array drives every consumer. Today the bell is the
only consumer; the components are factored so the alert row + list can be
dropped into other admin contexts without rewriting:

- **Future `/admin` "needs attention" inline panel** — `<AlertsList alerts={alerts} groupBySeverity />` inside a `<Section>`.
- **Future `/admin/notifications` page** — same component, no grouping.
- **Sidebar widget on user detail** — filter by `user_id`, reuse the list.
- **Email digest** — server-only render of `ALERT_TITLES[kind]` per row.

## Schema

Notifications are pure derived state. No notification table, no read /
unread tracking. The bell count reflects "what's true right now". When
admin acts on a booking (accept, check in, record payment),
`revalidatePath('/admin')` fires via `revalidateForBooking` and the next
layout render reflects the new count.

## Source files

- `src/lib/bookingState.ts` — `bookingAlerts(b, today)` pure derivation
- `src/lib/adminAlerts.ts` — `getAdminAlerts()` + `AdminAlert` type
- `src/components/admin/alertsDisplay.ts` — titles, severity, tone maps
- `src/components/admin/AlertRow.tsx` — single row
- `src/components/admin/AlertsList.tsx` — grouped list
- `src/components/admin/AlertsCountBadge.tsx` — count pill
- `src/components/admin/AdminAlertsBell.tsx` — bell + modal
- `src/components/admin/AdminActions.tsx` — host for the bell
- `src/app/admin/layout.tsx` — fetches alerts, threads through the nav
- `src/actions/bookings.ts` — `transitionStatus` enforces the check-in date rule
