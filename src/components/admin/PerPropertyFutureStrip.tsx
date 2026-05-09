'use client';

import { Bed } from 'lucide-react';
import type { FuturePropertyData } from '@/lib/properties';
import { BOOKING_STATUS_STYLES } from '@/lib/colors';
import { fmtDate } from '@/lib/dates';
import type { BookingStatus } from '@db/enums';

// ============================================================================
// PerPropertyFutureStrip — four cards, one per property. Clicking a card
// toggles it active (border highlights ocean); the calendar grid below opens
// for that property.
//
// Each card is a plain operational snapshot, four lines:
//   1. Today        — available, or status-colored "occupied" with guest
//   2. Upcoming     — total bookings split into "to confirm" + "confirmed"
//   3. Outstanding  — money still owed across confirmed-upcoming + count
//   4. Next         — earliest confirmed arrival, or "none"
//
// No cleaning/property fee split here — bucket definitions live in
// docs/availability.md and the SQL is in `listFuturePropertyData()`.
// ============================================================================

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(cents / 100);
}

export type PerPropertyFutureStripProps = {
  rows: FuturePropertyData[];
  /** Slug of the currently focused property, or null. */
  activeSlug: string | null;
  /** Toggles a property: pass slug to focus, null to clear. */
  onToggleProperty: (slug: string | null) => void;
};

export default function PerPropertyFutureStrip({
  rows,
  activeSlug,
  onToggleProperty,
}: PerPropertyFutureStripProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {rows.map((r) => {
        const isActive = r.slug === activeSlug;
        return (
          <button
            key={r.slug}
            type="button"
            onClick={() => onToggleProperty(isActive ? null : r.slug)}
            aria-pressed={isActive}
            className={[
              'text-left rounded-2xl bg-white p-5 transition-all border-2',
              isActive
                ? 'border-ocean shadow-lg shadow-ocean/10'
                : 'border-slate-100 hover:border-slate-300',
            ].join(' ')}
          >
            <Card row={r} isActive={isActive} />
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------

function Card({ row, isActive }: { row: FuturePropertyData; isActive: boolean }) {
  const upcomingTotal = row.pending_count + row.confirmed_count;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: `var(--color-property-${row.slug})` }}
        />
        <h4 className={`text-sm font-bold uppercase tracking-wider ${isActive ? 'text-ocean' : 'text-slate-900'}`}>
          {row.slug}
        </h4>
        {isActive && (
          <span className="ml-auto text-[9px] font-mono uppercase tracking-widest text-ocean">
            active
          </span>
        )}
      </div>

      {/* Today */}
      <TodayLine row={row} />

      {/* Upcoming */}
      <Stat
        label="Upcoming"
        value={String(upcomingTotal)}
        sub={
          upcomingTotal === 0
            ? 'no bookings ahead'
            : `${row.pending_count} to confirm · ${row.confirmed_count} confirmed`
        }
        emphasis={upcomingTotal > 0}
      />

      {/* Outstanding */}
      <Stat
        label="Outstanding"
        value={row.outstanding_cents > 0 ? eur(row.outstanding_cents) : '—'}
        sub={
          row.outstanding_count === 0
            ? 'fully paid'
            : `${row.outstanding_count} ${row.outstanding_count === 1 ? 'booking owes' : 'bookings owe'}`
        }
        tone={row.outstanding_cents > 0 ? 'amber' : 'muted'}
      />

      {/* Next check-in */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5">
        <Bed className="w-3 h-3 text-slate-400 shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Next</span>
        {row.next_check_in ? (
          <span className="text-[11px] text-slate-700 truncate">
            {fmtDate(row.next_check_in)}
            {row.next_check_in_guest && (
              <span className="text-slate-400"> · {row.next_check_in_guest}</span>
            )}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 italic">none</span>
        )}
      </div>
    </>
  );
}

// ----------------------------------------------------------------------------

function TodayLine({ row }: { row: FuturePropertyData }) {
  if (row.today_occupied && row.today_status) {
    const status = row.today_status as BookingStatus;
    const style = BOOKING_STATUS_STYLES[status];
    return (
      <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 mb-3">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            today · {style.label}
          </span>
        </div>
        <p className="text-[11px] text-slate-700 truncate">
          {row.today_guest_name ?? <span className="italic text-slate-400">no guest</span>}
          {row.today_check_out && (
            <span className="text-slate-400"> · until {fmtDate(row.today_check_out)}</span>
          )}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5 mb-3">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700">
          today · available
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------

function Stat({
  label,
  value,
  sub,
  emphasis,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub: string;
  emphasis?: boolean;
  tone?: 'default' | 'amber' | 'muted';
}) {
  const valueClass =
    tone === 'amber'
      ? 'text-amber-700'
      : tone === 'muted'
        ? 'text-slate-300'
        : emphasis
          ? 'text-slate-900'
          : 'text-slate-400';
  return (
    <div className="mt-2 flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 leading-tight">
          {label}
        </p>
        <p className="text-[10px] text-slate-500 truncate leading-tight">{sub}</p>
      </div>
      <span className={`text-xl font-bold tabular-nums shrink-0 ${valueClass}`}>{value}</span>
    </div>
  );
}
