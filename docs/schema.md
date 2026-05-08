# Schema

What lives where, how the tables relate, and the invariants that keep the
booking system honest. The source of truth is [`db/schema.sql`](../db/schema.sql) —
this file is a map.

## Shape at a glance

- **10 tables**, **5 enums**, **2 exclusion constraints** (one per table that
  reserves dates).
- **All amounts are EUR cents** stored as `BIGINT`. Never add a `currency`
  column.
- **All IDs are `BIGSERIAL`** (auto-increment integers), exposed to the app as
  strings (`id::text`).
- **Every table has `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`**. Mutable
  tables (`users`, `properties`, `bookings`) also have `updated_at` driven by
  a `set_updated_at` trigger.
- **Hand-rolled SQL — no ORM.** The only connection path is `@db/client`'s
  Neon `pool` and `sql<T>()` helper.
- **Disposable during iteration.** Edit `db/schema.sql`, run `bun db:init`.
  No incremental migrations until the schema stabilises.

## Domain map

```
identity   ─ users
                │  (FK: bookings.user_id, booking_invitations.accepted_user_id)
property   ─ properties ─── property_blocks      (FK property_id)
                                │  not a booking; admin-imposed unavailability
                                │  (per-month rates live inline in properties.rates JSONB)
booking    ─ bookings ───┬─ booking_invitations    (1:1 if status=invite)
                         ├─ booking_service_fees   (extras: late_checkout…)
                         ├─ booking_cancellations  (1:1 if status=cancelled)
                         └─ booking_events         (append-only audit log)
payment    ─ booking_payments ─ payment_refunds
                                  (refunds attach to a single payment)
audit      ─ booking_events
```

Five "domains" appear in the [`/debug` schema panel](../src/components/debug/DebugSchemaPanel.tsx)
as colored chips — they're a documentation grouping, not a SQL construct.

## Tables

### `users`

Identity profile. Auth deferred — no password column yet. Anyone can sign up
on `/user`; the booking flow auto-creates a user from an email if one doesn't
already exist.

| Column        | Type         | Notes                                |
| ------------- | ------------ | ------------------------------------ |
| `id`          | BIGSERIAL PK |                                      |
| `name`        | TEXT NOT NULL|                                      |
| `email`       | TEXT UNIQUE  | Used for `ON CONFLICT … DO UPDATE`.  |
| `tif`         | TEXT NULL    | Spanish tax ID (NIF/NIE).            |
| `nationality` | TEXT NULL    |                                      |
| `dob`         | DATE NULL    |                                      |

### `properties`

The four units inside Finca San Mateo. The set is fixed (Levante, Estrecho,
Marea, Cala) — admin can edit each but can't add or delete.

| Column                | Type           | Notes                              |
| --------------------- | -------------- | ---------------------------------- |
| `id`                  | BIGSERIAL PK   |                                    |
| `slug`                | TEXT UNIQUE    | URL identifier — `/finca/[slug]`.  |
| `title`, `description`| TEXT NOT NULL  |                                    |
| `features`            | JSONB          | Per-property highlights (array of strings). |
| `bedrooms`, `bathrooms`, `m2`, `max_guests` | INT | All non-negative.    |
| `cleaning_fee_cents`  | BIGINT NOT NULL DEFAULT 0 | Default cleaning fee for new bookings → goes to **Tano**. **Snapshotted** onto `bookings.agreed_cleaning_cents` at request time, so editing this never alters past bookings. |

Estate-wide amenities (Starlink, smart TV, etc.) live in [`finca.json`](../finca.json),
not in this table.

### Per-night rates

Stored inline on `properties.rates` (JSONB), keyed by month number `'1'`
through `'12'`, values in EUR cents. A `CHECK` constraint enforces all
twelve keys are present. There is no separate `property_rates` table any
more — and no `min_nights`, `active`, or `public` knob.

`computeQuote` (in `lib/bookings.ts`) reads `property.rates[month-of-check-in]`
and multiplies by nights. See [`docs/rates.md`](./rates.md) for the full
algorithm and the rationale for dropping the multi-row model.

### `bookings`

The core reservation table. Money columns are **snapshots** (frozen at
creation) so future fee edits don't alter past totals.

| Column                  | Type                | Notes                            |
| ----------------------- | ------------------- | -------------------------------- |
| `id`                    | BIGSERIAL PK        |                                  |
| `access_token`          | UUID UNIQUE DEFAULT `gen_random_uuid()` | Public link for unauthenticated viewing. |
| `property_id`           | BIGINT FK → properties |                              |
| `user_id`               | BIGINT FK → users (NULL ok) | NULL = admin booking (owner family / no guest). |
| `date_check_in`         | DATE NOT NULL       | Half-open: `[in, out)` semantics. |
| `date_check_out`        | DATE NOT NULL       | `CHECK (date_check_out > date_check_in)`. |
| `agreed_property_cents` | BIGINT NOT NULL ≥ 0 | **David's revenue** — `nights × night_rate` at request time. Frozen. |
| `agreed_cleaning_cents` | BIGINT NOT NULL ≥ 0 | **Tano's pay** — snapshot of `properties.cleaning_fee_cents` at request time. Frozen. |
| `status`                | `booking_status`    | See state machine below.         |
| `guests`                | JSONB               | `{ adults, children, infants, pets }`. |
| `time_check_in` / `time_check_out` | TIMESTAMPTZ NULL | Stamped by `transitionStatus` when admin clicks Check-in/Check-out. |

#### Exclusion constraint: `no_overlap_when_held`

```sql
ALTER TABLE bookings ADD CONSTRAINT no_overlap_when_held EXCLUDE USING gist (
  property_id WITH =,
  daterange(date_check_in, date_check_out, '[)') WITH &&
) WHERE (status IN ('confirmed', 'checked_in', 'checked_out'));
```

What this means in practice:
- Postgres rejects any INSERT/UPDATE that would create two **held** bookings
  on the same property whose dateranges overlap.
- `request`, `invite`, and `cancelled` rows are **not** held — multiple
  guests can sit in `request` for the same dates and it's first-confirmed-wins.
- The check fires on UPDATE too: confirming a `request` that overlaps an
  existing held booking will fail.
- Daterange is half-open: a check-out on Sep 17 and a check-in on Sep 17 do
  not collide — that's the next guest's arrival day.

The app surfaces this as a user-readable error in `requestBooking` and
`transitionStatus` (catch the constraint name).

### `property_blocks`

Admin-imposed unavailability ranges that **aren't bookings**. Examples: owner
stays, maintenance, listing pause. No money, no user, no lifecycle.

| Column           | Type                | Notes                          |
| ---------------- | ------------------- | ------------------------------ |
| `id`             | BIGSERIAL PK        |                                |
| `property_id`    | BIGINT FK → properties (CASCADE) |                  |
| `date_check_in`  | DATE NOT NULL       | Same half-open semantics as bookings. |
| `date_check_out` | DATE NOT NULL       | `CHECK (date_check_out > date_check_in)`. |
| `reason`         | TEXT NULL           | Free-text admin note.          |

Has its own `EXCLUDE USING gist` constraint on `(property_id, daterange)` so
two blocks can't overlap each other.

**Block ↔ held booking** is enforced **in the action layer** (Postgres can't
do exclusion across two tables). See "How to block dates" below.

### `booking_invitations`

1:1 with bookings of `status = 'invite'`. Tracks the email-invite flow (the
host sends a guest a link; the guest accepts).

| Column            | Type                 | Notes                              |
| ----------------- | -------------------- | ---------------------------------- |
| `id`              | BIGSERIAL PK         |                                    |
| `booking_id`      | BIGINT UNIQUE FK     | 1:1 with the booking.              |
| `email`           | TEXT NOT NULL        |                                    |
| `status`          | `invitation_status`  | invited / accepted / declined.     |
| `accepted_user_id`| BIGINT FK → users    | Set when the guest accepts.        |
| `invited_at` / `responded_at` | TIMESTAMPTZ |                              |

Email sending is out of scope — this table tracks the state, the dispatch is
deferred.

### `booking_service_fees`

Extras charged per booking after the initial quote (late checkout, extra
cleaning, commission, other). N rows per booking.

| Column        | Type                | Notes                              |
| ------------- | ------------------- | ---------------------------------- |
| `id`          | BIGSERIAL PK        |                                    |
| `booking_id`  | BIGINT FK (CASCADE) |                                    |
| `type`        | `service_fee_type`  | late_checkout / extra_cleaning / commission / other. |
| `amount_cents`| BIGINT NOT NULL ≥ 0 |                                    |
| `note`        | TEXT NULL           |                                    |

UI to add these is **not yet built** — the table is in the schema as a hook
for a future Tier-2 admin slice.

### `booking_cancellations`

One row per cancelled booking. Records who cancelled, why, and the refund the
policy entitled the guest to (computed at cancellation time, see
[`docs/refund.md`](./refund.md)).

| Column                | Type                  | Notes                            |
| --------------------- | --------------------- | -------------------------------- |
| `id`                  | BIGSERIAL PK          |                                  |
| `booking_id`          | BIGINT UNIQUE FK (CASCADE) | 1:1 with the booking.       |
| `cancelled_by`        | `cancelled_by`        | guest / admin.                   |
| `reason`              | TEXT NULL             |                                  |
| `refund_amount_cents` | BIGINT NOT NULL ≥ 0   | **Snapshot.** What the policy says we owe. Doesn't change if `DEFAULT_REFUND_POLICY` is later edited. |
| `policy_applied`      | TEXT NOT NULL         | Human-readable label, e.g. `"50% (>=7 days)"`. |
| `cancelled_at`        | TIMESTAMPTZ           |                                  |

Reconciling: compare `booking_cancellations.refund_amount_cents` to
`SUM(payment_refunds.amount_cents)` for this booking to see if the refund is
**still owed**, **partial**, or **complete**.

### `booking_payments`

Each payment slice for a booking. While Stripe is deferred, every row has
`cash = true`.

| Column        | Type                | Notes                               |
| ------------- | ------------------- | ----------------------------------- |
| `id`          | BIGSERIAL PK        |                                     |
| `booking_id`  | BIGINT FK (CASCADE) |                                     |
| `type`        | `payment_type`      | deposit / balance / reservation / extra_guest. |
| `amount_cents`| BIGINT NOT NULL ≥ 0 |                                     |
| `cash`        | BOOLEAN DEFAULT `true` | Will become `false` once Stripe lands. |
| `paid_at`     | TIMESTAMPTZ         |                                     |

### `payment_refunds`

Refunds attach to a single payment. Multiple refunds per payment are allowed.

| Column        | Type                | Notes                               |
| ------------- | ------------------- | ----------------------------------- |
| `id`          | BIGSERIAL PK        |                                     |
| `payment_id`  | BIGINT FK → booking_payments (CASCADE) |                  |
| `amount_cents`| BIGINT NOT NULL ≥ 0 |                                     |
| `note`        | TEXT NULL           |                                     |

### `booking_events`

Append-only audit log of every state transition and host action.

| Column        | Type                | Notes                               |
| ------------- | ------------------- | ----------------------------------- |
| `id`          | BIGSERIAL PK        |                                     |
| `booking_id`  | BIGINT FK (CASCADE) |                                     |
| `event_type`  | TEXT NOT NULL       | `'booking.created'`, `'booking.confirmed'`, `'payment.recorded'`, … |
| `payload`     | JSONB               | Free-form context (rate_month, refund_amount_cents, etc.) |

Free-text type rather than enum because the universe of event types grows
faster than schema iteration cycles. Treat it as documentation, not validation.

## Enums

TypeScript mirrors live in [`db/enums.ts`](../db/enums.ts) — import lists
and types from `@db/enums`, never hardcode them. If you add a value, update
both the SQL and the TS.

### `booking_status`

The lifecycle of a booking. Six values; transitions are guarded in
[`src/actions/bookings.ts#transitionStatus`](../src/actions/bookings.ts).

```
                            ┌──────────────────┐
                            ▼                  │
   request ───────► confirmed ───► checked_in ─┘─► checked_out
      │ ▲              │                          (terminal)
      │ └─ invite ─────┘
      │
      └──────► cancelled (terminal · any non-terminal can cancel)
```

| Value         | Meaning                                          |
| ------------- | ------------------------------------------------ |
| `request`     | Guest submitted via `/finca/[slug]`. Awaiting host approval. Public sees these dates as still bookable. |
| `invite`      | Host-initiated invitation. Awaiting guest acceptance. |
| `confirmed`   | Held — exclusive on the property. Pay buttons unlock. |
| `checked_in`  | Guest is on premises. `time_check_in` stamped.   |
| `checked_out` | Stay complete. `time_check_out` stamped. Terminal. |
| `cancelled`   | Terminal. Triggers `booking_cancellations` row + refund per policy. |

The "**held set**" — what the exclusion constraint locks and what the public
calendar marks unavailable — is `{confirmed, checked_in, checked_out}`. This
is mirrored in TS as `BLOCKING_BOOKING_STATUSES` in
[`src/lib/colors.ts`](../src/lib/colors.ts).

### `invitation_status`

Lifecycle of `booking_invitations`. `invited → accepted | declined`.

### `service_fee_type`

`late_checkout`, `extra_cleaning`, `commission`, `other`. Just a category
field — no behavioral logic attached.

### `payment_type`

`deposit` (30%), `balance` (remainder), `reservation` (full upfront),
`extra_guest`. Math is enforced in [`src/actions/payments.ts`](../src/actions/payments.ts).

### `cancelled_by`

`guest` or `admin`. Recorded on `booking_cancellations.cancelled_by` so we
can later distinguish who triggered it. Refund policy doesn't currently
differentiate, but the data is there if we ever do.

## Invariants

These are the rules that keep the system honest. Most are enforced at the SQL
layer; the rest live in the action layer.

### Snapshots, not recalculations

Money columns on `bookings` (`agreed_property_cents`, `agreed_cleaning_cents`)
and refund columns on `booking_cancellations` (`refund_amount_cents`,
`policy_applied`) are **frozen** at the moment they're written. Editing
`properties.cleaning_fee_cents` or `DEFAULT_REFUND_POLICY` only affects
**future** bookings/cancellations.

This means David and Tano's earnings are computed by SUMing snapshot columns,
not by joining bookings against the current property cleaning fee.

### Half-open dateranges

Both `bookings` and `property_blocks` use `daterange(date_check_in,
date_check_out, '[)')` — start inclusive, end exclusive. So Sep 10 → Sep 17
is **7 nights**, the guest checks out the morning of Sep 17, and a new
booking can check in the same day Sep 17 without overlap.

`computeQuote` and the calendar both rely on this. Don't introduce closed
ranges anywhere.

### `no_overlap_when_held` (bookings)

Held bookings (`confirmed`/`checked_in`/`checked_out`) on the same property
can't overlap. Postgres rejects with the constraint name; the action layer
catches it and returns a user-readable error.

If you need to override (e.g. admin moving dates), change the booking's
status first, then update the dates.

### `property_blocks` self-exclusion

Two `property_blocks` rows on the same property can't overlap. Same gist
exclusion mechanism.

### Block ↔ held-booking exclusion (action-layer)

Postgres can't enforce exclusion across two tables. So `createBlock`
(in [`src/actions/blocks.ts`](../src/actions/blocks.ts)) does this manually:

```ts
BEGIN;
SELECT … FROM bookings
  WHERE property_id = $1
    AND status IN ('confirmed','checked_in','checked_out')
    AND date_check_in  < $end::date
    AND date_check_out > $start::date
  FOR UPDATE;
-- if any rows: throw "Cannot block: overlaps booking #N (..., ..., status)"
INSERT INTO property_blocks …;
COMMIT;
```

`FOR UPDATE` prevents a concurrent confirm from sneaking a held booking in
between our check and our insert. This is the only place where the calendar
invariant is enforced outside the SQL layer — read it before changing the
overlap semantics.

## Recipes

### How to block dates (admin)

1. **UI**: admin opens `/admin/properties/[slug]`, picks a range on the
   calendar (two-click), enters an optional reason, hits Block.
2. **Action**: [`createBlock`](../src/actions/blocks.ts) runs the
   transaction described above. On a conflict, it returns
   `{ ok: false, error: "Cannot block: overlaps booking #42 (Maria, Sep 10 → Sep 17, confirmed)." }`.
3. **Cache**: `revalidatePath` for `/admin/properties/[slug]` and
   `/finca/[slug]` so both sides reflect the new block.

To remove a block: `deleteBlock` in the same file. No transaction needed —
it's a single DELETE.

### How to confirm a booking

1. **UI**: the dashboard's PipelinePanel shows pending requests with inline
   Confirm/Cancel buttons (or `/admin/bookings` row buttons).
2. **Action**: [`transitionStatus`](../src/actions/bookings.ts) checks the
   `request → confirmed` transition is allowed, runs the UPDATE, and writes
   a `booking_events` row. If the dates overlap an already-held booking,
   the `no_overlap_when_held` constraint fires and the user sees a clear
   error.
3. **Cache**: `revalidatePath` for `/admin/bookings`, `/admin/bookings/[id]`,
   `/user/[id]`, etc.

The valid transitions are encoded in `TRANSITIONS` in `actions/bookings.ts`.
Any other transition throws.

### How to handle a cancellation + refund

1. **Action**: [`cancelBooking`](../src/actions/bookings.ts) reads the
   booking's `agreed_property_cents + agreed_cleaning_cents`, runs
   `computeRefund` from [`src/lib/refund.ts`](../src/lib/refund.ts), which
   evaluates `DEFAULT_REFUND_POLICY` tiers based on days-before-check-in.
2. **Writes (transactional)**:
   - `bookings.status = 'cancelled'`
   - `booking_cancellations` row with `refund_amount_cents` + `policy_applied`
     **snapshotted** from the policy at that moment.
   - `booking_events` `booking.cancelled` row.
3. The refund **money movement** is a separate step — not yet automated.
   When implemented, it'll insert into `payment_refunds` against the
   relevant `booking_payments` row.

To know if a refund is owed: compare
`booking_cancellations.refund_amount_cents` (what we owe) to
`SUM(payment_refunds.amount_cents)` for this booking (what we've returned).

### How to compute the David / Tano split

```sql
SELECT
  SUM(agreed_property_cents)::int AS david,  -- host
  SUM(agreed_cleaning_cents)::int AS tano    -- cleaner
FROM bookings
WHERE status IN ('confirmed','checked_in','checked_out');
```

That's it. Held bookings only — bookings that haven't been confirmed (or
were cancelled) don't count toward earnings. See
[`docs/dashboard.md`](./dashboard.md) for how this is rendered on `/admin`.

## Related docs

- [`docs/rates.md`](./rates.md) — pricing architecture and rate-selection algorithm.
- [`docs/refund.md`](./refund.md) — cancellation-refund policy + tier logic.
- [`docs/dashboard.md`](./dashboard.md) — how the schema surfaces on `/admin`.
- [`/debug` schema panel](../src/components/debug/DebugSchemaPanel.tsx) — live, color-coded view of every table + enum.
- [`/debug` admin panel](../src/components/debug/DebugAdminPanel.tsx) — live numbers from the dashboard helpers.

## Adding a table

The hot path:

1. **Edit `db/schema.sql`** — add the table in dependency order (tables that
   FK something must come after that something).
2. **Edit `db/drop.sql`** — add a `DROP TABLE IF EXISTS … CASCADE` for it,
   in **reverse** dependency order.
3. **Run `bun db:init`** — wipes + reapplies + reseeds. No migrations.
4. **Add a TS mirror** if it has an enum — `db/enums.ts` exports both the
   value list and the union type.
5. **Add a server query helper** in `src/lib/<area>.ts`.
6. **Update `db/seed.ts`** if the table needs demo data.
7. **Update this doc.** Add a table section above + a node in the domain map.
8. **Update [`src/components/debug/DebugSchemaPanel.tsx`](../src/components/debug/DebugSchemaPanel.tsx)** — add the table to `TABLES` and bump the count in the panel header.

If you don't update steps 7 and 8, future-you will have to reverse-engineer
your table from grepping. Don't make future-you do that.
