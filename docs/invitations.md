# Invitations

Admin-issued bookings priced manually for friends &amp; family. Created from
the admin calendar (drag a date range → `SelectionActionModal` → "Create
booking" → "Hold for invitee"). The list lives embedded in `/admin/users`
under the **Invitations** section. Schema is `bookings` (with
`status='invite'`) joined 1:1 with `booking_invitations`.

## Why it's not just "a regular booking with a custom price"

A normal booking — `requestBooking` from `/finca/[slug]` — runs `computeQuote`
which reads `properties.rates[<check-in month>]` and multiplies by nights.
The rate engine is the source of truth.

An invitation says **"I'm bypassing the rate engine for this guest."** The
admin types two numbers (property fee + cleaning fee), and those go straight
onto the booking as the snapshot. To keep the favor visible — both for the
host (was this a 30% discount? a free week?) and for the audit trail — we
store what `computeQuote` *would* have returned in the `booking.invited`
audit event payload. The Invitations table on `/admin/users` reads that
back so each row shows custom-vs-default at a glance.

The booking's `agreed_property_cents` and `agreed_cleaning_cents` columns
take both values cleanly — there's no schema branch for "regular" vs
"invitation". The status enum is the only marker. This means cancellations,
refunds, payments, and the calendar all just work for invitations without
any special handling.

## Lifecycle

## Two paths: hold vs confirm-now

The `SelectionActionModal` booking view has a Status picker:

- **Hold for invitee to accept** (`invite`) — booking starts as `invite`,
  invitation as `invited`. Standard "send and wait" flow. Dates aren't
  locked yet (the EXCLUDE constraint on `bookings` only fires for held
  statuses), so two pending invitations could overlap; whichever the
  invitee accepts first wins.
- **Confirm now** (`confirmed`) — admin already trusts the invitee (friends,
  family, themselves). Booking goes straight to `confirmed`, no
  `booking_invitations` row is created. **Dates lock immediately** via the
  EXCLUDE constraint.

Both paths flow through the same action: `createAdminBooking`. When
`status='invite'`, it also inserts the `booking_invitations` row inside
the same tx.

```
admin completes range     createAdminBooking(status='invite')
        │                         │
        ▼                         ▼
  SelectionActionModal     ─ tx ─────────────────────────────────
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
1. Open `/admin` (the calendar view) and click a property to focus it.
2. Drag a date range on the calendar. `SelectionActionModal` auto-opens.
3. Pick **Create booking**.
4. The form runs `previewQuote` to show the default quote alongside the
   custom-fee inputs. Diff strip turns green for a discount, amber for a
   premium.
5. Type the invitee's email. If it matches an existing user, the name field
   auto-fills via `<datalist>` autocomplete.
6. Override property fee + cleaning fee.
7. Pick **Hold for invite** under Status (or **Confirm now** for direct
   confirmation — see "Two paths" above).
8. Submit — `createAdminBooking` runs in a tx with `FOR UPDATE` overlap
   check (because Postgres' exclusion constraint only fires on held
   statuses) and inserts the `booking_invitations` row when status='invite'.

### Revoke a pending invitation
On `/admin/users` → Invitations section, click **Revoke** on a row with
status `invited`. Flips the booking to `cancelled` and the invitation to
`declined`, both in one tx. Logs a `booking.invitation_revoked` event.

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
  booking would NOT trip the constraint, so `createAdminBooking` re-checks
  with `FOR UPDATE` inside the tx.
- **Email uniqueness.** Multiple invitations may be sent to the same email
  (different bookings). The unique index on `users.email` upserts a single
  user record they all attach to. The unique index on
  `booking_invitations.booking_id` enforces 1 invitation per booking row.
- **Default-fee audit.** `createAdminBooking` best-efforts `computeQuote`
  alongside the insert and snapshots both default totals into the
  `booking.admin_created` event. This is the only way the table can show
  the diff later — the rate engine is non-deterministic over time as rates
  evolve, so we can't recompute it post-hoc.

## Reference

| File                                                          | What                                                |
| ------------------------------------------------------------- | --------------------------------------------------- |
| `db/schema.sql` (booking_invitations)                         | Table + invitation_status enum                      |
| `src/lib/invitations.ts`                                      | listInvitations, getInvitationById, invitationStats |
| `src/actions/invitations.ts`                                  | revokeInvitation                                    |
| `src/actions/bookings.ts` (createAdminBooking)                | Insert booking + booking_invitations row in one tx  |
| `src/components/shared/SelectionActionModal.tsx`              | Calendar entry point — Status picker, custom fees   |
| `src/app/admin/users/page.tsx` (Invitations section)          | List rendering with diff pill + revoke              |
| `src/components/debug/DebugInvitationsPanel.tsx`              | Live narrative on /debug                            |
