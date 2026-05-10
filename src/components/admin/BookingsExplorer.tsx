'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import AdminSection from '@/components/admin/AdminSection';
import AdminTable, { type AdminTableColumn } from '@/components/admin/AdminTable';
import StatusBadge from '@/components/admin/StatusBadge';
import BookingActionModal from '@/components/shared/BookingActionModal';
import { fmtDateRange, nightsBetween } from '@/lib/dates';
import {
  PROPERTY_LABELS,
  PROPERTY_SLUGS,
  STATUS_BUCKET_COLORS as COLOR,
  type PropertySlug,
} from '@/lib/colors';
import type { BookingRow } from '@/lib/bookings';
import { bookingRowToCalendarBooking } from '@/lib/bookingAdapters';
import { eur } from '@/lib/format';

// ============================================================================
// BookingsExplorer — the /admin/bookings shell. Server fetches every booking
// once and hands the array to this client component, which owns all filter
// state and renders the page in four blocks:
//
//   ┌─ Properties + Status (2 cards, side-by-side on desktop) ─┐
//   │ each cell is a toggleable filter; click again to clear    │
//   ├──────────────────────────────────────────────────────────┤
//   ┌─ Spotlight ──────────────────────────────────────────────┐
//   │ search + dual-handle date slider + live aggregates       │
//   ├──────────────────────────────────────────────────────────┤
//   ┌─ Upcoming · N bookings · €X to be made ──────────────────┐
//   │ AdminTable (filtered)                                     │
//   ├──────────────────────────────────────────────────────────┤
//   ┌─ History · N bookings · €X agreed ───────────────────────┐
//   │ AdminTable (filtered, most recent first)                  │
//   └──────────────────────────────────────────────────────────┘
//
// Filters are AND-ed: property × status bucket × search × date-range. All
// four sections re-derive from the same `filtered` set so the cards always
// reflect what's actually in the table.
// ============================================================================

type StatusBucket = 'pending' | 'unpaid' | 'completed' | 'cancelled';

function bucketOf(b: BookingRow): StatusBucket {
  if (b.status === 'cancelled') return 'cancelled';
  if (b.status === 'request' || b.status === 'invite') return 'pending';
  // confirmed / checked_in / checked_out: split by paid-in-full.
  return b.paid_cents >= b.agreed_total_cents ? 'completed' : 'unpaid';
}

function ymdToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isUpcoming(b: BookingRow, today: string): boolean {
  if (b.status === 'cancelled' || b.status === 'checked_out') return false;
  return b.date_check_out >= today;
}

function partyLabel(g: BookingRow['guests']): string {
  const parts: string[] = [`${g.adults}A`];
  if (g.children) parts.push(`${g.children}C`);
  if (g.infants)  parts.push(`${g.infants}I`);
  if (g.pets)     parts.push(`${g.pets}🐾`);
  return parts.join(' · ');
}

// ─── Spotlight math-table row shape ────────────────────────────────────────
//
// One row = one slice (a property or a status bucket, plus the grand total).
// Lives at module scope so SpotlightPanel and MathTable can both name it
// without prop-type contortions.

type MathRow = {
  key: string;
  label: string;
  upcoming: number;
  count: number;
  /** Status-segment counts — used to paint the segmented bar. `invite` is
   *  kept distinct from `request` (instead of bucketing both as
   *  "unconfirmed") so the friend-and-family flow shows up as its own
   *  violet segment on the bar. Both still count as Upcoming via
   *  `isUpcoming` (cancelled and checked_out are the only exclusions). */
  confirmed: number;
  request: number;
  invite: number;
  cancelled: number;
  agreed: number;
  paid: number;
  owed: number;
  cleaning: number;
};

function emptyMathRow(key: string, label: string): MathRow {
  return {
    key, label,
    upcoming: 0, count: 0,
    confirmed: 0, request: 0, invite: 0, cancelled: 0,
    agreed: 0, paid: 0, owed: 0, cleaning: 0,
  };
}

function accumulateMath(row: MathRow, b: BookingRow, today: string) {
  row.count++;
  row.agreed   += b.agreed_total_cents;
  row.paid     += b.paid_cents;
  row.cleaning += b.agreed_cleaning_cents;
  // "Owed" only for non-cancelled — once a refund settles, the cancelled
  // remainder is meaningless.
  if (b.status !== 'cancelled') {
    row.owed += Math.max(0, b.agreed_total_cents - b.paid_cents);
  }
  if (isUpcoming(b, today)) row.upcoming++;
  // Status-segment counts for the bar.
  if      (b.status === 'cancelled') row.cancelled++;
  else if (b.status === 'invite')    row.invite++;
  else if (b.status === 'request')   row.request++;
  else                                row.confirmed++;
}

// ─── Tab pill sub-row shape ─────────────────────────────────────────────────

type SubRow = {
  label: string;
  /** Bucket key — clicking the sub-row toggles `bucketFilter` to this. */
  bucket: StatusBucket;
  count: number;
  total: number;
  /** Suffix word printed after the muted euro figure ("agreed", "owed", …). */
  suffix: string;
};

function computeBucketSubRows(rows: BookingRow[]): SubRow[] {
  let pendingCount = 0,   pendingAgreed = 0;
  let unpaidCount = 0,    unpaidOwed = 0;
  let completedCount = 0, completedPaid = 0;
  for (const b of rows) {
    const bk = bucketOf(b);
    if (bk === 'pending') {
      pendingCount++;
      pendingAgreed += b.agreed_total_cents;
    } else if (bk === 'unpaid') {
      unpaidCount++;
      unpaidOwed += Math.max(0, b.agreed_total_cents - b.paid_cents);
    } else if (bk === 'completed') {
      completedCount++;
      completedPaid += b.paid_cents;
    }
  }
  const out: SubRow[] = [];
  if (pendingCount > 0)   out.push({ label: 'Pending',   bucket: 'pending',   count: pendingCount,   total: pendingAgreed, suffix: 'agreed'    });
  if (unpaidCount > 0)    out.push({ label: 'Unpaid',    bucket: 'unpaid',    count: unpaidCount,    total: unpaidOwed,    suffix: 'owed'      });
  if (completedCount > 0) out.push({ label: 'Completed', bucket: 'completed', count: completedCount, total: completedPaid, suffix: 'collected' });
  return out;
}

function fmtSliderDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function ymdAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function ymdDiffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();
  return Math.round((db - da) / 86_400_000);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function BookingsExplorer({ bookings }: { bookings: BookingRow[] }) {
  // Filter state. `null` = no filter on that axis.
  const [propertyFilter, setPropertyFilter] = useState<PropertySlug | null>(null);
  const [bucketFilter, setBucketFilter] = useState<StatusBucket | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history' | 'cancelled'>('upcoming');
  const [activeBooking, setActiveBooking] = useState<BookingRow | null>(null);

  // Date-range slider bounds. Computed from the dataset so the slider spans
  // exactly the data we have. Falls back to today + 1 year if there are no
  // bookings yet.
  const { minDate, maxDate } = useMemo(() => {
    if (bookings.length === 0) {
      const today = ymdToday();
      return { minDate: today, maxDate: ymdAddDays(today, 365) };
    }
    const sorted = [...bookings].map((b) => b.date_check_in).sort();
    return { minDate: sorted[0], maxDate: sorted[sorted.length - 1] };
  }, [bookings]);

  const totalDays = ymdDiffDays(minDate, maxDate);

  const [fromDays, setFromDays] = useState(0);
  const [toDays, setToDays] = useState(totalDays);

  const fromYmd = ymdAddDays(minDate, fromDays);
  const toYmd = ymdAddDays(minDate, toDays);

  // Filter pipeline — broken into stages so the math table can stay a
  // stable broad overview while the bookings table reflects the full filter
  // stack. Math-table rows derive from `spotlightFiltered` (search + date
  // only) so clicking LEVANTE doesn't collapse the property axis to one
  // row; the active row just lights up. The bookings table consumes the
  // fully-filtered set.
  //
  //   bookings ─[search + date range]─▶ spotlightFiltered
  //   spotlightFiltered ─▶ propertyMathRows / statusMathRows / grandTotal
  //   spotlightFiltered ─[property, bucket]─▶ filtered  (bookings table)
  const spotlightFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (b.date_check_in < fromYmd || b.date_check_in > toYmd) return false;
      // Search only matches guest name — property/status are filter axes on
      // the math-table rows, and email/id aren't useful enough as a haystack.
      if (q) {
        const name = (b.user_name ?? '').toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [bookings, search, fromYmd, toYmd]);

  const filtered = useMemo(() => {
    return spotlightFiltered.filter((b) => {
      if (propertyFilter && b.property_slug !== propertyFilter) return false;
      if (bucketFilter && bucketOf(b) !== bucketFilter) return false;
      return true;
    });
  }, [spotlightFiltered, propertyFilter, bucketFilter]);

  // ─── Math-table rows for the Spotlight panel ──────────────────────────────
  //
  // One axis = property, other axis = status bucket. Both axes are computed
  // from `spotlightFiltered` (search + date window applied; property/bucket
  // card filters NOT applied), so the table stays a stable broad overview —
  // clicking LEVANTE doesn't collapse the property axis into one row. The
  // active row(s) just light up. The grand total at the bottom is the same
  // dataset summed once, and it's mathematically equal whether you sum the
  // property column or the status column (which is the whole point of the
  // math-table layout).
  //
  // Columns per row:
  //   upcoming  — count of bookings where date_check_out >= today and
  //               status is not cancelled / checked_out
  //   count     — total bookings in this slice
  //   agreed    — Σ agreed_total_cents
  //   paid      — Σ paid_cents
  //   owed      — Σ max(0, agreed - paid) for non-cancelled only (cancelled
  //               bookings' "remaining" is meaningless once refunds settle)
  //   cleaning  — Σ agreed_cleaning_cents (cleaner's slice of agreed)

  const propertyMathRows = useMemo<MathRow[]>(() => {
    const today = ymdToday();
    const acc: Record<PropertySlug, MathRow> = {
      levante:  emptyMathRow('levante',  PROPERTY_LABELS.levante),
      estrecho: emptyMathRow('estrecho', PROPERTY_LABELS.estrecho),
      marea:    emptyMathRow('marea',    PROPERTY_LABELS.marea),
      cala:     emptyMathRow('cala',     PROPERTY_LABELS.cala),
    };
    for (const b of spotlightFiltered) {
      const slug = b.property_slug as PropertySlug;
      if (!(slug in acc)) continue;
      accumulateMath(acc[slug], b, today);
    }
    return PROPERTY_SLUGS.map((s) => acc[s]);
  }, [spotlightFiltered]);

  const statusMathRows = useMemo<MathRow[]>(() => {
    const today = ymdToday();
    const acc: Record<StatusBucket, MathRow> = {
      pending:   emptyMathRow('pending',   'Pending'),
      unpaid:    emptyMathRow('unpaid',    'Unpaid'),
      completed: emptyMathRow('completed', 'Completed'),
      cancelled: emptyMathRow('cancelled', 'Cancelled'),
    };
    for (const b of spotlightFiltered) {
      accumulateMath(acc[bucketOf(b)], b, today);
    }
    return (['pending', 'unpaid', 'completed', 'cancelled'] as StatusBucket[]).map((s) => acc[s]);
  }, [spotlightFiltered]);

  const grandTotal = useMemo<MathRow>(() => {
    const today = ymdToday();
    const row = emptyMathRow('total', 'Total');
    for (const b of spotlightFiltered) accumulateMath(row, b, today);
    return row;
  }, [spotlightFiltered]);

  // ─── Split filtered into upcoming / history / cancelled ───
  // Cancelled is its own bucket so it doesn't bury settled bookings (refunded
  // / lost revenue) inside History. History is now strictly "the booking
  // happened and is done" — checked-out or pre-today non-cancelled stays.
  const today = ymdToday();
  const upcoming  = filtered.filter((b) => isUpcoming(b, today));
  const cancelled = filtered.filter((b) => b.status === 'cancelled').reverse();
  const history   = filtered
    .filter((b) => !isUpcoming(b, today) && b.status !== 'cancelled')
    .reverse();

  const upcomingTotal  = upcoming.reduce((s, b) => s + b.agreed_total_cents, 0);
  const historyTotal   = history.reduce((s, b) => s + b.agreed_total_cents, 0);
  const cancelledTotal = cancelled.reduce((s, b) => s + b.agreed_total_cents, 0);

  // Per-tab status sublines — clickable bucket filter triggers. Computed
  // from pre-bucket-filter data so the list stays stable when admin
  // selects one (otherwise picking "pending" would collapse "unpaid" /
  // "completed" sublines to zero, defeating the picker UX).
  //
  // Each bucket surfaces the figure that's actionable for that state:
  //   pending   → € agreed     (potential revenue, awaiting confirmation)
  //   unpaid    → € owed       (the actual ask if admin chases)
  //   completed → € collected  (revenue actually in)
  // Cancelled tab has no sublines — every booking in it shares one bucket.
  const preBucketFiltered = useMemo(() => {
    return spotlightFiltered.filter((b) => {
      if (propertyFilter && b.property_slug !== propertyFilter) return false;
      return true;
    });
  }, [spotlightFiltered, propertyFilter]);

  const upcomingSubRows = useMemo(
    () => computeBucketSubRows(preBucketFiltered.filter((b) => isUpcoming(b, today))),
    [preBucketFiltered, today],
  );
  const historySubRows = useMemo(
    () => computeBucketSubRows(
      preBucketFiltered.filter((b) => !isUpcoming(b, today) && b.status !== 'cancelled'),
    ),
    [preBucketFiltered, today],
  );

  function togglePropertyFilter(slug: PropertySlug) {
    setPropertyFilter((cur) => (cur === slug ? null : slug));
  }
  function toggleBucketFilter(b: StatusBucket) {
    setBucketFilter((cur) => (cur === b ? null : b));
  }
  function resetAll() {
    setPropertyFilter(null);
    setBucketFilter(null);
    setSearch('');
    setFromDays(0);
    setToDays(totalDays);
  }

  const anyFilterActive =
    propertyFilter !== null || bucketFilter !== null || search.trim() !== '' ||
    fromDays !== 0 || toDays !== totalDays;

  return (
    <>
      <AdminSection
        eyebrow="All Time"
        hint={`${grandTotal.count} ${grandTotal.count === 1 ? 'booking' : 'bookings'} matched`}
      >
        <SpotlightPanel
          search={search}
          onSearch={setSearch}
          minDate={minDate}
          maxDate={maxDate}
          totalDays={totalDays}
          fromDays={fromDays}
          toDays={toDays}
          onFromChange={setFromDays}
          onToChange={setToDays}
          onReset={resetAll}
          anyFilterActive={anyFilterActive}
          propertyRows={propertyMathRows}
          totalRow={grandTotal}
          activeProperty={propertyFilter}
          onToggleProperty={togglePropertyFilter}
        />
      </AdminSection>

      <section className="mb-10">
        <BookingsTabs
          active={activeTab}
          onChange={setActiveTab}
          upcomingCount={upcoming.length}
          upcomingTotal={upcomingTotal}
          upcomingSubRows={upcomingSubRows}
          historyCount={history.length}
          historyTotal={historyTotal}
          historySubRows={historySubRows}
          cancelledCount={cancelled.length}
          cancelledTotal={cancelledTotal}
          activeBucket={bucketFilter}
          onToggleBucket={toggleBucketFilter}
        />
        <AdminTable
          columns={BOOKING_COLUMNS}
          rows={
            activeTab === 'upcoming'  ? upcoming  :
            activeTab === 'history'   ? history   :
                                        cancelled
          }
          rowKey={(b) => b.id}
          onRowClick={setActiveBooking}
          emptyMessage={
            activeTab === 'upcoming'  ? 'No upcoming bookings match these filters.'  :
            activeTab === 'history'   ? 'No history matches these filters.'          :
                                        'No cancelled bookings match these filters.'
          }
        />
      </section>

      {activeBooking && (
        <BookingActionModal
          item={bookingRowToCalendarBooking(activeBooking)}
          onClose={() => setActiveBooking(null)}
        />
      )}
    </>
  );
}

// ─── Upcoming / History switch ──────────────────────────────────────────────
//
// Single-pill segmented control. Replaces two stacked AdminSection blocks so
// admin doesn't have to scroll between upcoming and history. Each pill shows
// its count + euro total inline; the active pill rises out of the slate-100
// well via white bg + soft shadow. The inactive pill stays clickable so the
// counts on both sides act as live previews of what's on the other tab.
//
//   ┌─────────────────────────────────────────────────────────┐
//   │ ┌──────────────────┐                                    │
//   │ │ UPCOMING         │   HISTORY                          │
//   │ │ 12 · €4,200      │   38 · €18,000                     │
//   │ └──────────────────┘                                    │
//   └─────────────────────────────────────────────────────────┘

function BookingsTabs({
  active, onChange,
  upcomingCount, upcomingTotal, upcomingSubRows,
  historyCount, historyTotal, historySubRows,
  cancelledCount, cancelledTotal,
  activeBucket, onToggleBucket,
}: {
  active: 'upcoming' | 'history' | 'cancelled';
  onChange: (t: 'upcoming' | 'history' | 'cancelled') => void;
  upcomingCount: number;
  upcomingTotal: number;
  upcomingSubRows: SubRow[];
  historyCount: number;
  historyTotal: number;
  historySubRows: SubRow[];
  cancelledCount: number;
  cancelledTotal: number;
  activeBucket: StatusBucket | null;
  onToggleBucket: (b: StatusBucket) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Bookings view"
      className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1.5 mb-3"
    >
      <TabPill
        label="Upcoming"
        count={upcomingCount}
        total={upcomingTotal}
        revenueLabel="to be made"
        subRows={upcomingSubRows}
        active={active === 'upcoming'}
        onClick={() => onChange('upcoming')}
        activeBucket={activeBucket}
        onToggleBucket={onToggleBucket}
      />
      <TabPill
        label="History"
        count={historyCount}
        total={historyTotal}
        revenueLabel="agreed"
        subRows={historySubRows}
        active={active === 'history'}
        onClick={() => onChange('history')}
        activeBucket={activeBucket}
        onToggleBucket={onToggleBucket}
      />
      <TabPill
        label="Cancelled"
        count={cancelledCount}
        total={cancelledTotal}
        revenueLabel="lost"
        tone="rose"
        subRows={[]}
        active={active === 'cancelled'}
        onClick={() => onChange('cancelled')}
        activeBucket={activeBucket}
        onToggleBucket={onToggleBucket}
      />
    </div>
  );
}

// TabPill — owns its tab-switch behaviour on the title region and exposes
// each status subline as its own bucket-filter button. Layout:
//
//   ┌─ pill (rounded-xl, white when active) ───────────────────┐
//   │  UPCOMING                                            26  │  ← title button
//   │  53.874 € to be made                                     │     (text-2xl count)
//   │  ─── divider ───────────────────────────────────────     │
//   │  PENDING            10.824 € agreed                  5   │  ← bucket buttons
//   │  UNPAID             23.595 € owed                   14   │     (active = ocean tint)
//   │  COMPLETED          13.860 € collected               7   │
//   └──────────────────────────────────────────────────────────┘
//
// Outer is a <div role="tab">, NOT a <button>, so the inner buttons
// (title + sublines) are valid HTML. Sublines toggle the bucket filter,
// active state highlights with bg-ocean/10 + bold ocean eyebrow.

function TabPill({
  label, count, total, revenueLabel, active, onClick, tone = 'ocean', subRows,
  activeBucket, onToggleBucket,
}: {
  label: string;
  count: number;
  total: number;
  revenueLabel: string;
  active: boolean;
  onClick: () => void;
  tone?: 'ocean' | 'rose';
  subRows: SubRow[];
  activeBucket: StatusBucket | null;
  onToggleBucket: (b: StatusBucket) => void;
}) {
  const titleEyebrow = active
    ? (tone === 'rose' ? 'text-rose-600' : 'text-ocean')
    : 'text-slate-400';
  return (
    <div
      role="tab"
      aria-selected={active}
      className={[
        'rounded-xl transition flex flex-col',
        active
          ? 'bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
          : 'hover:bg-white/60',
      ].join(' ')}
    >
      {/* Title region — click to switch tabs */}
      <button
        type="button"
        onClick={onClick}
        className="px-4 pt-3 pb-2 text-left rounded-t-xl"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className={[
            'text-xs font-mono uppercase tracking-[0.25em] truncate',
            titleEyebrow,
          ].join(' ')}>
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none">
            {count}
          </p>
        </div>
        <p className="text-xs text-slate-400 tabular-nums mt-1">
          {eur(total)} <span className="text-slate-300">{revenueLabel}</span>
        </p>
      </button>

      {/* Sub-row buttons — each one toggles `bucketFilter` */}
      {subRows.length > 0 && (
        <div className="border-t border-slate-100 mx-3 pt-1.5 pb-2 space-y-0.5">
          {subRows.map((s) => {
            const isActiveSub = activeBucket === s.bucket;
            return (
              <button
                key={s.bucket}
                type="button"
                onClick={() => onToggleBucket(s.bucket)}
                aria-pressed={isActiveSub}
                title={isActiveSub ? `Clear ${s.label.toLowerCase()} filter` : `Filter table to ${s.label.toLowerCase()}`}
                className={[
                  'w-full flex items-baseline justify-between gap-2 px-2 py-1 rounded-md text-xs transition',
                  isActiveSub
                    ? 'bg-ocean/10'
                    : 'hover:bg-slate-100/80',
                ].join(' ')}
              >
                <span
                  className={[
                    'font-mono uppercase tracking-[0.2em] truncate',
                    isActiveSub ? 'text-ocean font-bold' : 'text-slate-500',
                  ].join(' ')}
                >
                  {s.label}
                </span>
                <span className="flex items-baseline gap-2 shrink-0 tabular-nums">
                  <span className="text-slate-400">
                    {eur(s.total)} <span className="text-slate-300">{s.suffix}</span>
                  </span>
                  <span className={isActiveSub ? 'font-bold text-slate-900' : 'font-bold text-slate-700'}>
                    {s.count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Spotlight ──────────────────────────────────────────────────────────────

function SpotlightPanel({
  search, onSearch,
  minDate, maxDate, totalDays, fromDays, toDays, onFromChange, onToChange,
  onReset, anyFilterActive,
  propertyRows, totalRow,
  activeProperty, onToggleProperty,
}: {
  search: string;
  onSearch: (v: string) => void;
  minDate: string;
  maxDate: string;
  totalDays: number;
  fromDays: number;
  toDays: number;
  onFromChange: (n: number) => void;
  onToChange: (n: number) => void;
  /** Clears search, dates AND property/status filters in one shot. */
  onReset: () => void;
  /** True when any filter is non-default — drives the Reset button enabled state. */
  anyFilterActive: boolean;
  propertyRows: MathRow[];
  totalRow: MathRow;
  activeProperty: PropertySlug | null;
  onToggleProperty: (slug: PropertySlug) => void;
}) {
  const fromYmd = ymdAddDays(minDate, fromDays);
  const toYmd = ymdAddDays(minDate, toDays);

  // The displayed date hint doubles as the edit affordance — click it and
  // it morphs into two native date pickers so admin can type or pick exact
  // dates instead of dragging the slider for fine-grained picks.
  const [editingDates, setEditingDates] = useState(false);

  function setFromYmd(v: string) {
    if (!v) return;
    const days = ymdDiffDays(minDate, v);
    const clamped = Math.max(0, Math.min(days, toDays));
    onFromChange(clamped);
  }
  function setToYmd(v: string) {
    if (!v) return;
    const days = ymdDiffDays(minDate, v);
    const clamped = Math.min(totalDays, Math.max(days, fromDays));
    onToChange(clamped);
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {/* Search + reset on a single top row. Reset is disabled until there's
          actually something to clear so the button doesn't ghost-flash. */}
      <div className="flex items-center gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search guest name…"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
          />
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={!anyFilterActive}
          title="Clear search, dates, and active row filters"
          className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono uppercase tracking-widest text-slate-600 hover:border-slate-300 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Date range */}
      <div className="mb-5">
        <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
          <p className="text-xs font-mono uppercase tracking-widest text-slate-500">
            Check-in window
          </p>
          {editingDates ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fromYmd}
                min={minDate}
                max={toYmd}
                onChange={(e) => setFromYmd(e.target.value)}
                className="px-2 py-1 rounded border border-slate-200 text-xs font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
              />
              <span className="text-slate-300">→</span>
              <input
                type="date"
                value={toYmd}
                min={fromYmd}
                max={maxDate}
                onChange={(e) => setToYmd(e.target.value)}
                className="px-2 py-1 rounded border border-slate-200 text-xs font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
              />
              <button
                type="button"
                onClick={() => setEditingDates(false)}
                className="text-xs font-mono uppercase tracking-widest text-ocean hover:underline"
              >
                Done
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingDates(true)}
              className="text-xs font-mono tabular-nums text-slate-700 hover:text-ocean transition-colors"
              title="Click to enter exact dates"
            >
              {fmtSliderDate(fromYmd)} <span className="text-slate-300">→</span> {fmtSliderDate(toYmd)}
            </button>
          )}
        </div>
        <DateRangeSlider
          totalDays={totalDays}
          fromDays={fromDays}
          toDays={toDays}
          onFromChange={onFromChange}
          onToChange={onToChange}
        />
        <div className="flex items-baseline justify-between mt-1 text-xs font-mono text-slate-300 tabular-nums">
          <span>{fmtSliderDate(minDate)}</span>
          <span>{fmtSliderDate(maxDate)}</span>
        </div>
      </div>

      {/* Math table — property-axis breakdown with a Total at the bottom.
          Cross-filters the bookings table below via row clicks. Status
          breakdown is rendered elsewhere (TBD by caller). */}
        <MathTable
          propertyRows={propertyRows}
          totalRow={totalRow}
          activeProperty={activeProperty}
          onToggleProperty={onToggleProperty}
        />
    </div>
  );
}

function DateRangeSlider({
  totalDays, fromDays, toDays, onFromChange, onToChange,
}: {
  totalDays: number;
  fromDays: number;
  toDays: number;
  onFromChange: (n: number) => void;
  onToChange: (n: number) => void;
}) {
  const fromPct = totalDays === 0 ? 0 : (fromDays / totalDays) * 100;
  const toPct   = totalDays === 0 ? 100 : (toDays / totalDays) * 100;

  return (
    <div className="relative h-6">
      {/* Inactive track */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-slate-200 rounded" />
      {/* Active range */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-1 bg-ocean rounded"
        style={{ left: `${fromPct}%`, right: `${100 - toPct}%` }}
      />
      {/* Min handle */}
      <input
        type="range"
        min={0}
        max={totalDays}
        value={fromDays}
        onChange={(e) => {
          const v = Math.min(parseInt(e.target.value, 10), toDays);
          onFromChange(v);
        }}
        className="dual-slider absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
        aria-label="Check-in earliest"
      />
      {/* Max handle */}
      <input
        type="range"
        min={0}
        max={totalDays}
        value={toDays}
        onChange={(e) => {
          const v = Math.max(parseInt(e.target.value, 10), fromDays);
          onToChange(v);
        }}
        className="dual-slider absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
        aria-label="Check-in latest"
      />
      {/* Inline styles for the thumbs — Tailwind 4 doesn't have first-class
          ::-webkit-slider-thumb utilities, and this stays scoped to this
          component without polluting globals. */}
      <style jsx>{`
        .dual-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: var(--color-ocean);
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25);
          cursor: grab;
          pointer-events: auto;
        }
        .dual-slider::-webkit-slider-thumb:active {
          cursor: grabbing;
        }
        .dual-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: var(--color-ocean);
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25);
          cursor: grab;
          pointer-events: auto;
        }
      `}</style>
    </div>
  );
}

// ─── Math table ─────────────────────────────────────────────────────────────
//
// Spotlight's analytic core. Two-axis breakdown (property + status) with one
// shared Total — both axes sum to the same number (the "math invariant"; if
// it desynchronises, the bug is in `accumulateMath`).
//
// Layout:
//   * Desktop (md+): a single <table> where Property rows render a
//     status-segmented bar in column 2, then numeric columns to the right.
//     Status rows leave the bar cell empty (a Status row would just be one
//     solid colour — not informative). Bar column hides on mobile via
//     `hidden md:table-cell` on every bar cell, including the header.
//   * Mobile (<md): bar graph + count rendered ABOVE as its own block (so
//     admin gets the visual at-a-glance read), followed by the numeric
//     table without the bar column.
//   * Total row at the bottom of the table in both layouts.
//
//   Desktop:
//   ┌──────────┬────────────────────┬────┬────┬─────────┬─────────┬─────────┬──────────┐
//   │ Property │ Bar                │ Up │ Bk │ Agreed  │ Paid    │ Owed    │ Cleaning │
//   │ LEVANTE  │ ████████▓▒░░░░░░░░ │ 5  │ 12 │ €4,200  │ €3,000  │ €1,200  │ €120     │
//   │ ESTRECHO │ ██████████▓▒░░░░░░ │ 3  │ 14 │ €5,200  │ €4,000  │ €1,200  │ €130     │
//   │ ...                                                                                │
//   │ Status                                                                             │
//   │ Pending  │                    │ 2  │ 2  │ €800    │ —       │ €800    │ €80      │
//   │ ...                                                                                │
//   │ Total    │                    │ 10 │ 36 │ €13,400 │ €12,500 │ €4,900  │ €420     │
//   └──────────┴────────────────────┴────┴────┴─────────┴─────────┴─────────┴──────────┘
//
//   Mobile:
//     LEVANTE  ████████▓▒░░░░░░  12      ← bar block (property only)
//     ESTRECHO ██████████▓▒░░░░  14
//     MAREA    ██████░░░░░░░░░░   8
//     CALA     ██░░░░░░░░░░░░░░   2
//     ──────────────────────────────
//     Property | Up Bk Agreed ... ← table follows

function MathTable({
  propertyRows, totalRow,
  activeProperty, onToggleProperty,
}: {
  propertyRows: MathRow[];
  totalRow: MathRow;
  activeProperty: PropertySlug | null;
  onToggleProperty: (slug: PropertySlug) => void;
}) {
  // Common bar scale — busiest property maxes the bar; others are
  // proportional. Floor at 1 to dodge divide-by-zero when spotlight is
  // empty.
  const maxCount = Math.max(1, ...propertyRows.map((r) => r.count));

  return (
    <div>
      {/* Mobile-only property bar block — at-a-glance visual before the
          number-dense table below. Each row is also a clickable filter
          trigger, kept in sync with the in-table property rows. */}
      <div className="md:hidden mb-4 space-y-1">
        {propertyRows.map((r) => (
          <MobileBarRow
            key={r.key}
            row={r}
            maxCount={maxCount}
            active={activeProperty === r.key}
            onClick={() => onToggleProperty(r.key as PropertySlug)}
          />
        ))}
      </div>

      <div className="overflow-x-auto -mx-5">
        <table className="w-full min-w-[560px] md:min-w-[720px] text-sm tabular-nums">
          <thead>
            <tr className="text-xs font-mono uppercase tracking-widest text-slate-400">
              <th scope="col" className="text-left  font-normal py-2 pl-5 pr-3 w-[110px]">{'Properties'}</th>
              <th scope="col" className="hidden md:table-cell text-left font-normal py-2 px-2 min-w-[220px]">{' '}</th>
              <th
                scope="col"
                title="Upcoming / Total — Upcoming = stay isn't done and isn't cancelled. Total = all bookings in this slice."
                className="text-right font-normal py-2 px-1.5 whitespace-nowrap cursor-help underline-offset-4 decoration-dotted hover:underline hover:text-slate-600 transition-colors"
              >
                Bookings
              </th>
              <th
                scope="col"
                title="Paid / Agreed — Paid = € collected so far. Agreed = € committed at booking time."
                className="text-right font-normal py-2 px-1.5 whitespace-nowrap cursor-help underline-offset-4 decoration-dotted hover:underline hover:text-slate-600 transition-colors"
              >
                Payments
              </th>
              <th
                scope="col"
                title="Outstanding balance (Agreed − Paid). Cancelled bookings are excluded — their refund policy already settled."
                className="text-right font-normal py-2 px-1.5 cursor-help underline-offset-4 decoration-dotted hover:underline hover:text-slate-600 transition-colors"
              >
                Owed
              </th>
              <th
                scope="col"
                title="Cleaning fees (the cleaner's slice of agreed €). Flat per-booking, separate from property revenue."
                className="text-right font-normal py-2 pl-1.5 pr-5 cursor-help underline-offset-4 decoration-dotted hover:underline hover:text-slate-600 transition-colors"
              >
                Cleaning
              </th>
            </tr>
          </thead>

          <tbody>
            {propertyRows.map((r) => (
              <MathRowEl
                key={r.key}
                row={r}
                showBar
                maxCount={maxCount}
                active={activeProperty === r.key}
                onClick={() => onToggleProperty(r.key as PropertySlug)}
              />
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-slate-200">
              <th
                scope="row"
                className="text-left py-2.5 pl-5 pr-3 text-xs font-mono uppercase tracking-widest text-slate-700"
              >
                Total
              </th>
              <td className="hidden md:table-cell" />
              <td className="text-right py-2.5 px-1.5 whitespace-nowrap">
                {totalRow.count === 0 ? (
                  <span className="text-slate-300">—</span>
                ) : (
                  <>
                    <span className="font-bold text-slate-900">{totalRow.upcoming}</span>
                    <span className="text-slate-300"> / </span>
                    <span className="text-slate-500">{totalRow.count}</span>
                  </>
                )}
              </td>
              <td className="text-right py-2.5 px-1.5 whitespace-nowrap">
                {totalRow.count === 0 ? (
                  <span className="text-slate-300">—</span>
                ) : (
                  <>
                    <span className={totalRow.paid > 0 ? 'font-bold text-emerald-700' : 'text-slate-300'}>
                      {eur(totalRow.paid)}
                    </span>
                    <span className="text-slate-300"> / </span>
                    <span className="text-slate-500">{eur(totalRow.agreed)}</span>
                  </>
                )}
              </td>
              <td className={`text-right py-2.5 px-1.5 font-bold ${totalRow.owed > 0 ? 'text-amber-700' : 'text-slate-300'}`}>
                {eur(totalRow.owed)}
              </td>
              <td className="text-right py-2.5 pl-1.5 pr-5 font-bold text-slate-700">
                {eur(totalRow.cleaning)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function MathRowEl({
  row, showBar, maxCount, active, onClick,
}: {
  row: MathRow;
  /** True for property rows (paint the segmented bar). False for status
   *  rows — their bar would be a single solid colour, no signal. */
  showBar: boolean;
  maxCount: number;
  active: boolean;
  onClick: () => void;
}) {
  const empty = row.count === 0;
  const disabled = empty && !active;
  return (
    <tr
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={active}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={[
        'transition-colors border-t border-slate-100',
        active
          ? 'bg-ocean/5'
          : disabled
            ? 'opacity-40 cursor-not-allowed'
            : 'cursor-pointer hover:bg-slate-50',
      ].join(' ')}
    >
      <th
        scope="row"
        className={[
          'text-left py-2 pl-5 pr-3 text-xs font-mono uppercase tracking-widest',
          active ? 'text-slate-900 font-bold' : empty ? 'text-slate-400' : 'text-slate-700',
        ].join(' ')}
      >
        {row.label}
      </th>
      <td className="hidden md:table-cell px-2 py-2 min-w-[220px]">
        {showBar ? <SegmentedBar row={row} maxCount={maxCount} /> : null}
      </td>
      {/* Bookings: upcoming / count — numerator (upcoming) is the live
          number admin acts on, denominator (count) is the ceiling, muted. */}
      <td className="text-right py-2 px-1.5 whitespace-nowrap">
        {empty ? (
          <span className="text-slate-300">—</span>
        ) : (
          <>
            <span className="font-semibold text-slate-900">{row.upcoming}</span>
            <span className="text-slate-300"> / </span>
            <span className="text-slate-500">{row.count}</span>
          </>
        )}
      </td>
      {/* Payments: paid / agreed — paid is emerald when something's
          collected, slate-300 when zero; agreed sits muted as the ceiling. */}
      <td className="text-right py-2 px-1.5 whitespace-nowrap">
        {empty ? (
          <span className="text-slate-300">—</span>
        ) : (
          <>
            <span className={row.paid > 0 ? 'font-semibold text-emerald-700' : 'text-slate-300'}>
              {eur(row.paid)}
            </span>
            <span className="text-slate-300"> / </span>
            <span className="text-slate-500">{eur(row.agreed)}</span>
          </>
        )}
      </td>
      <td className={`text-right py-2 px-1.5 ${empty ? 'text-slate-300' : row.owed > 0 ? 'text-amber-700' : 'text-slate-300'}`}>
        {empty ? '—' : eur(row.owed)}
      </td>
      <td className={`text-right py-2 pl-1.5 pr-5 ${empty ? 'text-slate-300' : 'text-slate-500'}`}>
        {empty ? '—' : eur(row.cleaning)}
      </td>
    </tr>
  );
}

// ─── Bar graph helpers ──────────────────────────────────────────────────────
//
// Visual borrows from GanttStrip: a thin pill, normalised to the busiest
// property. Inside, three flex segments weighted by status counts so the
// row's overall cancelled/unconfirmed share is legible at a glance. Same
// palette as EstateOverview's BookingsCard (ocean / amber / rose).

function SegmentedBar({ row, maxCount }: { row: MathRow; maxCount: number }) {
  const widthPct = maxCount === 0 ? 0 : (row.count / maxCount) * 100;
  return (
    <div
      className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden"
      role="img"
      aria-label={`${row.label}: ${row.confirmed} confirmed, ${row.request} request, ${row.invite} invite, ${row.cancelled} cancelled`}
    >
      <div className="h-full flex" style={{ width: `${widthPct}%` }}>
        {row.confirmed > 0 && (
          <div
            className="h-full"
            style={{ flexGrow: row.confirmed, backgroundColor: COLOR.confirmed }}
            title={`${row.confirmed} confirmed`}
          />
        )}
        {row.request > 0 && (
          <div
            className="h-full"
            style={{ flexGrow: row.request, backgroundColor: COLOR.request }}
            title={`${row.request} request`}
          />
        )}
        {row.invite > 0 && (
          <div
            className="h-full"
            style={{ flexGrow: row.invite, backgroundColor: COLOR.invite }}
            title={`${row.invite} invite`}
          />
        )}
        {row.cancelled > 0 && (
          <div
            className="h-full"
            style={{ flexGrow: row.cancelled, backgroundColor: COLOR.cancelled }}
            title={`${row.cancelled} cancelled`}
          />
        )}
      </div>
    </div>
  );
}

// Mobile-only bar block: label + bar + count. Click toggles the same
// property filter as the in-table row (state lives in BookingsExplorer).

function MobileBarRow({
  row, maxCount, active, onClick,
}: {
  row: MathRow;
  maxCount: number;
  active: boolean;
  onClick: () => void;
}) {
  const empty = row.count === 0;
  const disabled = empty && !active;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={active}
      className={[
        'grid grid-cols-[80px_1fr_28px] items-center gap-3 py-1.5 px-2 -mx-2 rounded-lg w-full text-left transition',
        active
          ? 'bg-ocean/5 ring-1 ring-ocean/20'
          : disabled
            ? 'opacity-40 cursor-not-allowed'
            : 'hover:bg-slate-50',
      ].join(' ')}
    >
      <span
        className={[
          'text-xs font-mono uppercase tracking-widest truncate',
          active ? 'text-slate-900 font-bold' : empty ? 'text-slate-400' : 'text-slate-600',
        ].join(' ')}
      >
        {row.label}
      </span>
      <SegmentedBar row={row} maxCount={maxCount} />
      <span
        className={[
          'text-xs font-mono tabular-nums text-right',
          empty ? 'text-slate-300' : 'text-slate-900 font-bold',
        ].join(' ')}
      >
        {row.count || '—'}
      </span>
    </button>
  );
}

// ─── Bookings table column config ──────────────────────────────────────────
//
// Drives the shared <AdminTable> for the bookings list. Each cell renders
// the same on desktop (grid row) and mobile (stacked dl) — the table
// component handles the layout switch. The full row is the click target
// (opens BookingActionModal); no per-row edit button needed.

const BOOKING_COLUMNS: AdminTableColumn<BookingRow>[] = [
  {
    key: 'date',
    header: 'Date',
    width: 'minmax(0,1.3fr)',
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
    key: 'guest',
    header: 'Guest',
    width: 'minmax(0,1.4fr)',
    render: (b) => (
      <div className="min-w-0 flex items-baseline gap-2">
        <span className="text-sm text-slate-900 truncate">
          {b.user_name ?? <span className="italic text-slate-400">no user</span>}
        </span>
        <span className="text-xs text-slate-400 font-mono tabular-nums shrink-0">
          {partyLabel(b.guests)}
        </span>
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
