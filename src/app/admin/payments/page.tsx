import Link from 'next/link';
import {
  Wallet,
  CreditCard,
  AlertTriangle,
  CalendarClock,
  Receipt,
  Loader2,
  Banknote,
  ArrowUpRight,
} from 'lucide-react';
import PaymentPolicyCard from '@/components/admin/PaymentPolicyCard';
import { getActivePaymentPolicy } from '@/lib/systemSettings';
import {
  getPaymentsHqData,
  type OutstandingRow,
  type OutstandingUrgency,
  type UpcomingBalanceRow,
  type RecentPaymentRow,
  type StalePendingRow,
} from '@/lib/adminPayments';
import { PAYMENT_POLICY_KEYS, PAYMENT_PRESETS, describePolicy } from '@/lib/payment';
import { eur } from '@/lib/format';
import { fmtDate, fmtDateRange } from '@/lib/dates';

export const dynamic = 'force-dynamic';

// ============================================================================
// /admin/payments — the estate "payments HQ".
//
// Replaces the old /admin/payments page. Five composable sections, derived
// state only (no payments table, no read-tracking — same model as
// `docs/admin-notifications.md`):
//
//   1. Policy switcher        — flip the estate-wide active preset
//   2. Outstanding             — bookings with paid < agreed_total
//   3. Upcoming balance due    — split policies whose balance window opens soon
//   4. Recent payments         — last 30d, last 20 succeeded rows
//   5. Stale pending sessions  — Stripe sessions stuck in pending > 1h
//
// Every booking row is a deep-link to `/admin/bookings/[id]` — admin lands
// here, scans for what needs action, clicks through. Pure read surface.
// ============================================================================

export default async function AdminPaymentsPage() {
  const [active, data] = await Promise.all([
    getActivePaymentPolicy(),
    getPaymentsHqData(),
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-6">
      <Header updatedAt={active.updated_at} />
      <PolicySection activeKey={active.key} />
      <OutstandingSection rows={data.outstanding} />
      <UpcomingBalanceSection rows={data.upcomingBalance} />
      <RecentPaymentsSection rows={data.recent} />
      <StalePendingSection rows={data.stalePending} />
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

function Header({ updatedAt }: { updatedAt: string | null }) {
  return (
    <div>
      <span className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.4em] text-ocean">
        <Wallet className="w-3 h-3" />
        Payments
      </span>
      <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tighter mt-2">
        Payments HQ
      </h1>
      <p className="text-slate-500 mt-2 max-w-2xl leading-relaxed">
        Flip the estate-wide policy on the fly, scan what's owed, see what's
        coming due, and watch payments land in real time. Every booking row
        links to its admin detail page.
      </p>
      {updatedAt && (
        <p className="text-[11px] font-mono text-slate-400 mt-2">
          Policy last changed {fmtDate(updatedAt)}
        </p>
      )}
    </div>
  );
}

// ─── Section shell — reused by all five blocks ──────────────────────────────

function Section({
  icon: Icon,
  eyebrow,
  count,
  title,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  count?: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400 inline-flex items-center gap-1.5">
            <Icon className="w-3 h-3" />
            {eyebrow}
            {count != null && (
              <span className="text-slate-300 ml-1">· {count}</span>
            )}
          </p>
          <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight mt-0.5">
            {title}
          </h2>
        </div>
        {hint && (
          <span className="text-[11px] font-mono text-slate-400">{hint}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-400 text-center">
      {children}
    </div>
  );
}

// ─── 1. Policy switcher ─────────────────────────────────────────────────────

function PolicySection({ activeKey }: { activeKey: string }) {
  return (
    <Section icon={CreditCard} eyebrow="Policy · estate-wide" title="Active payment terms">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PAYMENT_POLICY_KEYS.map((k) => {
          const preset = PAYMENT_PRESETS[k];
          return (
            <PaymentPolicyCard
              key={k}
              presetKey={k}
              label={preset.label}
              description={preset.description}
              active={activeKey === k}
            />
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed mt-3">
        Switching here applies to new bookings only. Past bookings carry their
        own snapshot — see <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">docs/payment.md</code>.
      </p>
    </Section>
  );
}

// ─── 2. Outstanding ─────────────────────────────────────────────────────────

const URGENCY_TONE: Record<OutstandingUrgency, { bg: string; ring: string; text: string; label: string }> = {
  checked_in_unpaid:  { bg: 'bg-rose-50',   ring: 'ring-rose-200',   text: 'text-rose-800',   label: 'Checked in · unpaid' },
  overdue_checkin:    { bg: 'bg-rose-50',   ring: 'ring-rose-200',   text: 'text-rose-800',   label: 'Check-in overdue' },
  check_in_today:     { bg: 'bg-amber-50',  ring: 'ring-amber-200',  text: 'text-amber-800',  label: 'Check-in today' },
  request_awaiting:   { bg: 'bg-amber-50',  ring: 'ring-amber-200',  text: 'text-amber-800',  label: 'Request awaiting' },
  upcoming:           { bg: 'bg-slate-50',  ring: 'ring-slate-200',  text: 'text-slate-700',  label: 'Upcoming' },
};

function OutstandingSection({ rows }: { rows: OutstandingRow[] }) {
  const totalOwed = rows.reduce((s, r) => s + r.owed_cents, 0);
  return (
    <Section
      icon={AlertTriangle}
      eyebrow="Outstanding"
      count={rows.length}
      title="Money still owed"
      hint={rows.length > 0 ? `${eur(totalOwed)} total` : undefined}
    >
      {rows.length === 0 ? (
        <EmptyHint>Nothing owed — every active booking is settled.</EmptyHint>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const tone = URGENCY_TONE[r.urgency];
            return (
              <li key={r.booking_id}>
                <Link
                  href={`/admin/bookings/${r.booking_id}`}
                  className={`group flex items-center gap-3 rounded-xl ${tone.bg} ring-1 ${tone.ring} px-4 py-3 hover:brightness-95 transition`}
                >
                  <span className={`text-[10px] font-mono uppercase tracking-widest shrink-0 ${tone.text}`}>
                    {tone.label}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 truncate flex-1 min-w-0">
                    {r.property_slug.toUpperCase()} · {r.user_name ?? 'no guest'}
                  </span>
                  <span className="text-[12px] text-slate-500 tabular-nums shrink-0 hidden sm:inline">
                    {fmtDateRange(r.date_check_in, r.date_check_out)}
                  </span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">
                    {eur(r.owed_cents)}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

// ─── 3. Upcoming balance due ────────────────────────────────────────────────

function UpcomingBalanceSection({ rows }: { rows: UpcomingBalanceRow[] }) {
  return (
    <Section
      icon={CalendarClock}
      eyebrow="Upcoming balance"
      count={rows.length}
      title="Balances opening soon"
      hint="next 30 days · split policies only"
    >
      {rows.length === 0 ? (
        <EmptyHint>No split-policy balances coming due in the next 30 days.</EmptyHint>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const overdue = r.days_until_due < 0;
            const todayBucket = r.days_until_due === 0;
            const dueCopy =
              overdue ? `due ${Math.abs(r.days_until_due)}d ago`
              : todayBucket ? 'due today'
              : `due in ${r.days_until_due}d`;
            return (
              <li key={r.booking_id}>
                <Link
                  href={`/admin/bookings/${r.booking_id}`}
                  className={[
                    'group flex items-center gap-3 rounded-xl px-4 py-3 ring-1 hover:brightness-95 transition',
                    overdue ? 'bg-rose-50 ring-rose-200' : todayBucket ? 'bg-amber-50 ring-amber-200' : 'bg-white ring-slate-200',
                  ].join(' ')}
                >
                  <span className={['text-[10px] font-mono uppercase tracking-widest shrink-0', overdue ? 'text-rose-700' : todayBucket ? 'text-amber-700' : 'text-slate-500'].join(' ')}>
                    {dueCopy}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 truncate flex-1 min-w-0">
                    {r.property_slug.toUpperCase()} · {r.user_name ?? 'no guest'}
                  </span>
                  <span className="text-[12px] text-slate-500 tabular-nums shrink-0 hidden sm:inline">
                    check-in {fmtDate(r.date_check_in)} · {describePolicy(r.payment_policy)}
                  </span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">
                    {eur(r.owed_cents)}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

// ─── 4. Recent payments ─────────────────────────────────────────────────────

const METHOD_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  stripe: CreditCard,
  cash:   Banknote,
};

function RecentPaymentsSection({ rows }: { rows: RecentPaymentRow[] }) {
  const total = rows.reduce((s, r) => s + r.amount_cents, 0);
  return (
    <Section
      icon={Receipt}
      eyebrow="Recent payments"
      count={rows.length}
      title="Money in the door"
      hint={rows.length > 0 ? `${eur(total)} collected` : 'last 30 days'}
    >
      {rows.length === 0 ? (
        <EmptyHint>No payments recorded in the last 30 days.</EmptyHint>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-[10px] font-mono uppercase tracking-widest text-slate-400">
              <tr>
                <th className="text-left px-4 py-2 font-medium">When</th>
                <th className="text-left px-4 py-2 font-medium">Booking</th>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-right px-4 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const Icon = METHOD_ICON[r.method] ?? CreditCard;
                return (
                  <tr key={r.payment_id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-2 text-slate-600 tabular-nums whitespace-nowrap">
                      {fmtDate(r.paid_at)}
                    </td>
                    <td className="px-4 py-2 truncate">
                      <Link
                        href={`/admin/bookings/${r.booking_id}`}
                        className="font-semibold text-slate-900 hover:text-ocean"
                      >
                        {r.property_slug.toUpperCase()}
                      </Link>
                      <span className="text-slate-500"> · {r.user_name ?? 'no guest'}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                        {r.type} · {r.method}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-emerald-700 tabular-nums">
                      +{eur(r.amount_cents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ─── 5. Stale pending Stripe sessions ───────────────────────────────────────

function StalePendingSection({ rows }: { rows: StalePendingRow[] }) {
  return (
    <Section
      icon={Loader2}
      eyebrow="Stale Stripe sessions"
      count={rows.length}
      title="Pending sessions to investigate"
      hint="older than 1 hour"
    >
      {rows.length === 0 ? (
        <EmptyHint>No stale pending sessions — webhooks are flowing.</EmptyHint>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const ageDisplay = r.age_minutes < 60
              ? `${r.age_minutes}m`
              : r.age_minutes < 1440
                ? `${Math.round(r.age_minutes / 60)}h`
                : `${Math.round(r.age_minutes / 1440)}d`;
            return (
              <li key={r.payment_id}>
                <Link
                  href={`/admin/bookings/${r.booking_id}`}
                  className="group flex items-center gap-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3 hover:brightness-95 transition"
                >
                  <span className="text-[10px] font-mono uppercase tracking-widest text-amber-700 shrink-0">
                    Pending · {ageDisplay}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 truncate flex-1 min-w-0">
                    {r.property_slug.toUpperCase()} · {r.user_name ?? r.user_email ?? 'no guest'}
                  </span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums shrink-0">
                    {eur(r.amount_cents)}
                  </span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-700 group-hover:text-amber-900 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
