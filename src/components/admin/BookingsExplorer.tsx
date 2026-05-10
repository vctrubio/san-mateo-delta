'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import AdminSection from '@/components/admin/AdminSection';
import AdminTable, { type AdminTableColumn } from '@/components/admin/AdminTable';
import StatusActionToggle from '@/components/admin/StatusActionToggle';
import { fmtDateRange, nightsBetween } from '@/lib/dates';
import { PROPERTY_LABELS, PROPERTY_SLUGS, type PropertySlug } from '@/lib/colors';
import type { BookingRow } from '@/lib/bookings';

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

const STATUS_BUCKET_LABELS: Record<StatusBucket, string> = {
  pending:   'Pending',
  unpaid:    'Unpaid',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

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

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(cents / 100);
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

  // Filter pipeline — broken into stages so each card can see the right
  // upstream slice. Cross-filter rule: each card ignores its own axis but
  // respects every other filter. That way clicking LEVANTE lets the status
  // card show LEVANTE's bucket breakdown, while the property card still
  // shows totals across all four properties so admin can compare.
  //
  //   bookings ─[spotlight: search + date range]─▶ spotlightFiltered
  //   spotlightFiltered ─[bucket]─▶ propertyStats       (ignores property)
  //   spotlightFiltered ─[property]─▶ bucketStats       (ignores bucket)
  //   spotlightFiltered ─[property, bucket]─▶ filtered  (table + spotlight stats)
  const spotlightFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (b.date_check_in < fromYmd || b.date_check_in > toYmd) return false;
      // Search only matches guest name — property is already a filter axis
      // on the cards above, and email/id aren't useful enough as a haystack.
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

  // Property card stats — respect spotlight + bucket, ignore property filter.
  const propertyStats = useMemo(() => {
    const today = ymdToday();
    const stats: Record<PropertySlug, { upcoming: number; history: number }> = {
      levante:  { upcoming: 0, history: 0 },
      estrecho: { upcoming: 0, history: 0 },
      marea:    { upcoming: 0, history: 0 },
      cala:     { upcoming: 0, history: 0 },
    };
    for (const b of spotlightFiltered) {
      if (bucketFilter && bucketOf(b) !== bucketFilter) continue;
      const slug = b.property_slug as PropertySlug;
      if (!(slug in stats)) continue;
      if (isUpcoming(b, today)) stats[slug].upcoming++;
      else stats[slug].history++;
    }
    return stats;
  }, [spotlightFiltered, bucketFilter]);

  // Status card stats — respect spotlight + property, ignore bucket filter.
  const bucketStats = useMemo(() => {
    const stats: Record<StatusBucket, { count: number; agreed: number; paid: number }> = {
      pending:   { count: 0, agreed: 0, paid: 0 },
      unpaid:    { count: 0, agreed: 0, paid: 0 },
      completed: { count: 0, agreed: 0, paid: 0 },
      cancelled: { count: 0, agreed: 0, paid: 0 },
    };
    for (const b of spotlightFiltered) {
      if (propertyFilter && b.property_slug !== propertyFilter) continue;
      const bk = bucketOf(b);
      stats[bk].count++;
      stats[bk].agreed += b.agreed_total_cents;
      stats[bk].paid   += b.paid_cents;
    }
    return stats;
  }, [spotlightFiltered, propertyFilter]);

  // ─── Spotlight aggregates: across the *filtered* set ───
  const spotlight = useMemo(() => {
    let agreed = 0;
    let paid = 0;
    let owed = 0;
    for (const b of filtered) {
      agreed += b.agreed_total_cents;
      paid += b.paid_cents;
      // Owed only for non-cancelled bookings — a cancelled booking's
      // "remaining" is meaningless (the refund policy already settled it).
      if (b.status !== 'cancelled') {
        owed += Math.max(0, b.agreed_total_cents - b.paid_cents);
      }
    }
    return { count: filtered.length, agreed, paid, owed };
  }, [filtered]);

  // ─── Split filtered into upcoming/history ───
  const today = ymdToday();
  const upcoming = filtered.filter((b) => isUpcoming(b, today));
  const history  = filtered.filter((b) => !isUpcoming(b, today)).reverse();

  const upcomingTotal = upcoming.reduce((s, b) => s + b.agreed_total_cents, 0);
  const historyTotal  = history.reduce((s, b) => s + b.agreed_total_cents, 0);

  function togglePropertyFilter(slug: PropertySlug) {
    setPropertyFilter((cur) => (cur === slug ? null : slug));
  }
  function toggleBucketFilter(b: StatusBucket) {
    setBucketFilter((cur) => (cur === b ? null : b));
  }
  function resetFilters() {
    setPropertyFilter(null);
    setBucketFilter(null);
    setSearch('');
    setFromDays(0);
    setToDays(totalDays);
  }
  function resetSpotlight() {
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
        eyebrow="At a glance"
        hint={anyFilterActive ? (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-mono uppercase tracking-widest text-ocean hover:underline"
          >
            Reset filters
          </button>
        ) : undefined}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PropertyCardGrid
            stats={propertyStats}
            active={propertyFilter}
            onToggle={togglePropertyFilter}
          />
          <StatusCardGrid
            stats={bucketStats}
            active={bucketFilter}
            onToggle={toggleBucketFilter}
          />
        </div>
      </AdminSection>

      <AdminSection
        eyebrow="Spotlight"
        hint={`${spotlight.count} ${spotlight.count === 1 ? 'booking' : 'bookings'} matched`}
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
          aggregates={spotlight}
          onReset={resetSpotlight}
        />
      </AdminSection>

      <AdminSection
        eyebrow="Upcoming"
        hint={`${upcoming.length} ${upcoming.length === 1 ? 'booking' : 'bookings'} · ${eur(upcomingTotal)} to be made`}
      >
        <AdminTable
          columns={COLUMNS}
          rows={upcoming}
          rowKey={(b) => b.id}
          rowHref={(b) => `/admin/bookings/${b.id}`}
          emptyMessage="No upcoming bookings match these filters."
        />
      </AdminSection>

      <AdminSection
        eyebrow="History"
        hint={`${history.length} ${history.length === 1 ? 'booking' : 'bookings'} · ${eur(historyTotal)} agreed`}
      >
        <AdminTable
          columns={COLUMNS}
          rows={history}
          rowKey={(b) => b.id}
          rowHref={(b) => `/admin/bookings/${b.id}`}
          emptyMessage="No history matches these filters."
        />
      </AdminSection>
    </>
  );
}

// ─── Property card ──────────────────────────────────────────────────────────

function PropertyCardGrid({
  stats, active, onToggle,
}: {
  stats: Record<PropertySlug, { upcoming: number; history: number }>;
  active: PropertySlug | null;
  onToggle: (slug: PropertySlug) => void;
}) {
  return (
    <Card title="Properties" subtitle="upcoming · history">
      <div className="grid grid-cols-2 gap-2">
        {PROPERTY_SLUGS.map((slug) => {
          const isActive = active === slug;
          const s = stats[slug];
          // Cell is empty when the current filter scope has zero bookings on
          // this property. Mute + disable so admin can see "nothing to slice
          // into here" at a glance.
          const empty = s.upcoming + s.history === 0;
          return (
            <button
              key={slug}
              type="button"
              onClick={() => onToggle(slug)}
              aria-pressed={isActive}
              disabled={empty && !isActive}
              className={[
                'rounded-xl border bg-white px-3 py-3 text-left transition',
                isActive
                  ? 'border-ocean ring-2 ring-ocean/15'
                  : empty
                    ? 'border-slate-100 opacity-40 cursor-not-allowed'
                    : 'border-slate-200 hover:border-slate-300',
              ].join(' ')}
            >
              <p className="text-sm font-bold uppercase tracking-widest text-slate-900">
                {PROPERTY_LABELS[slug]}
              </p>
              <p className="text-xs text-slate-500 tabular-nums mt-1">
                <span className="text-slate-900 font-bold">{s.upcoming}</span> upcoming
                <span className="text-slate-300"> · </span>
                <span className="text-slate-700 font-bold">{s.history}</span> history
              </p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Status card ────────────────────────────────────────────────────────────

function StatusCardGrid({
  stats, active, onToggle,
}: {
  stats: Record<StatusBucket, { count: number; agreed: number; paid: number }>;
  active: StatusBucket | null;
  onToggle: (b: StatusBucket) => void;
}) {
  // Per-bucket "primary number" — what the admin most cares about for that
  // slice. Pending = € agreed (potential), Unpaid = € owed (action),
  // Completed = € collected (revenue), Cancelled = € lost.
  const primary: Record<StatusBucket, string> = {
    pending:   eur(stats.pending.agreed),
    unpaid:    eur(stats.unpaid.agreed - stats.unpaid.paid),
    completed: eur(stats.completed.paid),
    cancelled: eur(stats.cancelled.agreed),
  };
  const primaryLabel: Record<StatusBucket, string> = {
    pending:   'agreed',
    unpaid:    'owed',
    completed: 'collected',
    cancelled: 'lost',
  };

  return (
    <Card title="Status" subtitle="count · primary €">
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(STATUS_BUCKET_LABELS) as StatusBucket[]).map((b) => {
          const isActive = active === b;
          const s = stats[b];
          const empty = s.count === 0;
          return (
            <button
              key={b}
              type="button"
              onClick={() => onToggle(b)}
              aria-pressed={isActive}
              disabled={empty && !isActive}
              className={[
                'rounded-xl border bg-white px-3 py-3 text-left transition',
                isActive
                  ? 'border-ocean ring-2 ring-ocean/15'
                  : empty
                    ? 'border-slate-100 opacity-40 cursor-not-allowed'
                    : 'border-slate-200 hover:border-slate-300',
              ].join(' ')}
            >
              <p className="text-sm font-bold uppercase tracking-widest text-slate-900">
                {STATUS_BUCKET_LABELS[b]}
              </p>
              <p className="text-xs text-slate-500 tabular-nums mt-1">
                <span className="text-slate-900 font-bold">{s.count}</span>
                {' · '}
                <span className="text-slate-700 font-bold">{primary[b]}</span>
                <span className="text-slate-300"> {primaryLabel[b]}</span>
              </p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Spotlight ──────────────────────────────────────────────────────────────

function SpotlightPanel({
  search, onSearch,
  minDate, maxDate, totalDays, fromDays, toDays, onFromChange, onToChange,
  aggregates, onReset,
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
  aggregates: { count: number; agreed: number; paid: number; owed: number };
  /** Clears search + date window; leaves property/bucket cards alone. */
  onReset: () => void;
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
          disabled={!search && fromDays === 0 && toDays === totalDays}
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

      {/* Aggregates */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-4 border-t border-slate-100">
        <Stat label="Bookings" value={String(aggregates.count)} tone="slate" />
        <Stat label="Agreed" value={eur(aggregates.agreed)} tone="slate" />
        <Stat label="Paid" value={eur(aggregates.paid)} tone="emerald" />
        <Stat label="Owed" value={eur(aggregates.owed)} tone={aggregates.owed > 0 ? 'amber' : 'slate'} />
      </div>
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

function Stat({
  label, value, tone,
}: {
  label: string;
  value: string;
  tone: 'slate' | 'emerald' | 'amber';
}) {
  const valueClass =
    tone === 'emerald' ? 'text-emerald-700' :
    tone === 'amber'   ? 'text-amber-700'   :
                         'text-slate-900';
  return (
    <div>
      <p className="text-xs font-mono uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-base font-bold tabular-nums mt-0.5 ${valueClass}`}>{value}</p>
    </div>
  );
}

// ─── Card shell ─────────────────────────────────────────────────────────────

function Card({
  title, subtitle, children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-mono uppercase tracking-widest text-slate-700 font-bold">
          {title}
        </h3>
        <span className="text-xs font-mono uppercase tracking-widest text-slate-300">
          {subtitle}
        </span>
      </div>
      {children}
    </div>
  );
}

// ─── Table columns ──────────────────────────────────────────────────────────

const COLUMNS: AdminTableColumn<BookingRow>[] = [
  {
    key: 'date',
    header: 'Date',
    width: 'minmax(0,1.4fr)',
    render: (b) => {
      const nights = nightsBetween(b.date_check_in, b.date_check_out);
      const slugLabel = PROPERTY_LABELS[b.property_slug as keyof typeof PROPERTY_LABELS] ?? b.property_slug;
      return (
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-sm font-semibold text-slate-900">
              {fmtDateRange(b.date_check_in, b.date_check_out)}
            </span>
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
              · {nights}n
            </span>
          </div>
          <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mt-1">
            {slugLabel}
          </p>
        </div>
      );
    },
  },
  {
    key: 'guest',
    header: 'Guest',
    width: 'minmax(0,1.2fr)',
    render: (b) => (
      <div className="min-w-0">
        <p className="text-sm text-slate-900 truncate">
          {b.user_name ?? <span className="italic text-slate-400">no user</span>}
        </p>
        <p className="text-xs text-slate-500 tabular-nums mt-0.5">
          {partyLabel(b.guests)}
        </p>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: 'minmax(0,0.9fr)',
    render: (b) => (
      <StatusActionToggle
        bookingId={b.id}
        status={b.status}
        dateCheckIn={b.date_check_in}
      />
    ),
  },
  {
    key: 'agreed',
    header: 'Agreed',
    align: 'right',
    width: '110px',
    render: (b) => (
      <span className="font-mono tabular-nums text-sm text-slate-900">
        {eur(b.agreed_total_cents)}
      </span>
    ),
  },
  {
    key: 'paid',
    header: 'Paid',
    align: 'right',
    width: '110px',
    render: (b) => {
      const fullyPaid = b.paid_cents >= b.agreed_total_cents;
      const tone = fullyPaid
        ? 'text-emerald-700'
        : b.paid_cents === 0 ? 'text-slate-300' : 'text-amber-700';
      return (
        <span className={`font-mono tabular-nums text-sm ${tone}`}>
          {eur(b.paid_cents)}
        </span>
      );
    },
  },
];
