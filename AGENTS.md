<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project structure

Routes go in `src/app/`. Components go in `src/components/<area>/`. Do not colocate components inside `src/app/` route folders.

```
src/
  app/                     # routes only — page.tsx, layout.tsx, route.ts, loading.tsx, error.tsx, etc.
    page.tsx               # /
    debug/page.tsx         # /debug
  components/              # all UI components, grouped by area
    landing/               # HeroLanding, PropertyShowcase, AboutSection, Footer
    debug/                 # DebugColorPanel
  lib/                     # utilities, clients, shared logic (when needed)
finca.json                 # static estate config at project root
public/images/             # property + host images
docs/                      # design + architecture docs (all markdown lives here)
  schema.md                # tables, relationships, enums, invariants, recipes
  availability.md          # three-bucket availability + the /admin estate dashboard
  rates.md                 # pricing architecture + rate-selection algorithm
  refund.md                # cancellation-refund policy + tier logic
  stripe.md                # payment methods, webhooks, lifecycle, test cards
  ics.md                   # /api/bookings/[id]/ical — calendar export format
  invitations.md           # /admin/invite — friends-and-family custom-price bookings
```

Rules:
- A folder under `src/app/` exists only because it represents a URL segment. If a file is not a route file, it does not belong there.
- Route files import components via the `@/components/<area>/<Name>` alias (configured in `tsconfig.json` paths).
- Group components by area (`landing/`, `debug/`, `booking/`, `admin/`...), not by type. Avoid a flat `src/components/` dump.
- Components that wrap the shared `<Modal>` shell (`@/components/shared/Modal`) live next to it in `src/components/shared/`, not in feature folders — even if their content is feature-specific. Keeps the modal family discoverable in one place. Examples: `PropertyDetailModals.tsx` lives in `shared/` because it composes `<Modal>`, even though it shows admin-only data.
- Static config (estate metadata, copy) lives in JSON at the repo root and is imported with relative paths.

## Database

Postgres on Neon. Schema is hand-rolled SQL — no ORM, no migration tool.

```
db/
  schema.sql    # source of truth: CREATE TYPE / TABLE / INDEX / CONSTRAINT
  drop.sql     # DROP everything in dependency order
  client.ts    # Neon serverless Pool + sql() helper
  enums.ts     # TS mirrors of the SQL enums + Month constants. Import from @db/enums.
  reset.ts     # bun script: drop.sql then schema.sql
  seed.ts      # bun script: insert demo data (4 properties, 3 users, 12 bookings)
  init.ts      # bun script: reset + seed (start-from-zero convenience)
  fullseason.ts / seed_fullseason.ts  # bun script: ~year of populated demo data
```

Markdown documentation lives in `docs/`, not in `db/`. See `docs/rates.md`, `docs/refund.md`, `docs/schema.md`, `docs/availability.md`, `docs/stripe.md`, `docs/ics.md`, `docs/invitations.md`.

Scripts:
- `bun db:init`  — wipe + reapply schema + seed (use this 99% of the time during iteration)
- `bun db:reset` — wipe + reapply schema only (no data)
- `bun db:seed`  — seed only

Rules:
- All amounts are EUR cents stored as `BIGINT`. Never add a `currency` column.
- Every table has `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Mutable tables also have `updated_at` driven by the `set_updated_at` trigger.
- Use Postgres ENUMs for status fields (`booking_status`, `payment_type`, etc.), not free-text. Update the schema and run `db:init`. Mirror the values in `db/enums.ts` so app code stays in lockstep — import lists and types from `@db/enums`, never hardcode them.
- Pricing follows the model in `docs/rates.md`: per-night rates live inline on `properties.rates` as a JSONB object keyed by month `'1'..'12'`, validated by a `CHECK` constraint. `computeQuote` reads `rates[checkInMonth]` × nights. Cleaning is a separate flat fee per booking. There is no `property_rates` table, no `min_nights`, no public/private flag — custom prices for friends go through `/admin/invite`. Read `docs/rates.md` before touching pricing code.
- All app code that hits the database imports from `@db/client` (the alias is wired in `tsconfig.json` to `./db/*`) — single Neon Pool, no other connection paths.
- During iteration, treat the DB as disposable: change `schema.sql`, run `bun db:init`. Don't write incremental migrations until the schema stabilizes.
- The `bookings` exclusion constraint (`no_overlap_when_held`) prevents double-booking on `confirmed`/`checked_in`/`checked_out` dates. Don't bypass it; if you need to override, change the booking's status first.
- **Snapshots, not recalculations.** Fees and policies are copied onto bookings at creation. Money columns on `bookings` (`agreed_property_cents`, `agreed_cleaning_cents`) and the cancellation outcome columns on `booking_cancellations` are frozen — edits to property templates or `DEFAULT_REFUND_POLICY` only affect future bookings/cancellations. See `docs/refund.md`.
- Read [`docs/schema.md`](./docs/schema.md) before adding or modifying a table. It documents tables, enums, the booking state machine, both exclusion constraints, the half-open daterange convention, and the recipes for blocking dates / confirming bookings / handling refunds.

## Admin dashboard

The `/admin` dashboard is the **upcoming-only estate view** — money still to be made, properties at a glance, the calendar opens on demand. Four `AdminSection` blocks: `Upcoming` (`EstateOverview`) → `Availability` (`GanttStrip`) → `Properties` (`PerPropertyFutureStrip`) → `Calendar` (only when a property is focused). State-machine detail across all bookings (cancelled / checked_out distribution, audit, etc.) lives on `/admin/bookings` where it's actionable. Read [`docs/availability.md`](./docs/availability.md) before adding a section — it defines the bucket contracts (held set, today rule, payment scope) that the page is built on.

## Stripe — TEST MODE ONLY

> 🟡 **This entire app runs in Stripe test mode.** Both local dev and the deployed environment.
>
> **Never** swap `sk_test_…` / `pk_test_…` for `sk_live_…` / `pk_live_…` without explicit user confirmation, **even if the user asks for a "production deploy"** — production-the-hosting-target is not the same as live-mode-payments. Auth + safety rails (admin gate, guest-side double-confirmation, idempotency audit, real refund UX) are still pending; live mode is gated behind those.
>
> Pretending to be in test mode visually but calling live keys would be a real-money bug. Always check `STRIPE_SECRET_KEY` starts with `sk_test_` before assuming the environment is safe.

Test card: `4242 4242 4242 4242` — any future expiry, any CVC, any ZIP. See [`docs/stripe.md`](./docs/stripe.md) for the full webhook lifecycle, idempotency contract, and other test cards (declined / 3DS / refundable).

## Internal-only routes

Two non-public routes for development. They live alongside customer routes but serve different purposes:

| Route | Purpose | Adds new things here when |
|---|---|---|
| `/debug` | System observability — schema, live row counts, e2e flow recap, refund policy preview, color tokens, finca.json viewer. Read-only and safe. | A new schema concept, money flow, or system invariant exists and is hard to see from the customer-facing routes. |
| `/forms` | Catalog of every form in the app, rendered with mock data and wrapped in `<fieldset disabled>` so submissions don't fire. For visual review and styling. | A new form is added or restyled. Add the form to `src/app/forms/page.tsx` so it stays discoverable. |

Both pages have `export const dynamic = 'force-dynamic';` so they always reflect current state.

Rules:
- Never put real business logic on these routes. They show what already exists; they don't create new behavior.
- `/debug` may query the live DB. `/forms` should not — use mock data so it works regardless of seed state.
- When you add a `Debug<X>Panel` or a new form, also wire it into the corresponding page so it's discoverable.
