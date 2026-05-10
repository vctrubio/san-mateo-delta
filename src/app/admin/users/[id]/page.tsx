import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, User as UserIcon, Wallet } from 'lucide-react';
import AdminTable, { type AdminTableColumn } from '@/components/admin/AdminTable';
import StatusBadge from '@/components/admin/StatusBadge';
import { StatsCard, SplitBar, Split } from '@/components/admin/StatsCard';
import { getUserById } from '@/lib/users';
import { listBookingsForUser, type BookingRow } from '@/lib/bookings';
import { paymentSplitForUser } from '@/lib/payments';
import { fmtDate, fmtDateRange, nightsBetween } from '@/lib/dates';
import { eur } from '@/lib/format';
import { BLOCKING_BOOKING_STATUSES, STATUS_BUCKET_COLORS as COLOR } from '@/lib/colors';

// Same palette the booking detail page uses for the PAYMENTS card so the two
// surfaces read identically. Cash + Stripe match the existing chip colours.
const CASH_COLOR   = 'var(--color-status-request)';     // amber-400
const STRIPE_COLOR = 'var(--color-status-invite)';      // violet-400
const UNPAID_COLOR = 'var(--color-status-checked_out)'; // slate-300

export const dynamic = 'force-dynamic';

// ============================================================================
// /admin/users/[id] — single user view. Same visual rhythm as the booking
// detail page so the two surfaces feel like one family:
//
//   ┌─ Back link ─────────────────────────────────────┐
//   │ ← Users                                          │
//   ├─ BOOKINGS ──────────┬─ PAYMENTS ────────────────┤
//   │ count + 3-split bar │ lifetime + 3-split bar    │
//   │ confirmed/pend/canc │ paid / owed / cleaning    │
//   ├─ Profile ───────────┴───────────────────────────┤
//   │ name · email · tif · nationality · dob · joined │
//   ├─ History ───────────────────────────────────────┤
//   │ AdminTable: Date · Property · Status · Payment  │
//   └──────────────────────────────────────────────────┘
// ============================================================================

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();
  const [bookings, split] = await Promise.all([
    listBookingsForUser(id),
    paymentSplitForUser(id),
  ]);

  // ─ Booking aggregates ────────────────────────────────────────────────────
  // Confirmed = anything held (confirmed/checked_in/checked_out). Pending =
  // request / invite. Cancelled = its own bucket. Same split EstateOverview
  // uses on the global dashboard, so the visual reads identically.
  let confirmed = 0;
  let pending = 0;
  let cancelled = 0;
  for (const b of bookings) {
    if (b.status === 'cancelled') cancelled++;
    else if (BLOCKING_BOOKING_STATUSES.includes(b.status)) confirmed++;
    else pending++;
  }
  const totalCount = bookings.length;

  // ─ Payment aggregates ────────────────────────────────────────────────────
  // Cash + Stripe split comes from `paymentSplitForUser` (succeeded only,
  // grouped by method). Owed is computed from the booking rows since it's
  // a function of agreed_total - paid, scoped to non-cancelled bookings.
  let agreedTotal = 0;
  let owedTotal = 0;
  for (const b of bookings) {
    agreedTotal += b.agreed_total_cents;
    if (b.status !== 'cancelled') {
      owedTotal += Math.max(0, b.agreed_total_cents - b.paid_cents);
    }
  }
  const paidTotal = split.cash + split.stripe;
  const cashPct   = agreedTotal === 0 ? 0 : Math.round((split.cash   / agreedTotal) * 100);
  const stripePct = agreedTotal === 0 ? 0 : Math.round((split.stripe / agreedTotal) * 100);
  const owedPct   = agreedTotal === 0 ? 0 : Math.round((owedTotal    / agreedTotal) * 100);

  const confirmedPct = totalCount === 0 ? 0 : Math.round((confirmed / totalCount) * 100);
  const pendingPct   = totalCount === 0 ? 0 : Math.round((pending   / totalCount) * 100);
  // Floor cancelled to the remainder so the bar always sums to 100 even
  // after rounding.
  const cancelledPct = totalCount === 0 ? 0 : Math.max(0, 100 - confirmedPct - pendingPct);

  return (
    <div className="max-w-5xl mx-auto pb-16">
      {/* Back to users */}
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-ocean mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Users
      </Link>

      {/* Top row: BOOKINGS + PAYMENTS — same shells as /admin and the
          booking detail page. */}
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
          {/* Same hide-when-zero rule as the booking detail page: a "0 €"
              tile is just noise. Cash + Stripe collapse when there's no
              activity for that method; Unpaid collapses when fully paid. */}
          <div
            className="grid gap-2 mt-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}
          >
            {split.cash   > 0 && <Split label="Cash"   value={eur(split.cash)}   pct={cashPct}   dot={CASH_COLOR}   />}
            {split.stripe > 0 && <Split label="Stripe" value={eur(split.stripe)} pct={stripePct} dot={STRIPE_COLOR} />}
            {owedTotal    > 0 && <Split label="Unpaid" value={eur(owedTotal)}    pct={owedPct}   dot={UNPAID_COLOR} />}
          </div>
        </StatsCard>
      </div>

      {/* Profile card — full width. Big total carries the user's name,
          corner shows when they joined; body lays out the rest of the
          schema fields (email link + tif/nationality/dob). */}
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

      {/* History — full width AdminTable. Click a row to drill into the
          booking detail. No Guest column since it's all this user. */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> History
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-300">
            {totalCount} {totalCount === 1 ? 'booking' : 'bookings'}
          </span>
        </div>
        <AdminTable
          columns={USER_BOOKING_COLUMNS}
          rows={bookings}
          rowKey={(b) => b.id}
          rowHref={(b) => `/admin/bookings/${b.id}`}
          emptyMessage="No bookings yet."
        />
      </section>
    </div>
  );
}

// ─── Booking columns — drop the Guest column (it's all this user) but
// keep Date / Property / Status / Payment so the table reads the same as
// the bookings list. ─────────────────────────────────────────────────────

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
