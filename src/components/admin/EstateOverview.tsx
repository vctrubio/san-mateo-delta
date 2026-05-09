import { CheckCircle2, Wallet } from 'lucide-react';
import type { EstateOverview as EstateOverviewData } from '@/lib/dashboard';
import { STATUS_BUCKET_COLORS as COLOR } from '@/lib/colors';

// ============================================================================
// EstateOverview — estate-wide upcoming-only summary at the top of
// /admin/calendar. Mirrors the calendar's forward-looking lens: every figure
// is across bookings whose stay hasn't ended yet (date_check_out > today).
//
// Bookings card — 3-segment split: confirmed (status >= confirmed) /
// unconfirmed (request, invite) / cancelled. Cancelled IS counted here.
// Payments card — 3-segment bar: paid + unpaid + cleaning. Scope is
// HELD bookings only (status IN confirmed/checked_in/checked_out);
// request/invite don't represent real revenue commitments and are
// excluded from every money figure. Cleaning is a slice of total revenue
// (going to the cleaner) and overlaps with paid + unpaid, so
// paid+unpaid+cleaning can exceed 100% — the SplitBar uses flex-grow
// weighting so all three segments render proportionally.
//
// Colours come from the status palette in src/app/globals.css — confirmed =
// ocean, request = amber-400, cancelled = rose-400. The same three roles
// are reused on the Payments card: paid = ocean (positive), unpaid = amber
// (action-needed), cleaning = rose (cleaner's slice).
// ============================================================================

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(cents / 100);
}

export type EstateOverviewProps = {
  data: EstateOverviewData;
};

export default function EstateOverview({ data }: EstateOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <BookingsCard data={data} />
      <PaymentsCard data={data} />
    </div>
  );
}

// ----------------------------------------------------------------------------

function BookingsCard({ data }: { data: EstateOverviewData }) {
  const total = data.total_bookings;
  const confirmedPct = pct(data.confirmed_count, total);
  const unconfirmedPct = pct(data.unconfirmed_count, total);
  // Cancelled gets the remainder so the bar always sums to 100 even with rounding.
  const cancelledPct = total === 0 ? 0 : 100 - confirmedPct - unconfirmedPct;

  return (
    <Shell title="Bookings" total={String(total)} icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
      <SplitBar
        segments={[
          { pct: confirmedPct, color: COLOR.confirmed },
          { pct: unconfirmedPct, color: COLOR.unconfirmed },
          { pct: cancelledPct, color: COLOR.cancelled },
        ]}
      />
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Split label="Confirmed" value={String(data.confirmed_count)} pct={confirmedPct} dot={COLOR.confirmed} />
        <Split label="Unconfirmed" value={String(data.unconfirmed_count)} pct={unconfirmedPct} dot={COLOR.unconfirmed} />
        <Split label="Cancelled" value={String(data.cancelled_count)} pct={cancelledPct} dot={COLOR.cancelled} />
      </div>
    </Shell>
  );
}

function PaymentsCard({ data }: { data: EstateOverviewData }) {
  const paidPct = pct(data.paid_cents, data.total_cents);
  const unpaidPct = data.total_cents === 0 ? 0 : 100 - paidPct;
  // Cleaning overlaps with paid + unpaid (it's a slice of total that may be
  // partly paid, partly owed). The bar uses flex-grow weighting so the three
  // segments still render proportionally even though paid+unpaid+cleaning
  // exceeds 100%. Each segment's visual width = pct / sum_of_pcts.
  const cleaningPct = pct(data.cleaning_cents, data.total_cents);

  return (
    <Shell title="Payments" total={eur(data.total_cents)} icon={<Wallet className="w-3.5 h-3.5" />}>
      <SplitBar
        segments={[
          { pct: paidPct, color: COLOR.confirmed },
          { pct: unpaidPct, color: COLOR.unconfirmed },
          { pct: cleaningPct, color: COLOR.cancelled },
        ]}
      />
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Split label="Paid" value={eur(data.paid_cents)} pct={paidPct} dot={COLOR.confirmed} />
        <Split label="Unpaid" value={eur(data.unpaid_cents)} pct={unpaidPct} dot={COLOR.unconfirmed} />
        <Split label="Cleaning" value={eur(data.cleaning_cents)} pct={cleaningPct} dot={COLOR.cancelled} />
      </div>
    </Shell>
  );
}

// ----------------------------------------------------------------------------

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

function Shell({
  title, total, icon, children,
}: {
  title: string;
  total: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400">
          {icon} {title}
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-300">upcoming</span>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums leading-none mb-3">{total}</p>
      {children}
    </div>
  );
}

function SplitBar({ segments }: { segments: Array<{ pct: number; color: string }> }) {
  // flex-grow weighting (rather than literal width %) lets the bar stay full
  // even when segments overlap (e.g. payments paid+unpaid+cleaning > 100).
  // Each segment's rendered width = pct / sum(pct) of the bar's width.
  return (
    <div className="h-2 w-full rounded-full overflow-hidden bg-slate-100 flex">
      {segments.map((s, i) => (
        <div
          key={i}
          className="h-full transition-all"
          style={{ flexGrow: s.pct, backgroundColor: s.color }}
        />
      ))}
    </div>
  );
}

function Split({
  label, value, pct, dot,
}: {
  label: string;
  value: string;
  pct: number;
  dot: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
          {label} · {pct}%
        </span>
      </div>
      <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
