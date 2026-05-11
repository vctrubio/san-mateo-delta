import { CheckCircle2, Wallet } from 'lucide-react';
import { StatsCard, SplitBar, Split } from '@/components/admin/StatsCard';
import type { EstateOverview as EstateOverviewData } from '@/lib/dashboard';
import { STATUS_BUCKET_COLORS as COLOR } from '@/lib/colors';
import { eur } from '@/lib/format';

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
    <StatsCard
      title="Bookings"
      total={String(total)}
      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
      corner="upcoming"
    >
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
    </StatsCard>
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
    <StatsCard
      title="Payments"
      total={eur(data.total_cents)}
      icon={<Wallet className="w-3.5 h-3.5" />}
      corner="upcoming"
    >
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
    </StatsCard>
  );
}

// ----------------------------------------------------------------------------

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

