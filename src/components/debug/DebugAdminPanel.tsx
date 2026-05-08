import Link from 'next/link';
import {
  LayoutDashboard,
  Coins,
  Building2,
  ChartBar,
  Trophy,
  Funnel,
  ListOrdered,
  ArrowRight,
} from 'lucide-react';
import {
  moneyHeadline,
  perPropertyMoney,
  funnelStats,
  revenueByMonth,
  pendingRequests,
  topGuests,
} from '@/lib/dashboard';
import { listBookings } from '@/lib/bookings';
import { PROPERTY_LABELS } from '@/lib/colors';

// ============================================================================
// DebugAdminPanel — narrates what /admin became and proves it with live data
// from the same helpers the real dashboard uses.
//
// Story: /admin became a money + pipeline view. Status detail (cancelled,
// checked_in, checked_out) is admin-only operational state that lives on
// /admin/bookings; the dashboard answers the questions a host or investor
// asks first — how much was made, who's owed, what's waiting.
// ============================================================================

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function DebugAdminPanel() {
  const [
    money, perProp, funnel, revenue, pending, leaderboard, bookingsTotalProbe,
  ] = await Promise.all([
    moneyHeadline(),
    perPropertyMoney(),
    funnelStats(),
    revenueByMonth({ months: 12 }),
    pendingRequests(5),
    topGuests(5),
    listBookings({ limit: 1 }),
  ]);

  const totalRevenue = revenue.reduce(
    (sum, m) => sum + m.levante + m.estrecho + m.marea + m.cala,
    0,
  );
  const totalBookings = bookingsTotalProbe.total;

  return (
    <section className="p-8 bg-slate-50 border-t border-slate-200">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-sm font-mono uppercase tracking-widest text-slate-400 mb-1">
          Debug Admin
        </h2>
        <p className="text-xs text-slate-500 mb-6 max-w-3xl">
          The story behind <Link href="/admin" className="text-ocean hover:underline">/admin</Link>.
          What it shows, where the data comes from, and why it focuses on{' '}
          <span className="font-bold">money + pipeline</span> instead of state-machine detail.
        </p>

        <Narrative money={money} totalBookings={totalBookings} totalRevenue={totalRevenue} />

        <Section
          icon={<Coins className="w-3.5 h-3.5" />}
          title="The money"
          sub="DashboardMetrics.tsx · 5 hero tiles"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <MoneyCard label="Total bookings" value={String(money.total_bookings)} sub="all time" />
            <MoneyCard label="Collected"      value={eur(money.collected_cents)}    sub="payments − refunds" />
            <MoneyCard label="David earned"   value={eur(money.david_earned_cents)} sub="property · host"     accent="ocean" />
            <MoneyCard label="Tano earned"    value={eur(money.tano_earned_cents)}  sub="cleaning · cleaner"  accent="amber" />
            <MoneyCard label="Outstanding"    value={eur(money.outstanding_cents)}  sub="agreed but unpaid"   accent="rose" />
          </div>
          <SubLine>
            Money split is read off the snapshot columns on each held booking:{' '}
            <Code>agreed_property_cents</Code> goes to David, <Code>agreed_cleaning_cents</Code>{' '}
            goes to Tano. Edits to <Code>properties.cleaning_fee_cents</Code> never alter past
            bookings — that&apos;s the snapshots principle.
          </SubLine>
        </Section>

        <Section
          icon={<Building2 className="w-3.5 h-3.5" />}
          title="By property"
          sub="PerPropertyMoneyStrip.tsx · David / Tano split per property"
        >
          <div className="rounded-2xl bg-white border border-slate-100 p-5">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[9px] font-mono uppercase tracking-widest text-slate-400">
                  <th className="px-2 py-2">Property</th>
                  <th className="px-2 py-2 text-right">Bookings</th>
                  <th className="px-2 py-2 text-right">David</th>
                  <th className="px-2 py-2 text-right">Tano</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2">Split</th>
                </tr>
              </thead>
              <tbody>
                {perProp.map((r) => {
                  const davidPct = r.total_cents === 0 ? 0 : Math.round((r.david_cents / r.total_cents) * 100);
                  return (
                    <tr key={r.slug} className="border-t border-slate-50">
                      <td className="px-2 py-2 font-bold text-slate-900">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: `var(--color-property-${r.slug})` }}
                          />
                          {PROPERTY_LABELS[r.slug]}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-slate-600 tabular-nums">{r.bookings}</td>
                      <td className="px-2 py-2 text-right text-slate-700 tabular-nums">{eur(r.david_cents)}</td>
                      <td className="px-2 py-2 text-right text-slate-700 tabular-nums">{eur(r.tano_cents)}</td>
                      <td className="px-2 py-2 text-right text-slate-900 tabular-nums font-bold">{eur(r.total_cents)}</td>
                      <td className="px-2 py-2 w-32">
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                          <div
                            className="h-full"
                            style={{
                              width: `${davidPct}%`,
                              backgroundColor: `var(--color-property-${r.slug})`,
                            }}
                          />
                          <div className="h-full bg-amber-300" style={{ width: `${100 - davidPct}%` }} />
                        </div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                          {davidPct}% · {100 - davidPct}%
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          icon={<ChartBar className="w-3.5 h-3.5" />}
          title="Revenue over time"
          sub="RevenueByMonthChart.tsx · stacked bar, last 12 months"
        >
          <div className="rounded-2xl bg-white border border-slate-100 p-4">
            <Row label="fed by" value={<Code>revenueByMonth({'{ months: 12 }'})</Code>} />
            <Row label="shape"  value={<Code>{'{ month, label, levante, estrecho, marea, cala }[]'}</Code>} />
            <Row label="kind"   value={<span className="text-[11px] text-slate-700">Stacked bar — one stack per property</span>} />
            <Row label="net"    value={<span className="text-[11px] font-bold text-ocean">{eur(totalRevenue)}</span>} />
            <SubLine>
              Net = <Code>SUM(booking_payments.amount_cents) − SUM(payment_refunds.amount_cents)</Code>{' '}
              grouped by month + property. <Code>generate_series</Code> guarantees a row for every
              (month × property) cell so the chart never has gaps.
            </SubLine>
          </div>
        </Section>

        <Section
          icon={<Funnel className="w-3.5 h-3.5" />}
          title="Pipeline · request → confirmed"
          sub="PipelinePanel.tsx · the one transition that matters"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FunnelCard label="Pending now"     value={funnel.pending_now}                          sub="awaiting confirmation" tone="amber" />
            <FunnelCard label="Confirmed (30d)" value={funnel.confirmed_30d}                        sub={`of ${funnel.inflow_30d} new requests`} tone="ocean" />
            <FunnelCard label="Conversion"      value={`${funnel.conversion_pct}%`}                 sub="last 30 days"          tone="emerald" />
          </div>
          {pending.length > 0 && (
            <div className="rounded-2xl bg-white border border-slate-100 p-4 mt-3">
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">
                Live pending sample (top {Math.min(pending.length, 5)})
              </h4>
              <ul className="space-y-1">
                {pending.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-[11px] text-slate-700">
                    <span className="font-mono text-[10px] text-slate-400">#{p.id}</span>
                    <span className="font-bold">{p.user_name ?? 'no user'}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">{p.property_slug}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <SubLine>
            Inline rows render <Code>BookingActionButtons</Code>, so a Confirm or Cancel is one
            click without leaving the dashboard. This is the only state-machine transition the
            dashboard cares about — the rest live on{' '}
            <Link href="/admin/bookings" className="text-ocean hover:underline">
              /admin/bookings
            </Link>
            .
          </SubLine>
        </Section>

        <Section
          icon={<Trophy className="w-3.5 h-3.5" />}
          title="Insights"
          sub="TopGuestsPanel.tsx + recent activity feed"
        >
          <div className="rounded-2xl bg-white border border-slate-100 p-5">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">
              Top guests by lifetime spend (live · top 5)
            </h4>
            {leaderboard.length === 0 ? (
              <p className="text-[12px] text-slate-400 italic">No paid bookings yet.</p>
            ) : (
              <ol className="space-y-1.5">
                {leaderboard.map((g, i) => (
                  <li key={g.id} className="flex items-center gap-3 text-[12px]">
                    <span className="w-5 h-5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="font-bold text-slate-900 truncate flex-1">{g.name}</span>
                    <span className="text-slate-400 font-mono text-[10px] tabular-nums">
                      {g.total_bookings}b
                    </span>
                    <span className="font-mono tabular-nums text-slate-900 font-bold">
                      {eur(g.lifetime_spend_cents)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Section>

        <Section
          icon={<Funnel className="w-3.5 h-3.5" />}
          title="Filterable + paginated admin tables"
          sub="src/components/admin/filters/* · URL is the source of truth"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <RouteCard
              href="/admin/bookings"
              label="/admin/bookings"
              filters={[
                { key: 'status',   note: 'multi-select chips · 6 booking statuses' },
                { key: 'property', note: 'multi-select chips · 4 properties' },
                { key: 'from / to',note: 'date range on date_check_in' },
                { key: 'q',        note: 'ILIKE on user name + email' },
                { key: 'page',     note: '25 per page' },
              ]}
              examples={[
                '?status=request,invite',
                '?status=confirmed&property=levante',
                '?q=mar&from=2026-04-01&to=2026-08-31',
              ]}
            />
            <RouteCard
              href="/admin/payments"
              label="/admin/payments"
              filters={[
                { key: 'type',         note: 'multi-select chips · 4 payment types' },
                { key: 'property',     note: 'multi-select chips' },
                { key: 'refund_only',  note: 'toggle — payments with at least one refund' },
                { key: 'from / to',    note: 'date range on paid_at' },
                { key: 'page',         note: '25 per page' },
              ]}
              examples={[
                '?type=deposit&refund_only=true',
                '?property=levante&from=2026-06-01',
              ]}
            />
            <RouteCard
              href="/admin/users"
              label="/admin/users"
              filters={[
                { key: 'q',    note: 'ILIKE on name + email' },
                { key: 'sort', note: 'recent | bookings | spend' },
                { key: 'page', note: '25 per page' },
              ]}
              examples={['?sort=spend', '?q=anna']}
            />
            <div className="rounded-2xl bg-slate-900 text-white p-5">
              <h4 className="text-[11px] font-mono uppercase tracking-widest text-white/40 mb-3">
                Pagination trick
              </h4>
              <p className="text-[12px] leading-relaxed text-white/80">
                Each list query selects{' '}
                <Code dark>COUNT(*) OVER ()::int AS _total</Code> alongside the page rows. One
                round-trip returns the slice and the unfiltered total — no second COUNT query.
              </p>
              <p className="text-[12px] leading-relaxed text-white/80 mt-3">
                Helpers return{' '}
                <Code dark>{'{ rows: T[], total: number }'}</Code> so{' '}
                <Code dark>Pagination</Code> can render &quot;Showing X–Y of Z&quot; without an
                extra fetch.
              </p>
            </div>
          </div>
        </Section>

        <Section
          icon={<ListOrdered className="w-3.5 h-3.5" />}
          title="Files"
          sub="Where the dashboard code lives"
        >
          <FilesTree />
        </Section>

        <p className="text-[10px] font-mono text-slate-400 mt-6 text-center">
          Want to see the populated state? Run <Code>bun db:fullseason</Code> · then visit{' '}
          <Link href="/admin" className="text-ocean hover:underline">
            /admin
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Narrative({
  money,
  totalBookings,
  totalRevenue,
}: {
  money: { david_earned_cents: number; tano_earned_cents: number };
  totalBookings: number;
  totalRevenue: number;
}) {
  const split = money.david_earned_cents + money.tano_earned_cents;
  const davidPct = split === 0 ? 0 : Math.round((money.david_earned_cents / split) * 100);
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      <div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.4em] text-ocean">
          <LayoutDashboard className="w-3 h-3" /> The story
        </span>
        <h3 className="text-lg font-bold text-slate-900 mt-1.5 mb-2 tracking-tight">
          A money + pipeline view, not a status dump
        </h3>
        <p className="text-[12px] leading-relaxed text-slate-600">
          The dashboard answers what a host or investor asks first:{' '}
          <span className="font-bold">how much was made, who&apos;s owed, what&apos;s waiting</span>.
          Not how many bookings are in <Code>checked_out</Code> vs <Code>cancelled</Code> —
          that&apos;s operational detail and lives on{' '}
          <Link href="/admin/bookings" className="text-ocean hover:underline">
            /admin/bookings
          </Link>{' '}
          where it&apos;s actionable.
        </p>
        <p className="text-[12px] leading-relaxed text-slate-600 mt-2">
          Every number on /admin reads off the snapshot columns on each booking{' '}
          (<Code>agreed_property_cents</Code> = David, <Code>agreed_cleaning_cents</Code> = Tano)
          plus payments minus refunds. One source of truth for money flow.
        </p>
      </div>
      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-[11px] font-mono leading-relaxed">
        <div className="text-slate-400 uppercase tracking-widest mb-2 text-[10px]">/admin sections</div>
        <ol className="space-y-1.5 text-slate-700">
          <Step n={1}>The money · 5 hero tiles</Step>
          <Step n={2}>By property · David / Tano split</Step>
          <Step n={3}>Revenue over time · 12-month chart</Step>
          <Step n={4}>Pipeline · request → confirmed funnel</Step>
          <Step n={5}>Insights · top guests + recent activity</Step>
        </ol>
        <div className="mt-4 pt-3 border-t border-slate-200 text-slate-500 text-[10px] tabular-nums">
          live · {totalBookings} bookings · {eur(totalRevenue)} 12mo · David {davidPct}% / Tano {100 - davidPct}%
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="w-4 h-4 rounded-full bg-white border border-slate-200 text-[10px] flex items-center justify-center text-slate-500 shrink-0 mt-0.5">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Section({
  icon,
  title,
  sub,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <header className="flex items-baseline gap-2 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.3em] text-slate-700">
          {icon}
          {title}
        </span>
        <span className="text-[10px] font-mono text-slate-300">·</span>
        <span className="text-[10px] font-mono text-slate-400">{sub}</span>
      </header>
      {children}
    </div>
  );
}

function MoneyCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: 'ocean' | 'amber' | 'rose';
}) {
  const accents: Record<NonNullable<typeof accent>, string> = {
    ocean: 'border-ocean/30 ring-ocean/20',
    amber: 'border-amber-200 ring-amber-100',
    rose:  'border-rose-200 ring-rose-100',
  };
  const cls = accent ? `border ${accents[accent]} ring-1` : 'border border-slate-100';
  return (
    <div className={`rounded-2xl bg-white ${cls} p-4`}>
      <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">{label}</h4>
      <div className="text-xl font-bold text-slate-900 tabular-nums">{value}</div>
      <div className="text-[10px] text-slate-400 mt-1 leading-snug">{sub}</div>
    </div>
  );
}

function FunnelCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub: string;
  tone: 'ocean' | 'amber' | 'emerald';
}) {
  const tones: Record<typeof tone, string> = {
    ocean:   'border-ocean/30',
    amber:   'border-amber-200',
    emerald: 'border-emerald-200',
  };
  return (
    <div className={`rounded-2xl bg-white border ${tones[tone]} p-4`}>
      <h4 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">{label}</h4>
      <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}

function RouteCard({
  href, label, filters, examples,
}: {
  href: string;
  label: string;
  filters: Array<{ key: string; note: string }>;
  examples: string[];
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5">
      <Link href={href} className="inline-flex items-center gap-1.5 text-[12px] font-mono font-bold text-ocean hover:underline mb-3">
        {label} <ArrowRight className="w-3 h-3" />
      </Link>
      <h5 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1.5">URL params</h5>
      <ul className="space-y-1 mb-3">
        {filters.map((f) => (
          <li key={f.key} className="flex items-baseline gap-2 text-[11px]">
            <Code>{f.key}</Code>
            <span className="text-slate-500">{f.note}</span>
          </li>
        ))}
      </ul>
      <h5 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1.5">Examples</h5>
      <ul className="space-y-0.5">
        {examples.map((e) => (
          <li key={e}>
            <Link
              href={`${href}${e}`}
              className="block text-[11px] font-mono text-slate-600 hover:text-ocean hover:bg-slate-50 px-1.5 py-0.5 rounded transition-colors"
            >
              {e}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilesTree() {
  return (
    <div className="rounded-2xl bg-slate-900 text-white p-5 font-mono text-[11px] leading-relaxed overflow-x-auto">
      <div className="text-white/40 uppercase tracking-widest text-[9px] mb-3">money + pipeline dashboard</div>
      <pre className="text-white/80 whitespace-pre">{`src/
  lib/
    dashboard.ts            ← moneyHeadline · perPropertyMoney · funnelStats
                              + revenueByMonth · pendingRequests · topGuests
    searchParams.ts         ← typed URL parsers
    bookings.ts             ← listBookings({...args}) → { rows, total }
    payments.ts             ← listPayments({...args}) → { rows, total }
    users.ts                ← listUsers({...args})    → { rows, total }
  components/
    charts/primitives.tsx                  ← shadcn-style recharts wrappers
    admin/
      DashboardMetrics.tsx                 ← 5 money tiles
      filters/
        FiltersBar.tsx · FilterChips.tsx
        SearchInput.tsx · DateRangePicker.tsx
        SortSelect.tsx · ResetButton.tsx
        Pagination.tsx
      charts/
        RevenueByMonthChart.tsx            ← stacked bar, last 12 months
      dashboard/
        PerPropertyMoneyStrip.tsx          ← David / Tano per property
        PipelinePanel.tsx                  ← request → confirmed funnel
        TopGuestsPanel.tsx                 ← top 5 by spend
  app/
    globals.css                            ← per-property + per-status CSS vars
    admin/
      page.tsx                             ← 5 sections (money-forward)
      bookings/page.tsx                    ← async searchParams + filters
      payments/page.tsx                    ← async searchParams + filters
      users/page.tsx                       ← async searchParams + sort`}</pre>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400 w-12 shrink-0">{label}</span>
      <span className="min-w-0 truncate">{value}</span>
    </div>
  );
}

function SubLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] text-slate-500 leading-relaxed mt-3 max-w-3xl">{children}</p>
  );
}

function Code({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <code className={`font-mono text-[10.5px] px-1 rounded ${dark ? 'bg-white/10 text-white/90' : 'bg-slate-100 text-slate-700'}`}>
      {children}
    </code>
  );
}
