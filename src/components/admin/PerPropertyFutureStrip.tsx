'use client';

import { ChevronRight } from 'lucide-react';
import type { FuturePropertyData } from '@/lib/properties';
import { BOOKING_STATUS_STYLES, PROPERTY_BLOCK_STYLE } from '@/lib/colors';
import { fmtDate } from '@/lib/dates';
import type { BookingStatus } from '@db/enums';

// ============================================================================
// PerPropertyFutureStrip — four cards, one per property.
//
// Layout per card:
//   ┌─ LEVANTE                       ● confirmed ─┐
//   │                                              │
//   │ ┌─ BOOKINGS  › ┐  ┌─ PAYMENTS  › ┐           │
//   │ │ 7            │  │ €8,607       │           │
//   │ │ 2 to confirm │  │ outstanding  │           │
//   │ │   · 5 confd  │  │   · 5 owed   │           │
//   │ └──────────────┘  └──────────────┘           │
//   │                                              │
//   │ NEXT CHECK-IN                                │
//   │ 28 May · Tom                                 │
//   └──────────────────────────────────────────────┘
//
// Click targets:
//   - The whole card                  → toggle the property as active
//   - Bookings sub-card               → opens BookingsListModal
//   - Payments sub-card               → opens PaymentsListModal
//
// Header right side shows a today-status dot — amber (request), violet
// (invite), ocean (held), slate (available) — driven by
// `today_indicator_status` from listFuturePropertyData.
// ============================================================================

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(cents / 100);
}

export type PerPropertyFutureStripProps = {
  rows: FuturePropertyData[];
  activeSlug: string | null;
  onToggleProperty: (slug: string | null) => void;
  onOpenBookings: (slug: string) => void;
  onOpenPayments: (slug: string) => void;
  /** Fires when the today-status pill is clicked. Parent finds today's booking
   *  in itemsBySlug and opens it through the same modal flow as the gantt. */
  onOpenToday: (slug: string) => void;
};

export default function PerPropertyFutureStrip({
  rows,
  activeSlug,
  onToggleProperty,
  onOpenBookings,
  onOpenPayments,
  onOpenToday,
}: PerPropertyFutureStripProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {rows.map((r) => {
        const isActive = r.slug === activeSlug;
        return (
          <Card
            key={r.slug}
            row={r}
            isActive={isActive}
            onToggleActive={() => onToggleProperty(isActive ? null : r.slug)}
            onOpenBookings={() => onOpenBookings(r.slug)}
            onOpenPayments={() => onOpenPayments(r.slug)}
            onOpenToday={() => onOpenToday(r.slug)}
          />
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------

function Card({
  row,
  isActive,
  onToggleActive,
  onOpenBookings,
  onOpenPayments,
  onOpenToday,
}: {
  row: FuturePropertyData;
  isActive: boolean;
  onToggleActive: () => void;
  onOpenBookings: () => void;
  onOpenPayments: () => void;
  onOpenToday: () => void;
}) {
  const totalUpcoming = row.pending_count + row.confirmed_count;
  const fullyPaid = row.outstanding_count === 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggleActive}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleActive();
        }
      }}
      aria-pressed={isActive}
      className={[
        'rounded-2xl bg-white p-5 transition-all border-2 cursor-pointer',
        isActive
          ? 'border-ocean shadow-lg shadow-ocean/10'
          : 'border-slate-100 hover:border-slate-200',
      ].join(' ')}
    >
      <Header
        slug={row.slug}
        isActive={isActive}
        todayBlocked={row.today_blocked}
        todayIndicator={row.today_indicator_status}
        onOpenToday={onOpenToday}
      />

      <div className="grid grid-cols-2 gap-2 mt-3 mb-3">
        <SubCard
          label="Bookings"
          headline={String(totalUpcoming)}
          tone="default"
          onClick={onOpenBookings}
          sub={
            totalUpcoming === 0 ? (
              <span className="italic text-slate-400">no upcoming</span>
            ) : (
              <BookingsBreakdown
                pending={row.pending_count}
                confirmed={row.confirmed_count}
              />
            )
          }
        />
        <SubCard
          label="Payments"
          headline={fullyPaid ? '—' : eur(row.outstanding_cents)}
          tone={fullyPaid ? 'muted' : 'amber'}
          onClick={onOpenPayments}
          sub={
            fullyPaid ? (
              <span className="italic text-slate-400">fully paid</span>
            ) : (
              <>
                outstanding · <span className="tabular-nums">{row.outstanding_count}</span>
              </>
            )
          }
        />
      </div>

      <Section label="Next check-in">
        <NextContent date={row.next_check_in} guest={row.next_check_in_guest} />
      </Section>
    </div>
  );
}

// ----------------------------------------------------------------------------

function Header({
  slug,
  isActive,
  todayBlocked,
  todayIndicator,
  onOpenToday,
}: {
  slug: string;
  isActive: boolean;
  todayBlocked: boolean;
  todayIndicator: string | null;
  onOpenToday: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h4 className={`text-base font-bold uppercase tracking-wider ${isActive ? 'text-ocean' : 'text-slate-900'}`}>
        {slug}
      </h4>
      <TodayIndicator
        blocked={todayBlocked}
        status={todayIndicator}
        onClick={onOpenToday}
      />
    </div>
  );
}

function TodayIndicator({
  blocked,
  status,
  onClick,
}: {
  blocked: boolean;
  status: string | null;
  onClick: () => void;
}) {
  // Block takes priority — admin-imposed unavailability is the strongest signal.
  // Tap target — increased padding for touch friendliness on mobile.
  const interactiveCls =
    'inline-flex items-center gap-1.5 py-1 px-1.5 -my-1 -mr-1 text-[9px] font-mono uppercase tracking-widest text-slate-500 hover:scale-110 hover:text-slate-900 transition-transform origin-right';

  if (blocked) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={interactiveCls}
        title={`Open today's block · ${PROPERTY_BLOCK_STYLE.label}`}
      >
        <span className={`w-2 h-2 rounded-full ${PROPERTY_BLOCK_STYLE.dot}`} />
        {PROPERTY_BLOCK_STYLE.label}
      </button>
    );
  }
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-slate-400">
        <span className="w-2 h-2 rounded-full bg-slate-300" />
        available
      </span>
    );
  }
  // Use the status palette directly (same source of truth as GanttStrip's day
  // cells) so checked_in renders emerald, checked_out renders slate-300, etc.
  const s = status as BookingStatus;
  const style = BOOKING_STATUS_STYLES[s];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={interactiveCls}
      title={`Open today's booking · ${style?.label ?? s}`}
    >
      <span className={`w-2 h-2 rounded-full ${style?.dot ?? 'bg-slate-300'}`} />
      {style?.label ?? s}
    </button>
  );
}

// ----------------------------------------------------------------------------

function SubCard({
  label,
  headline,
  tone,
  sub,
  onClick,
}: {
  label: string;
  headline: string;
  tone: 'default' | 'amber' | 'muted';
  sub: React.ReactNode;
  onClick: () => void;
}) {
  const headlineCls =
    tone === 'amber' ? 'text-amber-700'
    : tone === 'muted' ? 'text-slate-300'
    : 'text-slate-900';
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="text-left rounded-xl bg-slate-50/60 hover:bg-slate-100 transition-colors p-3 group"
    >
      <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-400 mb-1 flex items-center gap-1">
        {label}
        <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </p>
      <p className={`text-xl sm:text-2xl font-bold tabular-nums leading-none ${headlineCls}`}>
        {headline}
      </p>
      <p className="text-[11px] text-slate-500 mt-1 truncate">{sub}</p>
    </button>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-400 mb-1">
        {label}
      </p>
      {children}
    </div>
  );
}

// ----------------------------------------------------------------------------

function BookingsBreakdown({ pending, confirmed }: { pending: number; confirmed: number }) {
  const parts: React.ReactNode[] = [];
  if (pending > 0) {
    parts.push(
      <span key="p"><span className="tabular-nums">{pending}</span> to confirm</span>,
    );
  }
  if (confirmed > 0) {
    parts.push(
      <span key="c"><span className="tabular-nums">{confirmed}</span> confirmed</span>,
    );
  }
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="text-slate-300"> · </span>}
          {p}
        </span>
      ))}
    </>
  );
}

// ----------------------------------------------------------------------------

function NextContent({ date, guest }: { date: string | null; guest: string | null }) {
  if (!date) return <p className="text-[13px] text-slate-400 italic">none</p>;
  return (
    <p className="text-[13px] text-slate-700">
      <span className="font-bold tabular-nums">{fmtDate(date)}</span>
      {guest && (
        <>
          <span className="text-slate-300"> · </span>
          <span className="text-slate-500">{guest}</span>
        </>
      )}
    </p>
  );
}
