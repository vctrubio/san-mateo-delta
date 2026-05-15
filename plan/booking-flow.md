# Booking flow — the full user story

The slug page (`/finca/[slug]`) today is a *browsing* surface: lead,
photos, availability calendar, price summary. The user has no way to
actually book. This phase wires the booking flow end-to-end without
touching auth (deferred to its own phase) and without integrating the
Airbnb iCal sync (also deferred — stubbed).

The terminus of this phase: a guest can pick dates on
`/finca/[slug]`, click `Book`, land on `/book`, fill in guest details,
and either bounce through Stripe Checkout (for paid policies) or
submit directly (for cash policies). End state matches what the old
`PropertyView` used to do, but split across two routes so each surface
has one job.

## What's intentionally not in scope

These are *named* stubs / TODOs so we don't surprise ourselves later:

- **Auth gate.** `/book` will eventually require a logged-in user.
  Today it accepts anonymous submissions. Add a one-liner stub at the
  top of the route — `// TODO(auth): require session, gate by role`.
- **Airbnb iCal availability check.** Before booking, the back end
  should query the property's Airbnb iCal feed to make sure the dates
  aren't already taken on Airbnb. Today the calendar only respects
  internal `bookings.no_overlap_when_held`. Stub a function
  `checkExternalAvailability(slug, range)` that returns `{ ok: true }`
  with a `// TODO(airbnb-ical)` comment.
- **Admin invitation path.** Admin sending a magic-link to a friend
  for a custom-priced stay is a separate flow (`/admin/invite` already
  exists). The new `/book` route is the *guest* path. Admin
  invitations will hand the guest a URL into `/book` later.
- **Email confirmations.** Will land alongside auth + transactional
  email. The booking succeeds today and the user lands on
  `/user/[id]?just_booked=…`; an email is not sent.

## Mental model — one umbrella unit called `Reservation`

Everything a guest fills in while booking is one logical object: which
property, which dates, how many guests, who they are, what policy
they're agreeing to, how much it costs. The state shape + pure
computation helpers live in `src/lib/reservation.ts` (no React); the
React surface is a **`useReservation()`** hook that wraps the state +
exposes setters, computed values, and the submit handler.

Why a hook over a class:

- React-native — `useState` / `useMemo` / `useCallback` are the
  primitives the rest of the codebase uses; no surprise mutation,
  no class-instance-in-state quirks.
- Re-renders are precise — `useMemo` keys the derived state
  (quote, resolved policy, total, deposit) on the exact inputs that
  feed them. The component reads `rv.total` and it's recomputed
  only when range/property changes.
- One method, one consumer — `submit()` is `useCallback`'d and
  fires the existing server action.

```ts
// Plain TypeScript (no React) — lives in src/lib/reservation.ts
export type ReservationCtx = {
  property: Property;
  activePolicy: PaymentPolicy;
  today: string;                   // YYYY-MM-DD
};
export type ReservationState = {
  range: { from: string; to: string } | null;
  guests: GuestCounts;
  identity: Identity;
};

// Pure helpers (no React)
export function computeQuote(ctx, state): Quote | null;
export function resolveReservationPolicy(ctx, state): ResolvedPolicy;
export function validateReservation(ctx, state): ValidationResult;
```

```ts
// React hook — lives in src/components/book/useReservation.ts
export function useReservation(ctx: ReservationCtx, initial: ReservationState) {
  const [state, setState] = useState(initial);

  const setRange    = (from, to) => setState(s => ({ ...s, range: { from, to } }));
  const setGuests   = (g) => setState(s => ({ ...s, guests: g }));
  const setIdentity = (i: Partial<Identity>) => setState(s => ({ ...s, identity: { ...s.identity, ...i } }));

  const quote          = useMemo(() => computeQuote(ctx, state),          [ctx, state.range]);
  const resolvedPolicy = useMemo(() => resolveReservationPolicy(ctx, state), [ctx, state.range]);
  const validation     = useMemo(() => validateReservation(ctx, state),    [ctx, state]);
  const total          = quote?.total ?? 0;
  const deposit        = Math.round((total * resolvedPolicy.effective.deposit_pct) / 100);
  const chargesCard    = chargesCardAtBooking(resolvedPolicy.effective);

  const submit = useCallback(async (): Promise<SubmitResult> => {
    // 1. Re-run validation client-side
    // 2. Call requestBooking with FormData
    // 3. Branch: stripe → createCheckoutSession → redirect, cash → /user/[id]?just_booked
  }, [ctx, state]);

  return { state, setRange, setGuests, setIdentity, quote, resolvedPolicy, total, deposit, chargesCard, validation, submit };
}
```

State and ctx shapes:

```ts
type ReservationCtx = {
  property: Property;
  activePolicy: PaymentPolicy;     // estate-wide default at page-load
  today: string;                    // YYYY-MM-DD (UTC), passed in to keep
                                    //   the class pure
};

type ReservationState = {
  range: { from: string; to: string } | null;
  guests: GuestCounts;             // re-uses existing src/lib/guests.ts
  identity: Identity;
};

type Identity = {
  name: string;
  email: string;
  tif?: string;
  nationality?: string;
  dob?: string;                    // YYYY-MM-DD
};

type SubmitResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: string };
```

## URL design — `/book` is a top-level route

Not `/finca/[slug]/book`. The user wants a clean URL the page owns;
`/book?slug=…` makes the property a parameter, which scales when
admin needs to pre-fill custom prices or sub-paths later.

```
/book?slug=levante&from=2026-06-15&to=2026-06-22&adults=2&children=0&pets=0
```

Why query params over path segments:

- Bookmarkable + shareable as-is.
- Easy to default missing values server-side without choking on
  malformed paths.
- The same URL shape extends to admin invitations later (`/book?...&invite=<token>`).

The server page validates the query, fetches the property + active
policy, builds the initial `Reservation`, and renders
`<ReservationClient>` with that as a serialised seed.

## Route structure

```
src/app/
  book/
    page.tsx          # server — reads query, validates, builds Reservation seed
    layout.tsx        # OPTIONAL — minimal shell (no banner, no footer cluttering checkout)
  finca/
    [slug]/
      page.tsx        # adds the Book button + lifts date-selection state into a client wrapper
```

The `/book` layout intentionally doesn't reuse `FincaLayout` — the
banner + eyebrow + closing strip would compete with the checkout
focus. `/book` gets a stripped layout: top-bar with a back link, full
content area, no footer.

## Client architecture inside `/book`

```
<ReservationClient property={...} activePolicy={...} initialState={...}>
  Owns useState<Reservation> + form interactions.
  Renders the two-pane "open book" layout:

  ┌──────────────────────────────────┬──────────────────────────────────┐
  │  <ReservationSummaryPane />      │  <ReservationFormPane />         │
  │  (left)                          │  (right)                         │
  │                                  │                                  │
  │  - Property hero photo           │  - Date pickers (read-only       │
  │  - Title + dates                 │    from URL, with "Change" link  │
  │  - Receipt: nights × rate +      │    back to /finca/[slug])        │
  │    cleaning + total              │  - Guests (GuestConfig)          │
  │  - Deposit breakdown             │  - Identity (name, email, ...)   │
  │  - "Pay €X now · €Y on arrival"  │  - Errors                        │
  │                                  │  - Submit button                 │
  └──────────────────────────────────┴──────────────────────────────────┘
</ReservationClient>
```

Both panes derive everything they render from the `rv` state. The
form pane is the only one that writes (calls `setRv`).

On submit:

1. `rv.submit()` runs the same validation client-side first (early
   error UI without a round-trip).
2. Calls the existing `requestBooking` server action with the
   serialised payload.
3. If `chargesCardAtBooking` is true: action returns `bookingId` →
   client calls `createCheckoutSession(bookingId, 'deposit')` →
   `window.location.href = checkout.url`.
4. If false (cash policy / 0% upfront): action returns the
   `/user/[id]?just_booked=<id>` URL directly → client redirects.

No new server actions. We're reusing what was there before
`PropertyView` got deleted.

## Slug-page changes

`/finca/[slug]` is the entry point. Two adjustments:

1. **Add a `Book` button to the section tabs.** Layout flips from
   `[Property] [Availability] [Prices]` to
   `[Property] [Availability] [Prices]    ·    [Book]` — `Book` is
   right-aligned (`justify-between` on the nav). Disabled until dates
   are picked. Disabled-click switches the active tab to Availability
   so the user knows where to pick dates.

2. **Lift the date selection.** The Availability tab's `<Calendar>`
   needs `onSelectRange` wired. The slug page's PropertySectionTabs
   becomes the owner of the picked range. When a valid range is
   selected:
   - `Book` enables
   - The button's `href` is computed as `/book?slug=…&from=…&to=…`
   - Click → standard Next navigation

The state lives in a wrapper *inside* PropertySectionTabs (which is
already a client component, so the addition is contained).

## Security + validation

Plain Next-12+ rules; nothing exotic:

- **Server-side validation, every time.** The `/book` page validates
  the URL params (slug exists + is `public`, dates are well-formed,
  no overlap with held bookings on that property). If anything is
  off, it `notFound()` or redirects back to `/finca/[slug]`.
- **Re-validate inside the server action.** `requestBooking` already
  re-checks max_guests, date validity, and the exclusion constraint
  catches overlap. Client validation is for UX; server validation is
  for safety.
- **No secrets in URL.** Slug, dates, guests counts are all public.
  Identity (name/email) lives in POST body via the server action,
  never in the URL.
- **Token-protected admin invitations** (later). The admin-invite
  variant of `/book` will use `?invite=<access_token>` matched
  against `booking_invitations.access_token`. Stub the read for now,
  no behaviour yet.
- **Auth gate stub.** Top of `/book/page.tsx` has a clearly-marked
  `// TODO(auth): redirect to /login if no session`. When auth lands
  it's one line.

## Implementation order

A staged build so each commit is testable on its own.

**1. Wire date selection on /finca/[slug].**
   - Hoist range state into PropertySectionTabs.
   - Pass `onSelectRange` to the Availability tab's Calendar.
   - Add `Book` button (disabled state for now; enabled when range valid).
   - Commit point: dates can be picked, Book button visually responds.

**2. Build the Reservation class.**
   - `src/lib/reservation.ts` with the class + types.
   - Unit-checked (mostly via tsc + a smoke test if we want one).
   - No UI consumer yet. Commit point: class exists, types compile.

**3. Build /book route — the server shell.**
   - `src/app/book/page.tsx` (server) — reads query, validates,
     builds initial Reservation, renders a placeholder
     ReservationClient that just dumps the seed JSON.
   - `src/app/book/layout.tsx` — minimal shell.
   - Commit point: /book?slug=…&from=…&to=… renders without error.

**4. Build ReservationClient — the two-pane UI.**
   - `src/components/book/ReservationClient.tsx` (client).
   - Wraps useState<Reservation>.
   - Renders SummaryPane + FormPane in a `grid lg:grid-cols-2` shell.
   - Form fields work but submit is stubbed.
   - Commit point: the form is interactive, all derived state updates
     (receipt updates as guests / identity change).

**5. Wire submit → existing actions.**
   - `rv.submit()` calls `requestBooking` then optionally
     `createCheckoutSession`.
   - Redirect logic for cash vs Stripe vs collapsed.
   - Error display.
   - Commit point: end-to-end booking from /finca/[slug] → /book →
     confirmation page works for one property.

**6. Wire the slug-page Book button to navigate to /book.**
   - The button's href now points at /book with serialised params.
   - Commit point: full guest journey works without any modal.

**7. Cleanup.**
   - Audit and remove anywhere the homepage modal or other surfaces
     used to point at the old in-page booking flow.
   - Update doc panels (`/debug/user-story`, `/debug/stripe`) to
     reference /book instead of PropertyView.
   - Rename `PropertyPhotosWireframe` → `PropertyPhotos` while we're
     at it (no behavioural change).

Each step is its own commit. Step 1 is the smallest; step 5 is the
most code; step 7 is the cleanup tax.

## Modals to retire after /book ships

Audited list:

- **`PropertyShowcaseGrid` modal's "Book now" CTA** (homepage `/`)
  currently links to `/finca/[slug]#book` — an anchor that no longer
  exists. Once /book ships, this CTA can either:
  a) point at `/finca/[slug]` (default — guest still picks dates on
     the property page first), or
  b) skip straight to `/finca/[slug]?tab=availability` so the calendar
     is visible immediately.
  Recommendation: (b) — saves a click.

- **`SelectionActionModal`** on `/admin` — admin-side, used for
  creating bookings from the admin calendar. Keep. Admin invitations
  later might subsume it or call into `/book?invite=…`.

- **`BookingActionModal`** — admin-only state-transition modal. Keep.

- **Anything in the guest-side path** — already gone with PropertyView.

## Future hooks the class should leave room for

- **Admin invitation pricing.** Reservation needs to optionally take
  an `invitationOverridePrice` field that bypasses
  `quote.agreedPropertyCents`. One extra constructor arg, one branch
  in the `total` getter.
- **External availability check.** A `validateExternal()` async
  method on the class that wraps `checkExternalAvailability()` (the
  airbnb iCal stub). Today returns `{ ok: true }`. Later returns the
  real check.
- **Authenticated user prefill.** Once auth lands, the route hands
  the class an optional `currentUser` and the initial identity
  prefills from there.

## What this phase does NOT touch

To keep this branch small and safe to ship:

- Doesn't modify the existing `requestBooking` / `createCheckoutSession`
  actions.
- Doesn't change the schema.
- Doesn't change the admin side.
- Doesn't touch the Cloudinary integration.
- Doesn't add transactional email.

That's the whole plan. If this reads right, I'll start at step 1
(slug-page date wiring) and we can commit after each step so you can
poke at it as it grows.
