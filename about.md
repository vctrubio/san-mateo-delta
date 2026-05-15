# About — Finca San Mateo

Single source of truth for who the estate is, where it sits, and every
public surface where it appears today. The app currently pulls its copy
from `finca.json` at the repo root; treat this file as the *evidence
file* that backs (and corrects) what's in there. When something here
contradicts `finca.json`, fix `finca.json` — not this file.

## The estate

| Field | Value |
| --- | --- |
| Name (legal/Airbnb) | **Casa San Mateo** |
| Name (brand, app) | **Finca San Mateo** |
| Location | **Punta Paloma, Tarifa**, Cádiz, Andalucía, Spain |
| Region | Campo de Gibraltar |
| Distance to beach | **300 m** from Las Dunas / Punta Paloma beach (also one of the best kitesurf + windsurf spots in the world) |
| Nearest landmark | Volare Beach Bar (Punta Paloma) |
| Estate-wide check-in | 16:00 |
| Estate-wide check-out | 11:00 |
| Estate-wide capacity | ~14 guests across 4 properties |
| Pet-friendly | Yes |
| Parking | Private, gated property, plenty of space |
| Connectivity | Starlink Wi-Fi, Smart TVs, AC |
| Established | 2002 (per `finca.json`) — David has been coming for 40+ years |

### Regional registration

The estate (or at least the Levante unit) is registered with the
Andalusian tourism authority:

- **Andalucía regional registration:** `CTC-2018131304`
- **Spain national registration:** `ESHFTU00001101400034874700200000000000CTC-20181313041`

(Both pulled from the Airbnb listing for room 14146854. The same
`CTC-2018131304` reference number also appears on the Tarifa Beach
Houses agent listing as `REF: CT-2018131304`, which is how we know the
two listings cover the same physical estate.)

Other units (Estrecho, Marea, Cala) may have their own CTC numbers —
**unconfirmed, ask David**.

## The properties (4)

From `finca.json` and `db/seed.ts`:

| Slug | Title | Sleeps | Notes |
| --- | --- | --- | --- |
| `levante` | The Villa | 6 | This is the Airbnb listing room **14146854**, "Casa San Mateo, Tarifa, Punta Paloma". 180 m², 3 bedrooms, 5 beds, 2 baths, outdoor Jacuzzi, BBQ, heated floors, AC. |
| `estrecho` | The Residence | 4 | Likely the "Casita San Mateo" 2-floor unit on Tarifa Beach Houses (`REF: CT-2018131304`) — downstairs sleeps 2, upstairs sleeps 2+2 children. Outdoor kitchen, BBQ, kite-gear washing area, shaded terrace. |
| `marea` | The Retreat | 2 | **Unconfirmed external listing, ask David.** |
| `cala` | The Bungalow | 2 | Possibly Airbnb room **19764689** "Bungalow 1+2 Finca San Mateo" — that listing's body did not scrape, but the slug "Bungalow" matches `cala`'s positioning. **Confirm with David.** |

## The host — David

| Field | Value |
| --- | --- |
| First name | **David** |
| Role | Estate Owner |
| Quote | *"I've set up San Mateo so others can enjoy what I've been coming for the last 40 years."* |
| Lives in | Madrid, Spain |
| Airbnb profile | https://www.airbnb.com/users/profile/1467030082869236380 |
| Airbnb status | **Superhost**, 10 years hosting (since ~2016) |
| Airbnb total reviews | **323** across all listings, **4.83 / 5** average |
| Airbnb response rate | 100%, responds within an hour |
| Interests (public bio) | Outdoor activities, skiing, windsurfing, biking, golf |
| Personal phone | **MISSING — `finca.json` has `+34 600 000 000` placeholder. Ask David.** |
| Personal email | **MISSING — `finca.json` has `hello@fincasanmateo.com` which is brand/estate, not personal. Ask David which inbox he actually reads.** |

David's Airbnb bio, in his own words:

> I love outdoor activities, skiing, windsurfing, biking, golf.
>
> My favorite holiday destination is Tarifa were I have refurbished
> over the last years the property I have offered through Airbnb.
>
> Come and visit, you will fall in love with the place as it happened
> to me many years ago.

### David's Airbnb co-host

| Field | Value |
| --- | --- |
| Name | Lucia |
| Airbnb profile | https://www.airbnb.com/users/profile/1487951193232806928 |
| Relationship | Co-host on at least room 14146854. Not currently modelled in the app — `users` table has no `role` column yet, so neither David, Lucia, nor Tano are differentiated in the DB. |

## The jefe — Tano

| Field | Value |
| --- | --- |
| Name | **Tano** |
| Role | Jefe de Finca |
| Function | On-the-ground operations: check-ins, check-outs, cleaning, guest needs |
| Quote (from `finca.json`) | *"He will make sure nothing is missing during your stay."* |
| Phone | **MISSING. Ask David — Tano needs a number on the property page once the jefe interface lands.** |
| Email | **MISSING.** |

Tano is the person the Jefe interface (planned `/jefe` route, see
`plan/`) is being built for. Schema-wise he is paid through
`bookings.agreed_cleaning_cents`, which already snapshots per-booking,
but he doesn't have a user account or auth role yet.

## Where Finca San Mateo lives on the public internet

| Surface | URL | Notes |
| --- | --- | --- |
| Direct site (this app, planned) | https://fincasanmateo.com | Per `finca.json#contact.website`. **Live status not verified — confirm DNS + deployment.** |
| Brand email (planned) | hello@fincasanmateo.com | Per `finca.json`. Almost certainly an alias / not yet provisioned. Email infra is Phase 3. |
| Facebook page | https://www.facebook.com/CasaSanMateoTarifa | "Casa San Mateo at Tarifa". Spanish locale slug also valid: `/CasaSanMateoTarifa/?locale=es_ES`. Page content did not scrape (FB blocks anonymous fetches). |
| David's Airbnb profile | https://www.airbnb.com/users/profile/1467030082869236380 | (Also accessible as `airbnb.es`.) Used as the "we're on Airbnb" link in the landing footer. |
| Airbnb listing — Levante | https://www.airbnb.com/rooms/14146854 | "Casa San Mateo, Tarifa, Punta Paloma". 4.89 ★, 71 reviews, Superhost, pet-friendly. |
| Airbnb listing — likely Cala | https://www.airbnb.com/rooms/19764689 | "Bungalow 1+2 Finca San Mateo". **Listing body did not scrape, confirm slug mapping with David.** |
| External agent — Tarifa Beach Houses | https://tarifabeachhouses.com/property/casita-san-mateo/ | Same physical estate (matching reg ref `CT-2018131304`). Lists the 2-floor unit as "Casita San Mateo" with the 40%-deposit / 60%-cash-on-arrival booking terms below. |
| WhatsApp share (footer) | `wa.me/?text=…` | Generated at runtime in `src/components/landing/Footer.tsx`, not a fixed number. |

The Tarifa Beach Houses agent contact is +34 660 863 437 / their own
email — that's the **agent**, not David. Surface it only as "you may
have found us through Tarifa Beach Houses" if at all; the whole point
of Delta is to be the direct channel.

## Booking terms (as currently published externally)

These are the terms the **agent** (Tarifa Beach Houses) publishes for
the Estrecho-equivalent unit. They are the closest thing we have to
"David's house policy" from a public source, and they line up with
what the schema already supports.

| Term | Value | Maps to in Delta |
| --- | --- | --- |
| Check-in window | 16:00–20:00 | `finca.json#check_in_time = 16:00` |
| Check-out | 11:00 | `finca.json#check_out_time = 11:00` |
| Deposit at booking | 40% non-refundable, bank transfer | Roughly maps to the `split_*` presets in `src/lib/payment.ts`, but Delta uses **50%/14d** as the canonical split today. Confirm with David whether to add a `split_40` preset or migrate to 50%. |
| Balance | 60% in cash on arrival | Maps to the existing `cash` portion of payments + the `paid_at_arrival` flow on `booking_payments`. |
| Refundable security deposit | €250 | **Not modelled in the schema.** No `bookings.security_deposit_cents` column today. Phase 5 candidate. |
| Late arrival (>20:00) | Must be agreed by email in advance | Operational rule, not a system constraint. Surface as a copy block on the booking confirmation email. |
| Cancellation | 40% confirmation deposit non-refundable | Roughly maps to the refund tier logic in `docs/refund.md`. Compare tiers against David's actual policy and reconcile. |
| Cleaning fee | €50 / booking | Already modelled as `properties.cleaning_fee_cents` (snapshotted to `bookings.agreed_cleaning_cents`). |

### Public rate band (Estrecho unit, as published by the agent)

| Season | Per-night rate |
| --- | --- |
| July & August | €175 |
| June & September | €155 |
| Ground floor, rest of year | €115 |
| First floor, rest of year | €130 |
| Min stay (Jul / Aug) | 3 nights |

The Levante villa (180 m², sleeps 6) doesn't have a publicly listed
rate on Airbnb without selecting dates. The rates in `db/seed.ts` are
demo numbers — **ask David for the real 12-month rate table per
property** so the seed reflects the actual business.

## Travel context (already in `finca.json`)

Reproduced here so this file can stand on its own without the JSON:

| Origin | Distance | Time |
| --- | --- | --- |
| Málaga airport (AGP) | 150 km | 1h 45m drive |
| Sevilla airport (SVQ) | 200 km | 2h 15m drive |
| Tangier (Morocco) | — | 45m ferry, 1h time difference |

Locally relevant: Volare Beach Bar (at Punta Paloma), Las Dunas Beach
(the dune system the estate looks out over), the Strait of Gibraltar
visible from the property on a clear day.

## What is still missing and should be confirmed with David

This list exists so the next pass can ask David one batch of
questions instead of three.

1. **His phone and email** — both `finca.json` values are placeholders.
2. **Tano's phone and email** — needed for the `/jefe` interface, the new-booking SMS/email notification, and the contact section on the property page.
3. **Confirm the slug ↔ Airbnb-room mapping** — `levante` = 14146854 is confident; `cala` = 19764689 is a best guess; `estrecho` and `marea` are unmapped to external listings.
4. **Each property's CTC number** — only Levante's is currently known publicly.
5. **The real 12-month rate table per property** — `db/seed.ts` is demo.
6. **The real cancellation / deposit policy** — does he want to keep the agent's *40% non-refundable + 60% cash on arrival* on Delta, or move to 50/14 (the current Delta default), or something else?
7. **Should Delta surface the security deposit (€250)?** Today there is no column for it.
8. **Photography rights** — Phase 2 moves images to Cloudinary. Confirm David has full rights to the Airbnb photo set (or commission a fresh shoot).
9. **Lucia (Airbnb co-host)** — does she also get a Delta account? If so, what role: another `host`, or a separate `co_host`?
10. **The FB page** — is it actively managed, or just a placeholder? Should the app cross-post booking confirmations / availability updates there?
11. **Does David own `fincasanmateo.com`?** The brand URL appears in `finca.json` but DNS hasn't been verified.

## How this file is meant to be used

- **`finca.json` ships to the app at build time.** When a value here is more accurate than the JSON, update the JSON.
- **`docs/case-study.md`** is the architectural reading and the phased plan. It references *what* needs to ship; `about.md` (this file) is *who and where* it ships for.
- **`plan/`** holds the rolling chat-resume + per-phase task notes. Treat that as the worklog; treat `about.md` as the facts.
