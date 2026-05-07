# Property rates

How nightly pricing is modeled in `property_rates`.

## TL;DR

- A property has **N rate rows**.
- Each row defines: *under which conditions* this price applies.
- Conditions are: the months it covers, the minimum stay length, whether it's public.
- The booking flow picks the **most specific** matching rate at quote time.
- **Cleaning fee is separate** — it lives in `property_cleaning_fee` and is added once per booking, regardless of which rate applied.

## Schema

```sql
property_rates (
  id                BIGSERIAL,
  property_id       BIGINT      → properties(id),
  name              TEXT,        -- label only ('Low Season', 'High Season', 'Long-Stay Discount', …)
  active            BOOLEAN,     -- soft on/off without deleting
  public            BOOLEAN,     -- false = invite-only rate, hidden from the public site
  min_nights        INT,         -- minimum stay required to qualify for this rate
  months            INT[],       -- months 1-12 when this rate applies (subset, non-empty)
  night_rate_cents  BIGINT       -- price per night, EUR cents
)
```

## Rate selection algorithm

Given a candidate booking with `(property_id, check_in, nights, is_invitation)`:

1. `WHERE property_id = ? AND active = true`
2. `WHERE EXTRACT(MONTH FROM check_in) = ANY(months)`
3. `WHERE nights >= min_nights`
4. If the booking is **not** an invitation, also `WHERE public = true`. Invitations may use either.
5. From survivors, pick the rate with the **highest `min_nights`** (most specific to this stay length).
6. Tiebreak by lowest `night_rate_cents`.

In SQL:

```sql
SELECT *
FROM property_rates
WHERE property_id = $1
  AND active = TRUE
  AND $2 = ANY(months)              -- check-in month
  AND $3 >= min_nights              -- total nights
  AND (public = TRUE OR $4)         -- $4 = is_invitation
ORDER BY min_nights DESC, night_rate_cents ASC
LIMIT 1;
```

## Worked examples (Levante)

Seeded rates:

| name        | min_nights | months          | night_rate |
|-------------|------------|-----------------|------------|
| Low Season  | 2          | Jan-May, Sep-Dec | €350       |
| High Season | 2          | Jun, Jul, Aug   | €480       |

A host could later add (not seeded):

| Long-Stay Low | 15 | Jan-May, Sep-Dec | €280 |

Then:

- 7 nights starting **Feb 14** → Low Season (€350/night). High Season excluded (wrong month). Long-Stay excluded (nights < 15).
- 7 nights starting **Jul 14** → High Season (€480/night).
- 21 nights starting **Mar 1** → Long-Stay Low (€280/night) wins by step 5 (higher `min_nights` than the regular Low Season rate).
- 5 nights starting **Jul 30** → no rate matches (overlap into August requires the booking flow to either split-bill or pick the rate of the check-in month, depending on host policy — currently, **rate is determined by check-in month only**).

## Booking total

```
agreed_price_cents
  = night_rate_cents × nights
  + property_cleaning_fee.fee_cents (where active = true)
  + Σ booking_service_fees.amount_cents   (any extras: late checkout, commission, …)
  − Σ payment_refunds.amount_cents        (separate from the agreed price; tracks what was returned)
```

The `bookings.agreed_price_cents` column stores the snapshot at booking time. If a host changes a rate later, historical bookings keep the price they agreed to.

## Adding a new rate

1. Decide name, months, min_nights, night_rate_cents.
2. Insert via SQL or admin tool. If it's a stable property of the estate (not a one-off promo), add it to `db/seed.ts` so `bun db:init` keeps it.
3. Overlapping rates are allowed. The selection algorithm resolves which one wins per booking.
4. To retire a rate, set `active = false` instead of deleting it — historical bookings already snapshotted their price into `agreed_price_cents`, but keeping the rate row preserves the audit trail.

## Out of scope (today)

- **Day-of-week pricing** (weekend vs weekday). If we ever need it, add a `days_of_week INT[]` column with the same selection idiom.
- **Date ranges** finer than month buckets (e.g. "first two weeks of August"). Today, `months` is the only seasonality knob. Workaround: create a one-off rate row and disable it after the date range passes.
- **Multi-currency**. Always EUR cents.
- **Per-rate cleaning fees**. Cleaning is one row per property in `property_cleaning_fee`, independent of the rate.
- **Auto-applied discounts beyond `min_nights`**. If you want "10% off if booked 60 days ahead", that lives in app code, not the rate table.
