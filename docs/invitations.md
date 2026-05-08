# Invitations

Admin-issued bookings priced manually for friends &amp; family. Lives at
`/admin/invite`. Schema is `bookings` (with `status='invite'`) joined 1:1 with
`booking_invitations`.

## Why it's not just "a regular booking with a custom price"

A normal booking — `requestBooking` from `/finca/[slug]` — runs `computeQuote`
which reads `properties.rates[<check-in month>]` and multiplies by nights.
The rate engine is the source of truth.

An invitation says **"I'm bypassing the rate engine for this guest."** The
admin types two numbers (property fee + cleaning fee), and those go straight
onto the booking as the snapshot. To keep the favor visible — both for the
host (was this a 30% discount? a free week?) and for the audit trail — we
store what `computeQuote` *would* have returned in the `booking.invited`
audit event payload. The `/admin/invite` table reads that back so each row
shows custom-vs-default at a glance.

The booking's `agreed_property_cents` and `agreed_cleaning_cents` columns
take both values cleanly — there's no schema branch for "regular" vs
"invitation". The status enum is the only marker. This means cancellations,
refunds, payments, and the calendar all just work for invitations without
any special handling.

## Lifecycle

## Two paths: hold vs confirm-now

The form has a "On submit" toggle:

- **Hold for invitee to accept** (default) — booking starts as `invite`,
  invitation as `invited`. Standard "send and wait" flow. Dates aren't
  locked yet (the EXCLUDE constraint on `bookings` only fires for held
  statuses), so two pending invitations could overlap; whichever the
  invitee accepts first wins.
- **Confirm now** — admin already trusts the invitee (friends, family,
  themselves). Booking goes straight to `confirmed`, invitation is filed
  as `accepted` with `accepted_user_id` = the upserted user and
  `responded_at` = now. **Dates lock immediately** via the EXCLUDE
  constraint. No accept-link round-trip.

```
admin types form          createInvitation(confirm_now)
        │                         │
        ▼                         ▼
  /admin/invite/new        ─ tx ─────────────────────────────────
                           │  upsert user (by email)             │
                           │  FOR UPDATE overlap check on        │
                           │    held bookings                    │
                           │  insert booking                     │
                           │    status = 'invite' OR 'confirmed' │
                           │  insert booking_invitations         │
                           │    status = 'invited' OR 'accepted' │
                           │  log booking.invited event          │
                           ───────────────────────────────────────
                                   │
                  ┌────────────────┼────────────────┐
                  ▼                ▼                ▼
            confirm_now=true   invitee accepts   admin revokes
                  │                │                │
            already at         booking →        booking →
            confirmed          confirmed        cancelled
            (no further        invitation →     invitation →
             action needed)    accepted         declined
```

## Data model

| Column                              | Where                  | Notes |
| ----------------------------------- | ---------------------- | ----- |
| `bookings.status`                   | bookings               | `'invite'` until accepted/revoked |
| `bookings.agreed_property_cents`    | bookings               | Custom snapshot (admin override) |
| `bookings.agreed_cleaning_cents`    | bookings               | Custom snapshot |
| `bookings.access_token`             | bookings (UUID)        | Unauthed accept-link target (future) |
| `booking_invitations.email`         | booking_invitations    | Where the invite would email |
| `booking_invitations.status`        | booking_invitations    | `invited` / `accepted` / `declined` |
| `booking_invitations.accepted_user_id` | booking_invitations | Set when invitee accepts (future) |
| `booking_events.event_type='booking.invited'` | events       | Audit row with default fee snapshot |

## Action recipes

### Create an invitation
1. Open `/admin/invite/new`.
2. Pick property → calendar swaps to that property's items (admin mode shows
   held bookings + blocks).
3. Click two days. Form recomputes the default quote via
   `previewInviteQuote` (a thin wrapper around `computeQuote` —
   the rate engine is now just a JSONB lookup).
4. Type the invitee's email. If it matches an existing user, the name field
   auto-fills via `<datalist>` autocomplete.
5. Override property fee + cleaning fee. Diff strip turns green for a
   discount, amber for a premium.
6. Toggle **On submit**: leave on "Hold for invitee" for the standard
   send-and-wait flow, or flip to "Confirm now" if the invitee has already
   verbally agreed (the booking goes straight to `confirmed`; dates lock).
7. Submit — `createInvitation` runs in a tx with `FOR UPDATE` overlap check
   (because Postgres' exclusion constraint only fires on held statuses).

### Revoke a pending invitation
On `/admin/invite`, click **Revoke** on a row with status `invited`. Flips
the booking to `cancelled` and the invitation to `declined`, both in one tx.
Logs a `booking.invitation_revoked` event.

### Accept an invitation (TBD)
Not yet built. The endpoint should:
1. Resolve the booking by `access_token` → `/booking/[token]`.
2. Show the invitee a one-click **Accept** / **Decline** UI.
3. On accept: flip booking → `confirmed` + invitation → `accepted` +
   set `accepted_user_id`. Same overlap check as creation since dates may
   have been taken by another booking in the meantime.
4. On decline: flip invitation → `declined`, booking → `cancelled`.

## Invariants

- **Custom snapshot, not recalculation.** The `agreed_*_cents` on an
  invitation booking are frozen at creation time. Editing
  `properties.cleaning_fee_cents` or `properties.rates` later does *not*
  change the invitation's totals. Same snapshots principle as regular
  bookings — see `memory/snapshots_principle.md`.
- **Cross-status overlap protection.** The `bookings` table's exclusion
  constraint (`no_overlap_when_held`) only excludes `confirmed`/
  `checked_in`/`checked_out`. Creating an invitation that overlaps a held
  booking would NOT trip the constraint, so `createInvitation` re-checks
  with `FOR UPDATE` inside the tx.
- **Email uniqueness.** Multiple invitations may be sent to the same email
  (different bookings). The unique index on `users.email` upserts a single
  user record they all attach to. The unique index on
  `booking_invitations.booking_id` enforces 1 invitation per booking row.
- **Default-fee audit.** `createInvitation` best-efforts `computeQuote`
  alongside the insert and snapshots both default totals into the
  `booking.invited` event. This is the only way the table can show the diff
  later — the rate engine is non-deterministic over time as rates evolve,
  so we can't recompute it post-hoc.

## Reference

| File                                                          | What                                                |
| ------------------------------------------------------------- | --------------------------------------------------- |
| `db/schema.sql` (booking_invitations)                         | Table + invitation_status enum                      |
| `src/lib/invitations.ts`                                      | listInvitations, getInvitationById, invitationStats |
| `src/actions/invitations.ts`                                  | createInvitation, revokeInvitation, previewInviteQuote |
| `src/components/admin/invite/InviteForm.tsx`                  | Client form with live diff vs default               |
| `src/components/admin/invite/InvitationsTable.tsx`            | List rendering with diff pill + revoke              |
| `src/app/admin/invite/page.tsx`                               | List + filters + stats strip                        |
| `src/app/admin/invite/new/page.tsx`                           | Form server-shell                                   |
| `src/components/debug/DebugInvitationsPanel.tsx`              | Live narrative on /debug                            |
