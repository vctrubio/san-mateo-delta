# /admin dashboard

What the dashboard shows, why it shows it that way, and what it deliberately
leaves out.

## The question the dashboard answers

> **How much was made, who is owed what, and what's waiting on the host?**

That's it. Three things. State-machine detail (cancelled / checked_in /
checked_out distribution, status timelines, etc.) lives on `/admin/bookings`
where it's actionable per-booking. The dashboard is for the host or investor
who walks up and wants the headline in five seconds.

## The two money flows

The estate has two beneficiaries; their cuts are tracked separately on every
booking and never co-mingled.

| Who      | Column on `bookings`         | Source                                      |
| -------- | ---------------------------- | ------------------------------------------- |
| **David** (host)    | `agreed_property_cents` | Snapshot of `nights × night_rate` at request time |
| **Tano** (cleaner)  | `agreed_cleaning_cents` | Snapshot of `properties.cleaning_fee_cents` at request time |

Both columns are **frozen** the moment the booking is created (snapshots
principle — see `docs/refund.md` and `docs/rates.md`). Edits to property templates
or rates never alter past totals.

A booking's "agreed total" = `agreed_property_cents + agreed_cleaning_cents`.

## The five sections (top to bottom)

```
1. The money              — 5 hero tiles
2. By property            — 4 cards with David / Tano split
3. Revenue over time      — 12-month stacked bar chart
4. Pipeline               — request → confirmed funnel + live pending list
5. Insights               — top guests + recent activity
```

### 1 · The money — 5 hero tiles

Source: `src/lib/dashboard.ts#moneyHeadline()` · component:
`src/components/admin/DashboardMetrics.tsx`.

| Tile               | Meaning                                                    |
| ------------------ | ---------------------------------------------------------- |
| **Total bookings** | `COUNT(*)` from bookings — every status, all time.         |
| **Collected**      | `SUM(payments) − SUM(refunds)` — what's actually banked.   |
| **David earned**   | `SUM(agreed_property_cents)` over **held** bookings.       |
| **Tano earned**    | `SUM(agreed_cleaning_cents)` over **held** bookings.       |
| **Outstanding**    | held bookings' agreed total minus collected.               |

"Held" = `confirmed | checked_in | checked_out`. Anything else (request,
invite, cancelled) doesn't count toward earnings — those bookings haven't
secured a stay.

Note the asymmetry: **collected** is a payment fact, **David / Tano earned**
are agreement facts. They diverge as long as anything is unpaid.

### 2 · By property

Source: `perPropertyMoney()` · component:
`src/components/admin/dashboard/PerPropertyMoneyStrip.tsx`.

One card per property (Levante, Estrecho, Marea, Cala). Each card shows:

- Total revenue (held bookings)
- David's cut (in the property's brand color)
- Tano's cut (amber)
- A two-segment split bar visualising the David / Tano percentage
- Held bookings count
- Click → `/admin/properties/[slug]` for the full property view

This is the most operationally useful card on the page: a host sees instantly
which property is carrying the year, and how much of each property's revenue
is going to the cleaner.

### 3 · Revenue over time

Source: `revenueByMonth({ months: 12 })` · component:
`src/components/admin/charts/RevenueByMonthChart.tsx`.

12-month stacked bar chart. One stack per property, bars indexed by month.

- "Revenue" is **net** of refunds: `SUM(booking_payments.amount_cents) −
  SUM(payment_refunds.amount_cents)`, grouped by month and property.
- `generate_series` guarantees a row exists for every (month × property) cell,
  so the chart never has gaps even if a property had a quiet month.
- Property colors: see CSS vars in `src/app/globals.css`
  (`--color-property-levante`, …). Edit there to re-theme.

### 4 · Pipeline · request → confirmed

Source: `funnelStats()` + `pendingRequests()` · component:
`src/components/admin/dashboard/PipelinePanel.tsx`.

The **only** state-machine transition the dashboard cares about. Everything
downstream of `confirmed` (check-in, check-out, refunds) is operational and
lives on `/admin/bookings` and `/admin/bookings/[id]`. Cancellation is also
handled there, not here.

Top of the panel: 3 stats.

| Stat               | Meaning                                                |
| ------------------ | ------------------------------------------------------ |
| **Pending now**    | Count of `status IN ('request','invite')`.             |
| **Confirmed (30d)**| Confirmed bookings created in the last 30 days.        |
| **Conversion**     | confirmed_30d / inflow_30d as a percentage.            |

Below the stats: a horizontal funnel bar (confirmed-share vs still-pending),
then the live pending list. Each row carries inline `Confirm` / `Cancel`
buttons (re-using `BookingActionButtons`), so the host can clear the queue
from the dashboard without navigating away.

### 5 · Insights

Two columns:

- **Top guests** — top 5 users by lifetime spend (net of refunds).
  `topGuests()` joins users → bookings → payments → refunds.
- **Recent activity** — last 10 entries from `booking_events`. Append-only
  audit log of every status change and payment.

Each is a glance, not a workspace. Drilldown links go to the detail pages.

## What's deliberately NOT on the dashboard

These things were considered and cut. They're useful, just not at the
"first 5 seconds" altitude.

| Not here                                | Where it lives                                    |
| --------------------------------------- | ------------------------------------------------- |
| Status distribution (donut)             | Filterable table on `/admin/bookings`             |
| Bookings × status per property          | Filter chips on `/admin/bookings`                 |
| Cancellation rate / refund amount       | `/admin/bookings/[id]` per booking                |
| Outstanding-balance triage              | `/admin/payments?refund_only=...` + booking view  |
| Imminent-arrival list (next 48h)        | Calendar on `/admin/properties/[slug]`            |
| Occupancy %                             | Calendar on `/admin/properties/[slug]`            |
| Service fees (late_checkout, etc.)      | `/admin/bookings/[id]` (Tier 2, not yet built)    |

## Adding a new metric

The hot path is short. To add a tile or chart:

1. **Add a server query** in `src/lib/dashboard.ts`. One round-trip per
   function. Pure SQL — push aggregation to Postgres, not JS.
2. **Add a component** in `src/components/admin/dashboard/` (panels) or
   `src/components/admin/charts/` (charts). Server component for static
   data; client component (`'use client'`) only if it needs interactivity.
3. **Wire it into** `src/app/admin/page.tsx` inside an existing `<Section>`
   or as a new one.
4. **Document it here.** Update the table in section 1–5.

If the metric is about state-machine detail, ask whether it belongs on
`/admin/bookings` instead. The dashboard doubles as a curation problem.

## Reference

| File                                                          | What                                                |
| ------------------------------------------------------------- | --------------------------------------------------- |
| `src/lib/dashboard.ts`                                        | All aggregation queries.                            |
| `src/lib/colors.ts`                                           | `PROPERTY_SLUGS`, `PROPERTY_LABELS`, `BOOKING_STATUS_STYLES`, `PROPERTY_BLOCK_STYLE`. |
| `src/app/globals.css`                                         | CSS vars for property + status colors.              |
| `src/app/admin/page.tsx`                                      | Composition of the 5 sections.                      |
| `src/components/charts/primitives.tsx`                        | shadcn-style recharts wrappers (ChartContainer, ChartTooltipBody). |
| `src/components/admin/DashboardMetrics.tsx`                   | The 5 hero tiles.                                   |
| `src/components/admin/dashboard/PerPropertyMoneyStrip.tsx`    | Section 2.                                          |
| `src/components/admin/charts/RevenueByMonthChart.tsx`         | Section 3.                                          |
| `src/components/admin/dashboard/PipelinePanel.tsx`            | Section 4.                                          |
| `src/components/admin/dashboard/TopGuestsPanel.tsx`           | Section 5 left.                                     |

## Live story

`/debug` has a `DebugAdminPanel` that mirrors this doc with **live data**
pulled from the same helpers. If you want to see the populated state at any
point, run `bun db:fullseason` and visit `/debug`.
