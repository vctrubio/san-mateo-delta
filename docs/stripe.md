# Stripe payments

How money moves through delta — what's where, what fires what, and how to
operate it locally.

## The two methods

Every `booking_payments` row carries a `method` (cash or stripe) and a
`status` (pending, succeeded, failed). The two methods follow different
lifecycles but write to the same table.

```
                    ┌─────────────┐
                    │  booking    │  ← created in 'request' status
                    │  request    │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  cash on arrival    stripe deposit       stripe full
   (method=cash,     (method=stripe,     (method=stripe,
    pending)          pending → ...)      pending → ...)
        │                  │                  │
        ▼                  ▼                  ▼
   admin clicks    Stripe webhook       Stripe webhook
   "Mark received"  fires success        fires success
        │                  │                  │
        ▼                  ▼                  ▼
   status=succeeded  status=succeeded    status=succeeded
```

Cash-on-arrival rows are inserted at booking-request time so the
`Pending cash` tile on `/admin` shows the host what's owed.

Stripe rows are inserted by `createCheckoutSession` *after* a Stripe
Checkout Session is created, with the `cs_…` id, and stay `pending`
until the webhook flips them to `succeeded` (or `failed`).

## Schema

```
payment_method enum: 'cash' | 'stripe'
payment_status enum: 'pending' | 'succeeded' | 'failed'

booking_payments
  method                 payment_method (default 'cash')
  status                 payment_status (default 'succeeded')
  stripe_session_id      TEXT, NOT NULL when method='stripe' (CHECK constraint)
  stripe_payment_intent  TEXT, set on checkout.session.completed
  stripe_charge_id       TEXT, set on checkout.session.completed (used for refunds)

payment_refunds
  stripe_refund_id       TEXT, set on charge.refunded webhook
```

A CHECK on `booking_payments` enforces that stripe rows always have a
session id; cash rows never do. A unique partial index on
`stripe_session_id` (where not null) prevents duplicate webhook writes.

## Environment

```
STRIPE_SECRET_KEY              sk_test_…   (server-only)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  pk_test_…   (client; not yet used in dev)
STRIPE_WEBHOOK_SECRET          whsec_…     (set by `stripe listen`)
NEXT_PUBLIC_APP_URL            http://localhost:3000
```

All keys live in `.env.local` (gitignored). The committed `.env.example`
shows shape only.

The pinned API version is `2026-04-22.dahlia` (see
`src/lib/stripe/server.ts`). Bump deliberately when Stripe ships a new
API and update the SDK.

## Running locally

You need three terminals:

```bash
# 1. Next dev server
bun dev

# 2. Stripe webhook forwarder — copies the whsec_… into STRIPE_WEBHOOK_SECRET
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 3. Optional: trigger events without going through the UI
stripe trigger checkout.session.completed
```

`stripe listen` prints the signing secret on first run. Paste it into
`.env.local` once, then it stays the same on subsequent runs (CLI
single-tenant per machine).

## Branding the hosted Checkout page

Stripe Checkout (the page guests see at `checkout.stripe.com/...`) is partly
configured via API and partly via the Dashboard.

**Via API** — `src/actions/checkout.ts#createCheckoutSession`:
- `submit_type: 'book'` — button reads "Book" instead of "Pay"
- `line_items[0].price_data.product_data.name` — `Finca <name> · <Slug>`
- `line_items[0].price_data.product_data.description` — kind + formatted dates
- `custom_text.submit.message` — confirmation note + contact email

**Via Stripe Dashboard** (one-time, applies to all Checkout sessions):
1. https://dashboard.stripe.com/settings/branding
2. Upload a logo or icon (PNG, recommended 128×128).
3. Set the brand color (we use a Tarifa-ocean blue; pick something close to
   `--color-property-levante` if you want consistency with /admin).
4. The Dashboard preview reflects test-mode and live-mode separately —
   configure both, but the test page uses the test-mode branding only.

If the brand panel is empty, Checkout falls back to a plain Stripe header.

## Test cards

| Card                  | Outcome                                |
| --------------------- | -------------------------------------- |
| 4242 4242 4242 4242   | success                                |
| 4000 0000 0000 0002   | declined                               |
| 4000 0000 0000 9995   | succeeds; refundable for refund flow   |
| 4000 0025 0000 3155   | requires 3D Secure (auth challenge)    |

Expiry: any future date. CVC: any 3 digits. ZIP: any.

Full list: https://docs.stripe.com/testing#cards

## Lifecycle in code

| Step                       | File                                                | What                                              |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| Stripe SDK singleton       | `src/lib/stripe/server.ts`                          | Pinned API version, throws on missing key         |
| Create Checkout Session    | `src/actions/checkout.ts`                           | Inserts pending booking_payments row              |
| Webhook signature verify   | `src/app/api/webhooks/stripe/route.ts`              | `stripe.webhooks.constructEvent`                  |
| `checkout.session.completed` | webhook handler                                   | Flips pending → succeeded, sets pi_/ch_           |
| `checkout.session.expired` | webhook handler                                     | Flips pending → failed                            |
| `payment_intent.payment_failed` | webhook handler                                | Flips status to failed                            |
| `charge.refunded`          | webhook handler                                     | Inserts payment_refunds row                       |
| Admin refund button        | `src/actions/payments.ts#refundStripePayment`       | Calls Stripe refund API; webhook does the DB work |
| Mark cash received         | `src/actions/payments.ts#markCashReceived`          | Flips pending cash → succeeded                    |

## Idempotency

Webhooks may be retried. Every handler is idempotent:
- `checkout.session.completed` — no-ops if status is already `succeeded`.
- `charge.refunded` — checks `stripe_refund_id` before inserting.
- `payment_intent.payment_failed` — no-ops if status is `succeeded`.

If a handler throws, the route returns 5xx and Stripe retries with
backoff. **Always** preserve idempotency when adding new handlers.

## Refund policy vs Stripe refund

The cancellation policy in `docs/refund.md` decides *how much* the guest
is owed when they cancel. That's a snapshot stored on
`booking_cancellations.refund_amount_cents`. It's separate from the
*Stripe refund call* — which moves money back to the card.

When admin clicks "Refund full" on a Stripe payment row, we call
Stripe's refund API for the full charge. For partial refunds aligned
with the cancellation policy, pass `amount_cents` to the action (UI for
this lives on a future Tier-2 slice).

For cash payments, refunds are just rows in `payment_refunds` with no
Stripe id — the host hands cash back outside the system.

## What's intentionally not here

- **Stripe Connect / split payouts**: there's only one host bank account
  (David); Tano is paid out of band. No marketplace mechanics.
- **Subscriptions / recurring**: bookings are one-off charges.
- **Saved cards / customer portal**: every checkout is a fresh session.
- **Tax / VAT**: not modelled; rates and cleaning fees are gross.

## Pre-live checklist — DO NOT FLIP TO LIVE MODE UNTIL ALL ARE DONE

Going from `sk_test_…` / `pk_test_…` to `sk_live_…` / `pk_live_…` means real
money moves on a real card. Every item below must be ticked off first. The
order is roughly "blast radius" — the things that matter most are at the top.

- [ ] **Narrow the production webhook event subscription.** During first setup
  on 2026-05-08, *all* events were enabled on the Vercel destination as a
  shortcut. Stripe sends ~90 different event types; we only handle 4
  (`checkout.session.completed`, `checkout.session.expired`,
  `payment_intent.payment_failed`, `charge.refunded`). Edit the destination at
  https://dashboard.stripe.com/webhooks and tick only those 4. Reduces noise,
  lambda invocations, and attack surface.
- [ ] **Add admin auth.** `/admin/*` is currently unauthed — anyone with the
  URL can issue refunds via the production webhook secret indirectly (cancel
  a booking, run cancel-with-refund, the refund hits a real card). Wire a
  proxy.ts gate (basic auth at minimum) **before** flipping keys.
- [ ] **Verify webhook idempotency under live load.** The handler is
  idempotent on `stripe_session_id` and `stripe_refund_id` (unique partial
  indexes), but we've only stress-tested it with `stripe trigger`. Replay a
  charge.refunded twice manually before going live.
- [ ] **Test 3-D Secure / SCA flow.** Card `4000 0025 0000 3155` triggers a
  challenge. Confirm the success page resolves correctly; SCA was not in the
  initial smoke.
- [ ] **Set up Stripe Radar rules** for fraud (Stripe Dashboard → Radar).
  Default rules are reasonable; review the "block" thresholds.
- [ ] **Configure Stripe billing email receipts** so guests get a paper
  trail. Dashboard → Settings → Customer emails.
- [ ] **Real refund UX.** Currently the booking detail page only offers
  `Refund full`. Partial refunds aligned with the cancellation policy must
  pass `amount_cents`; build a UI for it (Tier 2).
- [ ] **Backup the `bookings` + `booking_payments` + `payment_refunds`
  tables** at least daily once real bookings start landing. Neon has
  point-in-time restore on paid plans — verify it's enabled.
- [ ] **Swap the keys** in Vercel env (`sk_live_…`, `pk_live_…`), update the
  webhook destination URL to live mode (or create a new live-mode destination
  alongside the test one — Stripe webhooks are mode-scoped).

The single guardrail that catches accidental live-mode use:
`STRIPE_SECRET_KEY` should start with `sk_test_` until every box above is
ticked. See AGENTS.md for the standing rule.

## Smoke test

```bash
bun db:smoke-stripe
```

Pulls the first `request` booking, creates a real test-mode Checkout
Session, prints the URL. Open it, pay with `4242 4242 4242 4242`. With
`stripe listen` running, the webhook flips the row to `succeeded` —
verify in `/admin/payments`.
