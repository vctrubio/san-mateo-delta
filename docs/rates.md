# Pricing

One row in `properties` carries everything pricing needs. There is no
`property_rates` table.

## The model

```sql
properties.rates    JSONB  NOT NULL  -- { "1": cents, "2": cents, ..., "12": cents }
properties.cleaning_fee_cents  BIGINT  NOT NULL  -- one flat fee per booking
```

`rates` is a JSON object keyed by month number, each value a per-night rate
in EUR cents. A `CHECK` constraint enforces that all twelve keys (`'1'` …
`'12'`) are present:

```sql
CHECK (
  jsonb_typeof(rates) = 'object'
  AND rates ?& array['1','2','3','4','5','6','7','8','9','10','11','12']
)
```

The admin form (`PropertyRateForm`) refuses to submit without all twelve
populated, and rebuilds the JSON object on every save — there's no way to
end up with a missing month from a normal code path.

## Quote algorithm

```ts
nights              = check_out − check_in              // half-open
month               = month-of(check_in)
night_rate_cents    = property.rates[month]
agreed_property_cents = nights × night_rate_cents
agreed_cleaning_cents = property.cleaning_fee_cents
```

That's the whole thing. No `min_nights` filter, no `active` flag, no
`public` vs invite-only distinction.

## What this trades away

The previous model had a `property_rates` table with one row per (rate name,
months[], min_nights, active, public) tuple. That gave it three knobs we no
longer have:

| Old knob          | New equivalent                                          |
| ----------------- | ------------------------------------------------------- |
| **Long-Stay rate** with high `min_nights` | Custom snapshot via the admin calendar's SelectionActionModal (`createAdminBooking`) — admin overrides the property/cleaning fees per booking. |
| **Public vs invite-only** rate            | Same path. Invitations carry whatever price admin types.       |
| **Easter / Christmas one-off** rate       | Edit the relevant month's value, or issue an admin booking for a single date range. |

The trade is deliberate: admin gets one number to set per month, plus a
separate path (admin-calendar selection → `createAdminBooking`) for one-off
custom prices. Easier to reason about, harder to misconfigure (a missing
rate row used to silently fall through to "no quote available").

## Multi-month stays

The rate is picked from the **check-in month**, not weighted across the
stay. A stay May 28 → June 3 uses the May rate for all 6 nights. If admin
needs different behavior, they can issue an invitation with a custom price.

## Editing rates

Admin opens `/admin/properties/[slug]` and uses **PropertyRateForm**:

- 12 €/night inputs, one per calendar month
- Two presets: **Flat rate** (apply to all 12) and **Low/High split**
  (Jun-Aug at one rate, the rest at another — matches the seasonal default)
- Submit → `updatePropertyRates` rebuilds the JSON and writes the column
- The `CHECK` constraint also rejects anything malformed at the DB level

Existing bookings keep their snapshot — `agreed_property_cents` is frozen
on the booking row at request time and never recomputed. Only future
bookings are affected by a rate change.

## Reference

| File                                                | What                                       |
| --------------------------------------------------- | ------------------------------------------ |
| `db/schema.sql` (properties.rates)                  | Column + CHECK + COMMENT                   |
| `src/lib/properties.ts#RatesByMonth`                | Typed shape                                |
| `src/lib/bookings.ts#computeQuote`                  | The 4-line algorithm                       |
| `src/actions/properties.ts#updatePropertyRates`     | Validate + write the JSON                  |
| `src/components/admin/PropertyRateForm.tsx`         | The 12-month grid + presets                |
| `src/app/finca/[slug]/page.tsx#Pricing`             | Public-facing display, runs grouped by rate |
| `docs/invitations.md`                               | The custom-price escape hatch              |
