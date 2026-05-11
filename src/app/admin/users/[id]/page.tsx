import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, User as UserIcon, Wallet } from 'lucide-react';
import AdminTable, { type AdminTableColumn } from '@/components/admin/AdminTable';
import StatusBadge from '@/components/admin/StatusBadge';
import { StatsCard, SplitBar, Split, Section } from '@/components/admin/StatsCard';
import { getUserDashboard } from '@/lib/userDashboard';
import type { BookingRow } from '@/lib/bookings';
import { fmtDate, fmtDateRange, nightsBetween } from '@/lib/dates';
import { eur } from '@/lib/format';
import { STATUS_BUCKET_COLORS as COLOR } from '@/lib/colors';

// Booking detail's PAYMENTS palette — same three colours so the user detail
// page and the booking detail page read as one family.
const CASH_COLOR   = 'var(--color-status-request)';     // amber-400
const STRIPE_COLOR = 'var(--color-status-invite)';      // violet-400
const UNPAID_COLOR = 'var(--color-status-checked_out)'; // slate-300

export const dynamic = 'force-dynamic';

// ============================================================================
// /admin/users/[id] — single user view, same rhythm as /admin and the
// booking detail page:
//
//   ┌─ Back link ─────────────────────────────────────┐
//   │ ← Users                                          │
//   ├─ BOOKINGS ──────────┬─ PAYMENTS ────────────────┤
//   │ count + 3-split bar │ lifetime + 3-split bar    │
//   │ confirmed/pend/canc │ cash / stripe / unpaid    │
//   ├─ Profile ───────────┴───────────────────────────┤
//   │ name · email · tif · nationality · dob · joined │
//   ├─ History ───────────────────────────────────────┤
//   │ AdminTable: Date · Property · Status · Payment  │
//   └──────────────────────────────────────────────────┘
//
// Aggregation lives in getUserDashboard / aggregateBookings — this file is
// pure render.
// ============================================================================

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dashboard = await getUserDashboard(id);
  if (!dashboard) notFound();

  const { user, bookings, aggregate, paymentSplit } = dashboard;
  const { confirmed, pending, cancelled } = aggregate.byBucket;
  const { paidTotal, owedTotal, agreedTotal } = aggregate.money;
  const totalCount = aggregate.total;

  // ─ Percentages for the SplitBars ─────────────────────────────────────────
  // Cancelled is the rounding remainder so the bar always sums to 100.

  const confirmedPct = totalCount === 0 ? 0 : Math.round((confirmed / totalCount) * 100);
  const pendingPct   = totalCount === 0 ? 0 : Math.round((pending   / totalCount) * 100);
  const cancelledPct = totalCount === 0 ? 0 : Math.max(0, 100 - confirmedPct - pendingPct);

  const cashPct   = agreedTotal === 0 ? 0 : Math.round((paymentSplit.cash   / agreedTotal) * 100);
  const stripePct = agreedTotal === 0 ? 0 : Math.round((paymentSplit.stripe / agreedTotal) * 100);
  const owedPct   = agreedTotal === 0 ? 0 : Math.round((owedTotal           / agreedTotal) * 100);

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-ocean mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Users
      </Link>

      {/* Top row: BOOKINGS + PAYMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <StatsCard
          title="Bookings"
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          total={String(totalCount)}
          corner={totalCount === 0 ? 'none yet' : 'lifetime'}
        >
          <SplitBar
            segments={[
              { pct: confirmedPct, color: COLOR.confirmed   },
              { pct: pendingPct,   color: COLOR.unconfirmed },
              { pct: cancelledPct, color: COLOR.cancelled   },
            ]}
          />
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Split label="Confirmed" value={String(confirmed)} pct={confirmedPct} dot={COLOR.confirmed}   />
            <Split label="Pending"   value={String(pending)}   pct={pendingPct}   dot={COLOR.unconfirmed} />
            <Split label="Cancelled" value={String(cancelled)} pct={cancelledPct} dot={COLOR.cancelled}   />
          </div>
        </StatsCard>

        <StatsCard
          title="Payments"
          icon={<Wallet className="w-3.5 h-3.5" />}
          total={eur(paidTotal)}
          corner={owedTotal > 0 ? `${eur(owedTotal)} owed` : 'fully settled'}
        >
          <SplitBar
            segments={[
              { pct: cashPct,   color: CASH_COLOR   },
              { pct: stripePct, color: STRIPE_COLOR },
              { pct: owedPct,   color: UNPAID_COLOR },
            ]}
          />
          {/* Hide-when-zero: a "0 €" tile is just noise. Mirrors the booking
              detail page's PAYMENTS card. */}
          <div
            className="grid gap-2 mt-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}
          >
            {paymentSplit.cash   > 0 && <Split label="Cash"   value={eur(paymentSplit.cash)}   pct={cashPct}   dot={CASH_COLOR}   />}
            {paymentSplit.stripe > 0 && <Split label="Stripe" value={eur(paymentSplit.stripe)} pct={stripePct} dot={STRIPE_COLOR} />}
            {owedTotal           > 0 && <Split label="Unpaid" value={eur(owedTotal)}           pct={owedPct}   dot={UNPAID_COLOR} />}
          </div>
        </StatsCard>
      </div>

      {/* Profile */}
      <div className="mb-3">
        <StatsCard
          title="Profile"
          icon={<UserIcon className="w-3.5 h-3.5" />}
          total={user.name}
          corner={`Joined ${fmtDate(user.created_at)}`}
        >
          <a
            href={`mailto:${user.email}`}
            className="block text-xs font-mono text-slate-500 hover:text-ocean truncate"
          >
            {user.email}
          </a>
          <p className="text-xs text-slate-500 tabular-nums mt-2">
            <span className="text-slate-400 font-mono uppercase tracking-widest mr-1.5">TIF</span>
            {user.tif ?? <span className="text-slate-300 italic">none</span>}
            <span className="text-slate-300 mx-2">·</span>
            <span className="text-slate-400 font-mono uppercase tracking-widest mr-1.5">Nationality</span>
            {user.nationality ?? <span className="text-slate-300 italic">none</span>}
            <span className="text-slate-300 mx-2">·</span>
            <span className="text-slate-400 font-mono uppercase tracking-widest mr-1.5">DOB</span>
            {user.dob ? fmtDate(user.dob) : <span className="text-slate-300 italic">none</span>}
          </p>
        </StatsCard>
      </div>

      {/* History */}
      <Section
        eyebrow="History"
        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
        hint={`${totalCount} ${totalCount === 1 ? 'booking' : 'bookings'}`}
      >
        <AdminTable
          columns={USER_BOOKING_COLUMNS}
          rows={bookings}
          rowKey={(b) => b.id}
          rowHref={(b) => `/admin/bookings/${b.id}`}
          emptyMessage="No bookings yet."
        />
      </Section>
    </div>
  );
}

// ─── Booking columns — Guest column is dropped (it's all this user). ──────

const USER_BOOKING_COLUMNS: AdminTableColumn<BookingRow>[] = [
  {
    key: 'date',
    header: 'Date',
    width: 'minmax(0,1.4fr)',
    render: (b) => {
      const nights = nightsBetween(b.date_check_in, b.date_check_out);
      return (
        <div className="min-w-0 tabular-nums">
          <span className="text-sm text-slate-900">
            {fmtDateRange(b.date_check_in, b.date_check_out)}
          </span>
          <span className="text-xs text-slate-400 font-mono ml-1.5">· {nights}n</span>
        </div>
      );
    },
  },
  {
    key: 'property',
    header: 'Property',
    width: 'minmax(0,0.7fr)',
    render: (b) => (
      <div className="text-xs font-mono uppercase tracking-widest text-slate-700">
        {b.property_slug}
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: 'minmax(0,0.9fr)',
    render: (b) => <StatusBadge status={b.status} />,
  },
  {
    key: 'payment',
    header: 'Payment',
    align: 'right',
    width: 'minmax(0,1.2fr)',
    render: (b) => {
      const fullyPaid = b.paid_cents >= b.agreed_total_cents;
      const paidTone = fullyPaid
        ? 'text-emerald-700'
        : b.paid_cents === 0 ? 'text-slate-300' : 'text-amber-700';
      return (
        <span className="text-sm tabular-nums font-mono">
          <span className={paidTone}>{eur(b.paid_cents)}</span>
          <span className="text-slate-300"> / </span>
          <span className="text-slate-600">{eur(b.agreed_total_cents)}</span>
        </span>
      );
    },
  },
];
