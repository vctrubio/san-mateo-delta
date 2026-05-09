# Availability

When the calendar (public listing or the admin Add-Booking modal) renders, every
day falls into exactly one of three buckets. This page documents the rule and
where it's enforced.

## The three buckets

| Bucket            | What lives there                                  | Cell treatment                          |
| ----------------- | ------------------------------------------------- | --------------------------------------- |
| **Available**     | Empty days, plus pending `request` / `invite` rows on those days. Requests aren't held — multiple guests can sit on the same dates and the host picks one when confirming. | Default white cell. Requests/invites still render as soft chips so the admin sees pending interest, but the day is still selectable. |
| **Held**          | `bookings.status IN ('confirmed', 'checked_in', 'checked_out')`. This is the set the SQL exclusion constraint `no_overlap_when_held` locks. | Ocean blue (`BOOKING_STATUS_STYLES.confirmed.cell`). Not selectable for a new range. |
| **Blocked**       | `property_blocks` rows. Admin-imposed unavailability — owner stays, maintenance, listing pauses. | Slate-700 with a diagonal hatch (`PROPERTY_BLOCK_STYLE.cell`). Not selectable. |

The held set is mirrored in TS as
[`BLOCKING_BOOKING_STATUSES`](../src/lib/colors.ts) and in SQL as the WHERE
clause of the exclusion constraint in [`db/schema.sql`](../db/schema.sql). Keep
them in lockstep — if you change one, change the other.

## Why all "held" cells look the same

In the **Add Booking modal** the admin only cares whether a day is bookable.
`checked_in` vs `checked_out` is operational detail that lives on
`/admin/bookings`, not in the booking-creation flow. So before passing items to
`<Calendar>`, the form rewrites every booking whose status is in the held set
to `status: 'confirmed'`. Same data, uniform colour, one less question.

The full status palette (request amber, invite violet, checked-in emerald,
checked-out slate) still appears unmodified on `/admin/bookings` and on
`/admin/properties/[slug]`'s calendar — because there, the distinction matters.

## Pivot=dates property filter

When the admin starts from dates (`Dates → property` pivot), the property chips
disable any property whose `calendarsBySlug[slug]` has a held booking or block
overlapping the selected range. The overlap check uses half-open semantics
(`!(itEnd <= rangeStart || itStart >= rangeEnd)`) — same convention as the
`daterange(_, _, '[)')` exclusion constraint, so the UI can never offer dates
that the database would later reject.

## Where the data comes from

| Surface                          | Fetcher                                           | Mode    | Window |
| -------------------------------- | ------------------------------------------------- | ------- | ------ |
| `/finca/[slug]`                  | `getCalendarItems({ mode: 'public' })`            | public  | 6 mo   |
| `/admin/properties/[slug]`       | `getCalendarItems({ mode: 'admin' })`             | admin   | 12 mo  |
| `/admin` (dashboard)             | `getCalendarItems` per property (admin) + `listFuturePropertyData()` + `getEstateOverview()` for the top "Estate · upcoming" section | admin | 6 mo |
| `/admin/invite/new`              | All 4 properties pre-fetched into `calendarsBySlug` (admin mode, 6 mo) | admin   | 6 mo   |
| Add Booking modal                | `getAddBookingContext()` server action — all 4 properties bundled together | admin | 6 mo |

Public mode strips non-blocking statuses entirely (the public can't see who has
a pending request). Admin mode returns everything; the modal collapses held →
confirmed for display only.

## "Estate · upcoming" section on `/admin`

Top-down stack inside the section (the calendar view is now part of the
admin dashboard, not a separate route):

1. **`EstateOverview`** — upcoming-only summary card pair, same forward lens
   as the calendar grid (`date_check_out > today`).
   - **Bookings** (3 segments) — *confirmed* (`confirmed` / `checked_in` /
     `checked_out`) vs *unconfirmed* (`request` / `invite`) vs *cancelled*.
     All three are counted; `total_bookings` = sum of the three.
   - **Payments** (computed over HELD bookings only — `status IN
     ('confirmed','checked_in','checked_out')`; request/invite are excluded
     because they aren't real revenue commitments yet) — 3-segment bar: *paid*
     (`SUM(succeeded payments)`) + *unpaid* (per-booking
     `GREATEST(agreed_total − paid, 0)`) + *cleaning*
     (`SUM(agreed_cleaning_cents)`). Cleaning overlaps with paid + unpaid
     (it's a slice of `total_cents` that may be partly paid, partly owed),
     so the three percentages can exceed 100%. The `SplitBar` uses flex-grow
     weighting so all three segments render proportionally regardless.

   Colours pull straight from the status palette via the
   `--color-status-{request,confirmed,cancelled}` CSS vars in `globals.css`,
   so the strip stays in lockstep with `BOOKING_STATUS_STYLES`. **No green
   anywhere** — "paid" reuses the ocean (= `confirmed`) tone so there's a
   single positive colour shared between the two cards. SQL:
   `getEstateOverview()` in `src/lib/dashboard.ts`.
2. **`PerPropertyFutureStrip`** — the property selector. Four side-by-side
   cards, one per property. Clicking a card toggles it active (border
   highlights ocean blue); clicking the active card again deselects.
3. **`GanttStrip`** — read-only scanner. Property labels are static spans;
   only item-cells are clickable, opening the booking action modal.
4. **`SelectionSummary`** — date-range lead-in + stay, only when a property
   is active and a range is in progress.
5. **`Calendar`** — full grid for the active property.

`listFuturePropertyData()` (in `src/lib/properties.ts`) returns one row per
property. The buckets and the "today" rule are defined as follows — the
component must respect these and the SQL is the single source of truth:

| Field                                | Definition                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `today_occupied`                     | `EXISTS` a booking with `status IN ('confirmed','checked_in','checked_out')` whose half-open `[date_check_in, date_check_out)` covers `CURRENT_DATE`. |
| `today_status` / `today_guest_name` / `today_check_out` | Picked from that same held booking — if more than one (shouldn't happen due to `no_overlap_when_held`) we deterministically pick the latest `date_check_in`. |
| `today_agreed_cents` / `today_paid_cents` | Agreed total + sum of `succeeded` payments for the held booking covering today. Currently consumed only when needed; the strip card no longer renders today's stay inline (the header dot covers it). `null` when the property is free. |
| `today_indicator_status` | Status of ANY non-cancelled booking covering today, picked by priority (held > invite > request) — `null` when nothing covers today. Drives the small dot in each strip card's header: amber (request), violet (invite), ocean (held), slate (available). Distinct from `today_status`, which is held-only — soft bookings don't make the property "occupied" but should still surface on the dot. |
| `pending_count`                      | `status IN ('request','invite')` AND `date_check_out > CURRENT_DATE`. The "to confirm" lane. |
| `confirmed_count`                    | `status = 'confirmed'` AND `date_check_in >= CURRENT_DATE`. Upcoming arrivals only — already-checked-in/out bookings are operational, not pipeline. |
| `outstanding_cents` / `outstanding_count` | `SUM` and `COUNT` over confirmed-upcoming bookings where `(agreed_property_cents + agreed_cleaning_cents) > paid_amount`. Outstanding = unpaid balance. |
| `next_check_in` / `next_check_in_guest` | Earliest `status = 'confirmed'` booking with `date_check_in >= COALESCE(today_check_out, CURRENT_DATE)`. If today is occupied, this skips the current stay and shows the *next* arrival instead. `null` if none. |

Notes:
- **Cancelled is invisible everywhere on this surface.** It's not a held bucket
  and not a pending bucket — the dates are available, full stop.
- **The "to confirm" bucket combines `request` and `invite`** because both
  sit in the same operational lane: a guest is waiting on the host to act.
- **No property/cleaning split on this surface.** Outstanding is one number
  for actionable money owed.

If you change the bucket definitions, change the SQL in `listFuturePropertyData`
**and** this table — they're a contract.
