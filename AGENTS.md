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
```

Rules:
- A folder under `src/app/` exists only because it represents a URL segment. If a file is not a route file, it does not belong there.
- Route files import components via the `@/components/<area>/<Name>` alias (configured in `tsconfig.json` paths).
- Group components by area (`landing/`, `debug/`, `booking/`, `admin/`...), not by type. Avoid a flat `src/components/` dump.
- Static config (estate metadata, copy) lives in JSON at the repo root and is imported with relative paths.

## Database

Postgres on Neon. Schema is hand-rolled SQL — no ORM, no migration tool.

```
db/
  schema.sql    # source of truth: CREATE TYPE / TABLE / INDEX / CONSTRAINT
  drop.sql     # DROP everything in dependency order
  client.ts    # Neon serverless Pool + sql() helper
  enums.ts     # TS mirrors of the SQL enums + Month constants. Import from @db/enums.
  rates.md     # Pricing architecture: how property_rates is structured + the selection algorithm
  reset.ts     # bun script: drop.sql then schema.sql
  seed.ts      # bun script: insert demo data (4 properties, 3 users, 12 bookings)
  init.ts      # bun script: reset + seed (start-from-zero convenience)
```

Scripts:
- `bun db:init`  — wipe + reapply schema + seed (use this 99% of the time during iteration)
- `bun db:reset` — wipe + reapply schema only (no data)
- `bun db:seed`  — seed only

Rules:
- All amounts are EUR cents stored as `BIGINT`. Never add a `currency` column.
- Every table has `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Mutable tables also have `updated_at` driven by the `set_updated_at` trigger.
- Use Postgres ENUMs for status fields (`booking_status`, `payment_type`, etc.), not free-text. Update the schema and run `db:init`. Mirror the values in `db/enums.ts` so app code stays in lockstep — import lists and types from `@db/enums`, never hardcode them.
- Pricing follows the model in `db/rates.md`: rates live in `property_rates`, are selected by month + min_nights, and cleaning is a separate flat fee per booking. Read it before touching pricing code.
- All app code that hits the database imports from `@db/client` (the alias is wired in `tsconfig.json` to `./db/*`) — single Neon Pool, no other connection paths.
- During iteration, treat the DB as disposable: change `schema.sql`, run `bun db:init`. Don't write incremental migrations until the schema stabilizes.
- The `bookings` exclusion constraint (`no_overlap_when_held`) prevents double-booking on `confirmed`/`checked_in`/`checked_out` dates. Don't bypass it; if you need to override, change the booking's status first.
