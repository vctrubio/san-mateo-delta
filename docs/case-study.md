# Delta — case study & next-mile plan

A reading of the Finca San Mateo booking platform as it sits today, what
the next mile asks for (three role-aware interfaces, auth, Cloudinary,
transactional email, Airbnb sync), and where the architecture will help
or fight back.

## Reading the landing page

The landing is doing more than it looks. `HeroLanding` carries the
brand stamp (`<Title size="hero">`) over a hand-drawn Strait of
Gibraltar wireframe, with one CTA — *See the homes ↓* — that
smooth-scrolls to `#homes`. That single verb is the whole reason the
page converts: a wireframe of two continents is gorgeous but doesn't
tell a first-time visitor what to do. The anchor pattern is right.

`PropertyShowcase` is a server component that pulls the four
properties from Postgres and hands them to a client bento grid. The
grid is a bento (`col-span` ratios indexed 4/2/2/2) with motion-fade
entrances. Tapping a card opens a two-CTA modal — *Book now* deep-links
to `/finca/[slug]#book` (which auto-opens the inline booking flow and
scrolls the calendar into view), *View full property* lands on the
property page without flow expanded. Both `onClick={onClose}` before
navigating so the modal collapses cleanly instead of flashing during
the transition. That detail is the difference between an artisan
product and a generated one.

`AboutSection` is the "Spirit" + travel grid + hosts spotlight. The
host portraits (David + Tano) come from `finca.json` and are reused on
`/finca/[slug]` so the brand voice is consistent across surfaces. The
travel grid is sharp: arrival airports + ferry crossing + a contact
card with a *Book a visit* button that is, today, a dead end (no
`onClick`, no `href`). That button is the highest-leverage landing
fix.

`Footer` is the weakest link. The wind ticker drifts every 4s from a
random walk — it's decorative noise that loses credibility the moment
a kiter realises it's not real data. The Airbnb link is the only
external proof point on the page, deliberately faded to 30% opacity
("we don't want you to leave"); fine intent, but in a market where
Airbnb is the trust signal, dimming it works against the goal of
"drift away from Airbnb" stated in `README.md`. The drift happens by
giving guests a *reason* to book direct (price parity + an extra
night + faster reply), not by hiding the alternative.

**SEO and metadata are essentially empty.** `src/app/layout.tsx`
defines a single `<title>` and `<description>` for the whole site;
neither `/finca`, `/finca/[slug]`, the property modal, nor the host
profiles export `generateMetadata`. There is no Open Graph image, no
Twitter card, no JSON-LD `LodgingBusiness` / `Accommodation` schema,
no `sitemap.ts`, no `robots.ts`, no `NEXT_PUBLIC_APP_URL`-backed
canonical. For a property that wants to outrank its own Airbnb
listing on `"finca san mateo tarifa"`, that's the gap. The remediation
is small (one `generateMetadata` per route, one schema-org JSON-LD
block, four OG images) — but it does need to land before any organic
push.

## What the codebase already does very well

Before talking about gaps, it's worth naming what's been built well —
the next phase only succeeds if it doesn't dilute these patterns.

**The schema is the source of truth.** `db/schema.sql` is hand-rolled
SQL with Postgres ENUMs, a `gist` exclusion constraint
(`no_overlap_when_held`) that physically prevents double-booking on
held statuses, and a `daterange(_, _, '[)')` half-open convention that
matches the in-app overlap math. `db/enums.ts` mirrors the SQL enums
in TypeScript and the rule is *change the SQL, change the mirror* —
exactly the lockstep discipline that AI-assisted codebases drift away
from.

**The snapshots principle is rigorous.** Bookings carry frozen money
columns (`agreed_property_cents`, `agreed_cleaning_cents`) and a
frozen `payment_policy` JSONB. Editing a property's rate template
doesn't reach back into past bookings; flipping the active estate
policy at `/admin/payments` doesn't change snapshots already taken.
This is the right boundary, and the codebase enforces it in three
places (schema CHECK, resolver in `src/lib/payment.ts`, the
`requestBooking` action). It's a textbook example of "protecting
architecture instead of just solving the problem".

**Derived state, not denormalised state.** Admin alerts are computed
from `bookingBucket × paymentState × date` every render — there is no
notifications table, no read/unread tracking. The bell count *is*
"what's true right now". Same for `/admin/payments`: outstanding,
upcoming balance, recent payments, stale Stripe sessions are all
queries, not stored aggregates. This avoids the classic
"cached-aggregate drifted from reality" bug and keeps the surface
honest.

**Observability has a home.** `/debug` is read-only and shows schema
state, live row counts, the e2e flow recap, refund preview, colour
tokens, and the `finca.json` viewer. `/forms` is a visual catalog of
every form in the app, rendered with mock data and wrapped in
`<fieldset disabled>` so submissions don't fire. These two routes are
the difference between "we'll find out in production" and "we already
know". Keep them.

**One Neon Pool, one client.** All app code that hits the DB imports
from `@db/client`. No second connection path has crept in. The
`tsconfig` alias enforces it.

## Risk inventory before adding more surface

Three patterns already drifting (`docs/bugs.md` flags them but they're
worth restating because the next mile will multiply each one).

The aggregator-math triplet. `aggregateBookings` lives in
`src/lib/bookingState.ts`, the estate overview re-derives the same
math in SQL `FILTER`, and `BookingsExplorer.accumulateMath` derives it
a third time in JS. They've already drifted once — the explorer
splits *confirmed* into *unpaid* vs *completed* by paid-in-full;
`EstateOverview` doesn't. Adding a Tano-specific dashboard or a
host-specific revenue chart will tempt a fourth aggregator. Don't
build it. Fold into `aggregateBookings` or call it from a single
SQL view.

`BookingRow` ships to the client with `access_token` attached. The
admin bookings explorer receives `BookingRow[]` directly; the
guest-side magic-link credential rides in the React Server Component
serialization. The fix is the same one already applied for
`UserBookingChips` (a `BookingChipSource` narrowing at the
server/client boundary). Apply the same narrowing to
`BookingsExplorer`'s props *before* the new auth lands and email links
go out, otherwise tokens will exfiltrate via screen-shares.

The booking detail mutability gap. `transitionStatus` enforces
`confirmed → checked_in` only when `date_check_in === today`. If a
guest arrives late, there is no UI to shift the check-in date — admin
has to cancel and recreate. The `overdue_checkin` alert points at a
booking the admin can't currently resolve cleanly. This is small
(one server action with the same exclusion-constraint guard
`createAdminBooking` uses) but it'll bite Tano hard the first time it
happens in real life.

## The three-interface split (David / Tano / guest)

Today there is one `/admin` console serving both David and Tano. The
schema already knows that money flows two ways
(`agreed_property_cents` = David, `agreed_cleaning_cents` = Tano), but
no `role` column on `users`, no per-role layout, no per-role
authorization gate. Both admins see everything.

That's fine until it isn't. Tano on a phone, on the property, in the
middle of a turnover, does not want the payments HQ — he wants
**today's check-out, today's check-in, the cleaning fee owed, and
the next 48 hours**. David on a laptop wants the policy switcher,
the outstanding-balance breakdown, the cancellation refunds, and the
revenue report.

The cleanest path forward, in the order it pays off:

**Add a `role` column to `users`** (`'guest' | 'jefe' | 'host'`) and
backfill the two existing humans. This is one ENUM, one column, one
seed update. The codebase already mirrors enums between SQL and TS,
so this is two files and a `db:init`.

**Split the admin layout, not the data layer.** Keep `src/lib/*` and
`src/actions/*` unchanged — they're already role-agnostic and that's
correct. Branch at the route layer: `/admin` (David's view, the
existing four sections), `/jefe` (Tano's view, a phone-first
single-pane "today + 48h" with the four operational actions:
check-in, check-out, record cash payment, log extra cleaning fee). A
shared header pill identifies which mode you're in. Both reach into
the same `bookings`, `booking_payments`, `booking_service_fees`
tables; the bell on `/jefe` filters `getAdminAlerts()` to the
operational kinds (`check_in_today`, `overdue_checkin`,
`checked_in_unpaid`), the bell on `/admin` shows the full set plus
`request_awaiting`.

**Make the guest a real first-class auth user, not a URL-typed row.**
`/user/[id]` is currently typeable in the browser. `booking.access_token`
already exists on the schema for the future magic-link flow. The
right move is to lean on that token: an email-magic-link login (no
passwords, no OAuth complexity for a four-property estate) signs the
guest in and resolves `/user` to *their* dashboard. Same token,
incidentally, is what the invitation accept link needs — one
mechanism solves two problems.

**Authorization, not just authentication.** Once `role` exists, a
single helper (`requireRole('host')`, `requireRole('jefe')`) wraps
the admin layouts and the server actions that mutate sensitive
state (`updateActivePaymentPolicy`, `cancelBooking` from admin path,
`createAdminBooking`). Don't sprinkle the check into each action —
factor it once.

## Auth, email, Cloudinary, Airbnb — concrete shape

### Auth

The lightest credible auth for this estate is **email magic-link**
(no passwords). Either Auth.js (NextAuth v5) with the EmailProvider, or
Supabase Auth, or a hand-rolled tokens-on-Postgres flow that reuses
`booking.access_token`'s pattern.

Recommendation: **Auth.js v5 + Resend (or Postmark) as the email
transport**, with the session stored in a `sessions` table on the
same Neon Postgres. Reasoning: Auth.js v5 maps cleanly onto Next 16's
RSC + middleware, the Resend adapter is one route handler, and
keeping sessions in Postgres avoids a second persistence layer. The
existing `users.email UNIQUE` already supports the lookup.

The architectural cost is roughly: one `sessions` table, one
`accounts`-style table if you want OAuth later, one `auth.ts` config,
one middleware, and replacing the `// FUTURE — auth gate` comments in
`PropertyView` and `/user` with a real check. None of `src/lib/*` or
`src/actions/*` should need to know what auth library you picked —
they should only call `getCurrentUser()` / `requireRole()`.

### Transactional email

Five emails define the product:

1. Booking-request confirmation to guest (with the `access_token`
   magic link to manage the stay).
2. Booking-confirmed to guest (with the `.ics` attachment — the
   `/api/bookings/[id]/ical` endpoint already exists).
3. Balance-due reminder to guest, fired `N` days before check-in (N
   from the snapshot payment policy).
4. Cancellation confirmation (with the refund tier that fired).
5. New-request notification to David (so the bell isn't the only
   channel).

All five are pure functions of booking state + finca.json copy, so
they fit the codebase's "derived, not stored" pattern. Put templates
in `src/emails/<name>.tsx` using `react-email` so the same components
that style the app style the emails. Send via Resend; their React
Email integration is one function call. Keep templates in `/forms`'s
spirit — a `/debug/emails` page that renders each template with mock
data and a *Send to me* button, so David can review them before they
go live.

### Cloudinary (or Vercel Blob, or R2)

Property images today are `public/images/{slug}.png`. Six files,
checked into git, no responsive sizing, no transforms. That's fine
for the bento grid hero shots but will collapse the moment you add a
gallery (interior, exterior, view, bedroom, kitchen × 4 properties =
20–40 images).

Two architectural choices here, in tension:

**Cloudinary** gives the most leverage per dollar of integration:
on-the-fly transforms (`w_800,c_fill,q_auto,f_auto`), automatic AVIF,
folder-based slugs (`finca/levante/hero.jpg`), and a free tier that
covers this volume. The cost is a second vendor and a third
client-side asset URL pattern (Next/Image local + `next/image`
remote + Cloudinary `next-cloudinary`). To stay coherent: never use
`next-cloudinary`'s components directly. Wrap them once in
`src/components/shared/PropertyImage.tsx` and never let raw
Cloudinary URLs bleed into route files.

**Vercel Blob or Cloudflare R2** gives you a bucket per slug, you
build the resize ladder yourself (or accept `next/image`'s defaults
against the remote URL), and you keep the toolchain single-vendor.
Less leverage, more discipline.

For an estate at this scale, **Cloudinary wins** — Tano can upload
through the Cloudinary admin without learning a new tool, David gets
auto-format, and the existing `slug`-keyed pattern in
`PropertyShowcaseGrid.imageFor(slug)` becomes `imageFor(slug,
{ size: 'card' })` with one signature change.

Schema impact: add a `properties.image_keys jsonb` column shaped
`{ hero: 'finca/levante/hero', gallery: [...] }`. Snapshot principle
still holds — bookings don't carry images, so editing the gallery
later is safe.

### Airbnb sync (the hard one)

Airbnb does not have a public booking API for hosts. The only
mechanism they expose is **iCal feeds** (RFC-5545), and only for
*availability* — not for guest details, not for prices, not for
two-way messaging. Two directions:

**Outbound (Delta → Airbnb).** Airbnb consumes one ICS URL per
listing. Build `/api/properties/[slug]/ical` (the route is already
sketched in `docs/ics.md` as "Not built yet"). It emits one
`VEVENT` per held booking *and* one per `property_blocks` row, all
within a forward window. Token-gated (one secret per property) so
the URLs don't leak. Once David pastes that URL into each Airbnb
listing's *Sync your calendar* field, Airbnb stops accepting double
bookings.

**Inbound (Airbnb → Delta).** Pull each Airbnb listing's ICS feed on
a cron (`bun --env-file=… run sync/airbnb.ts` every 30 minutes), parse
the VEVENTs, and upsert into `property_blocks` with
`reason='airbnb:<uid>'`. Use the VEVENT UID as the dedupe key. This
keeps the Delta calendar honest about Airbnb-sourced reservations
without modelling them as Delta bookings (they aren't — no Delta
money flows through them, no Delta guest record).

Architectural note: the Airbnb-sourced rows belong in
`property_blocks` (not `bookings`) because of the snapshot principle.
A Delta `booking` carries frozen money state; an Airbnb reservation
has none of that. Modelling it as a `block` is the honest fit. The
existing exclusion constraint on `property_blocks` then prevents
Delta from accepting a booking that overlaps an Airbnb one.

The cron pattern: deploy on Vercel Cron or a small Cloudflare
Worker, hit a `/api/cron/sync-airbnb` route with a shared secret,
re-run the diff. Idempotent by UID. The sync becomes a debuggable
unit you can rerun by hand — same shape as the `db/smoke_*.ts`
scripts already in the codebase.

What Airbnb sync **doesn't** give you: guest names, prices, message
threads, review state. That's fine — Delta's pitch is direct
booking, and the Airbnb feed is just the conflict-avoidance layer.

## A phased plan

The order matters because each phase de-risks the next.

**Phase 1 — auth + role split, no new surface.**
Add `users.role`, magic-link auth via Auth.js + Resend, gate `/user`,
gate `/admin` to role `'host'`, split out `/jefe` (route only — content
can ship as a thin v0). Replace the `// FUTURE — auth gate` comments.
Narrow `BookingsExplorer` to drop `access_token`. Add an "adjust
check-in date" action on the booking detail page. This is the riskiest
phase and the one that unlocks everything else.

**Phase 2 — Cloudinary, gallery, SEO.**
Migrate images to Cloudinary, add a `properties.image_keys` JSONB,
add a property gallery component, and add `generateMetadata` to
`/finca` and `/finca/[slug]` with OG images served by Cloudinary's
on-the-fly transforms (which doubles as the social-share image
solution). Add `sitemap.ts`, `robots.ts`, `LodgingBusiness` JSON-LD.
This is the phase that pays off in organic traffic.

**Phase 3 — transactional email.**
Five templates (request confirm, booking confirm + ICS,
balance reminder, cancellation, host notification), all via
`react-email` + Resend. A `/debug/emails` preview page. The
balance-reminder cron piggybacks the same pattern as the
Airbnb-sync cron in Phase 4.

**Phase 4 — Airbnb sync (both directions).**
Outbound `/api/properties/[slug]/ical` token-gated feed. Inbound
cron that upserts Airbnb VEVENTs as `property_blocks` rows. Document
the token rotation procedure for David in `docs/airbnb.md`.

**Phase 5 — scheduled balance charge.**
Stripe auto-pull `N` days before check-in. This is the only piece
that turns Delta from "trustworthy admin app" into "actually runs
the business while you sleep". `balanceDueDate()` already exists.
Needs a scheduled job + a `payment_intents.confirm` call against the
saved payment method.

## What I would push back on

Two things in the current direction that deserve a second look.

**Hiding the demo user list behind `?demo=1` is a band-aid for not
having auth.** It works for the demo, but it's a load-bearing
band-aid — the moment auth lands, that whole conditional disappears
and so does the URL parameter. The shape of `/user` is going to
change entirely (resolve to logged-in user, no list at all). Don't
invest more effort in the demo-mode list before Phase 1.

**The "soft Airbnb link in the footer" framing.** The README says
the goal is to drift away from Airbnb, but the platform's strongest
move against Airbnb is *price parity + an extra perk for booking
direct* (free late check-out, an extra night's flexibility, the .ics
in the confirmation email). Hiding the Airbnb link doesn't drive
direct bookings — it just makes the page feel less generous. Once
Phase 4 lands and the calendars are synced both ways, the Airbnb
listing becomes a discovery channel that feeds direct bookings.
That's the right shape: Airbnb finds you, San Mateo books you.

## What I think, in one paragraph

The codebase is unusually disciplined for a single-developer project
at this stage. The schema-as-source-of-truth, the snapshots
principle, the derived-not-stored pattern for alerts and payments
HQ, the `/debug` + `/forms` observability surfaces — these are the
exact patterns that hold a system together once AI-assisted churn
starts. The next mile (three roles, auth, Cloudinary, email, Airbnb
sync) doesn't ask you to invent new patterns; it asks you to
*extend* the ones already here. Role on `users`, one helper for
authorization, one narrowing at the server/client boundary, one
Cloudinary wrapper, one email-as-derived-state module, one ICS
endpoint per property, and one cron sync. If each of those lands as
a single canonical module — not three drift-prone copies — Delta
will out-architect every Airbnb clone it touches.
