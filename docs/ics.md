# Calendar export (.ics)

How guests pull a confirmed stay onto their calendar.

## What ships

A single read-only HTTP endpoint:

```
GET /api/bookings/[id]/ical
```

Responds with an RFC-5545 `text/calendar` payload describing the booking
as a single all-day VEVENT. The browser treats it as a download
(`Content-Disposition: attachment`), and macOS / iOS / Google Calendar /
Outlook all open it natively.

The endpoint lives at `src/app/api/bookings/[id]/ical/route.ts`. It is
wired into the `Add to calendar` button on `/checkout/success` and is
also safe to embed anywhere else (user dashboard, future email link,
QR code on the door).

## What's in the file

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Finca San Mateo//delta//EN
METHOD:PUBLISH
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:booking-14@fincasanmateo.com
DTSTAMP:20260508T173000Z
DTSTART;VALUE=DATE:20260508
DTEND;VALUE=DATE:20260511
SUMMARY:Finca San Mateo · Estrecho stay
LOCATION:Tarifa\, Cádiz\, Spain
DESCRIPTION:Booking #14\nGuest: Maria\nContact: hello@…\n…
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR
```

| Field        | Source                                                                |
| ------------ | --------------------------------------------------------------------- |
| `UID`        | `booking-{id}@fincasanmateo.com` — stable per booking                 |
| `DTSTART`    | `bookings.date_check_in` as `VALUE=DATE` (no time, no timezone)       |
| `DTEND`      | `bookings.date_check_out` as `VALUE=DATE` — **exclusive** per RFC-5545 |
| `SUMMARY`    | `Finca {finca.name} · {PROPERTY_LABELS[slug]} stay`                   |
| `LOCATION`   | `{city}, {region}, {country}` from `finca.json#location`               |
| `DESCRIPTION`| Booking ref · Guest name · Contact email + phone · Website            |

## Why all-day VEVENT (not timed)

Check-in / check-out times in this product are policy-set, not
booking-set. A daterange feels honest:

> 8th May → 11th May (3 nights)

…rather than baking in a fictional `15:00` arrival in Madrid time.
Calendars render this as a single bar across the days, which is also
what guests want to see.

The `DTEND;VALUE=DATE` is **exclusive** — RFC-5545 mandates that for
all-day events. So a stay 8th → 11th has DTEND of 11th, and the bar
shows on the 8th, 9th, and 10th. Same half-open semantics as our
Postgres `daterange(check_in, check_out, '[)')`.

## Escaping

The `.ics` format requires backslash + semicolon + comma escaping inside
text fields, and `\n` for line breaks in DESCRIPTION. The endpoint runs
every interpolated string through a small `escape()` helper before
emitting.

## Adding more events

If we ever want to publish a property's full calendar (host or guest
viewing all stays on one property), the path is:

1. New route: `/api/properties/[slug]/ical?token=...`
2. Loop over `getCalendarItems({ mode: 'admin' | 'public' })` and emit
   one VEVENT per booking + per block.
3. For host use: gate by token; this exposes other guests' UIDs / names.

Not built yet — only single-booking export ships today.

## Testing locally

After `bun db:fullseason`, pick any booking id and:

```bash
curl -i http://localhost:3000/api/bookings/14/ical
```

The response is the .ics body. Open it with `open` on macOS to verify
Calendar.app accepts it without warnings.

## Reference

| File                                                   | What                                       |
| ------------------------------------------------------ | ------------------------------------------ |
| `src/app/api/bookings/[id]/ical/route.ts`              | The endpoint + RFC-5545 generator         |
| `src/app/checkout/success/page.tsx`                    | "Add to calendar" button wires the link   |
| `src/lib/colors.ts#PROPERTY_LABELS`                    | Slug → display label mapping              |
| `finca.json#location` / `finca.json#contact`           | LOCATION / DESCRIPTION fields             |
