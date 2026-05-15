# Chat resume — 2026-05-15

Compressed handoff of the conversation that produced
`docs/case-study.md` and `about.md`. Read this when picking the
project back up so you don't have to re-derive the context.

## What was asked

> *"this is delta, a new booking reservation platform for Finca San
> Mateo, located in Tarifa Spain. Study the landing page. we want 3
> interfaces to the app, host/admin (david), jefe/admin (tano) for
> doing and confirming the checkins and payments, guest or user,
> people making the reservation through the app. we need to set up
> auth, cloudinary for the photos, email confirmation, and check
> availability inside airbnb or sync automatically the reservation
> and availability if possible. do a case study of the repo and
> tell me what u think"*

Then:

> *"also study this, https://www.facebook.com/CasaSanMateoTarifa the
> host and estate registered on fb, as well as his airbnb profile
> https://www.airbnb.com/users/profile/1467030082869236380 put this
> in an about.md so we know the links that we have, the profile of
> the host david his tlf and email that you found and any relevant
> information u can scrape. because we are going to work on this
> first, getting the proper design and information first. then the
> user experience like the form to sign up log in etc etc."*

## What got produced

| Artifact | Path | Purpose |
| --- | --- | --- |
| Case study | `docs/case-study.md` | The full architectural reading and the phased plan (auth → Cloudinary → email → Airbnb sync → scheduled balance). |
| About | `about.md` | Estate + host facts. Public links, what scraped, what is missing and needs to be asked of David. |
| Plan folder | `plan/` (this folder) | Rolling worklog. One md per phase. |

## Key takeaways (so future-Claude doesn't re-derive)

### What the codebase already does very well

Anchor any new work to these patterns; don't dilute them.

- **Schema as source of truth.** `db/schema.sql` is hand-rolled SQL
  with Postgres ENUMs, a `gist` exclusion constraint
  (`no_overlap_when_held`) that physically prevents double-booking on
  held statuses, half-open `daterange(_, _, '[)')` semantics matching
  the in-app math, and `db/enums.ts` mirroring the SQL enums in TS.
- **Snapshots principle.** `bookings.agreed_property_cents`,
  `agreed_cleaning_cents`, and `payment_policy` JSONB are all frozen
  at creation. Editing property templates or
  `DEFAULT_REFUND_POLICY` never reaches back into past bookings.
- **Derived state, not denormalised state.** Admin alerts derive from
  `bookingBucket × paymentState × date` every render. Payments HQ
  (`/admin/payments`) derives all five sections from queries. No
  notif table, no read/unread tracking.
- **Observability has a home.** `/debug` shows live system state;
  `/forms` is a visual catalog of every form with mocked data.
- **One Neon Pool, one client.** Everything imports `@db/client`.

### What's drifting (read `docs/bugs.md`)

- Three aggregator implementations (`aggregateBookings` vs
  `getEstateOverview` SQL FILTER vs `BookingsExplorer.accumulateMath`)
  already disagree on whether confirmed splits into unpaid+completed.
- `BookingsExplorer` ships `BookingRow[]` with `access_token` attached
  — the guest magic-link credential is in the client bundle. Fix
  this before email/auth lands.
- No UI to adjust `date_check_in` after creation; the
  `overdue_checkin` alert points at a booking admin can't resolve.

### The three-interface split

Today there is **one `/admin` console**. The split David (host /
revenue / policy) vs Tano (jefe / on-site / cleaning / check-ins)
vs guest (booking) is **not modelled in the DB** — `users` has no
`role` column.

Recommended:

- Add `users.role` ENUM `('guest' | 'jefe' | 'host')`. One column,
  one ENUM, one seed update.
- Branch at the route layer (`/admin` = David, `/jefe` = Tano,
  `/user` = guest). Keep `src/lib/*` and `src/actions/*`
  role-agnostic and gate them with one `requireRole()` helper.
- Auth via email magic-link (Auth.js v5 + Resend), reusing the
  `booking.access_token` pattern that already exists for invitation
  accept-links.

### Auth / email / Cloudinary / Airbnb-sync — concrete shape

| Concern | Today | Recommended |
| --- | --- | --- |
| Auth | Nothing. `/user/[id]` is URL-typeable. `?demo=1` band-aid hides demo accounts. | Auth.js v5 magic-link via Resend. Sessions in Neon Postgres. One `requireRole()` helper wraps admin layouts and sensitive actions. |
| Email | Nothing. `// Comms (deferred)` in `docs/user-story.md`. | `react-email` templates + Resend. 5 flows: request confirm, booking confirm + .ics, balance reminder, cancellation, host new-request notification. Preview at `/debug/emails`. |
| Cloudinary | All images are `public/images/{slug}.png`, 6 files. | Cloudinary, `properties.image_keys jsonb` column, single `<PropertyImage>` wrapper around `next-cloudinary`. |
| Airbnb sync | One-way outbound `.ics` per booking only (`/api/bookings/[id]/ical`). | Outbound `/api/properties/[slug]/ical` token-gated feed (Airbnb consumes). Inbound cron upserts Airbnb VEVENTs into `property_blocks` (NOT `bookings` — they have no Delta money flow). |

## What was learned about the estate (in `about.md`)

The headlines, so this file stands alone:

- The estate is **Casa San Mateo** at **Punta Paloma, Tarifa**, ~300m from Las Dunas beach.
- Andalucía tourism registration **`CTC-2018131304`** (national: `ESHFTU00001101400034874700200000000000CTC-20181313041`).
- **David** is a Superhost (~10 years), lives in **Madrid**, 323 reviews across all listings at 4.83★, 100% response rate. Airbnb co-host: **Lucia**.
- The Levante villa = Airbnb room **14146854** (4.89★, 71 reviews). The likely Cala mapping is room **19764689** ("Bungalow 1+2 Finca San Mateo") but unconfirmed.
- The **agent** Tarifa Beach Houses publishes external booking terms: **40% non-refundable bank-transfer deposit + 60% cash on arrival**, €50 cleaning, €250 refundable security deposit. Delta's current default is 50%/14d split — reconcile with David.

**Open questions to ask David** (full list in `about.md`):

1. His real phone and email (placeholders in `finca.json`).
2. Tano's phone and email (for the `/jefe` interface).
3. Slug ↔ Airbnb-room mapping for all four properties.
4. CTC numbers for Estrecho, Marea, Cala.
5. Real 12-month rate table per property.
6. Deposit policy: keep 40%/cash-on-arrival or move to 50/14?
7. Surface the €250 security deposit?
8. Photo rights for Cloudinary migration.
9. Lucia as a separate Delta `co_host` role?
10. FB page activity level.
11. Does he own `fincasanmateo.com`?

## Where to pick up

The user said:

> *"we are going to work on this first, getting the proper design
> and information first. then the user experience like the form to
> sign up log in etc etc."*

That maps to: **design + content first, auth second.**

The most leveraged "design + content" work is:

1. **Replace placeholders in `finca.json`** with real values from
   `about.md` (David's real phone/email, Tano's contact, the actual
   rate tables). Blocking on the answers in `about.md#what-is-still-missing`.
2. **Per-route metadata.** `src/app/layout.tsx` is the only file
   that exports `<title>` / `<description>`. Add `generateMetadata`
   to `/finca/page.tsx`, `/finca/[slug]/page.tsx`, with OG images.
3. **`LodgingBusiness` JSON-LD** on the homepage and per-property.
4. **`sitemap.ts` and `robots.ts`** at `src/app/`.
5. **The "Book a visit" button** in `AboutSection` is a dead end
   today — wire it to scroll to `#homes` or to a contact modal.
6. **The fake wind ticker in the footer** — either wire a real wind
   API (Windy / Open-Meteo against Tarifa coords) or replace with
   static "300+ days of wind" copy. Random-walk noise undermines
   the kite/wind brand.
7. **Polish the existing landing copy** against `finca.json` once
   the real values are in.

Then move into **Phase 1 (auth + roles)** per the table in
`plan/README.md`.

## A note on style

The user's stated preference (in their conversation profile):

> *The bottleneck is shifting from writing code to protecting
> architecture. The role of senior/lead engineers is quietly
> changing too. Less time writing the hardest code. More time
> defining guardrails, enforcing patterns in reviews, simplifying
> AI-generated complexity.*

When writing code on this project: **extend the patterns that
already exist, don't create parallel ones.** This codebase has the
discipline; the work is to keep it that way.
