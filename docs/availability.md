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
| `/admin/invite/new`              | All 4 properties pre-fetched into `calendarsBySlug` (admin mode, 6 mo) | admin   | 6 mo   |
| Add Booking modal                | `getAddBookingContext()` server action — all 4 properties bundled together | admin | 6 mo |

Public mode strips non-blocking statuses entirely (the public can't see who has
a pending request). Admin mode returns everything; the modal collapses held →
confirmed for display only.
