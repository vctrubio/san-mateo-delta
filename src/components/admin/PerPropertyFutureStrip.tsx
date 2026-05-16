'use client';

import { useState } from 'react';
import { ChevronRight, Eye, EyeOff, Pencil } from 'lucide-react';
import type { FuturePropertyData, Property } from '@/lib/properties';
import { BOOKING_STATUS_STYLES, PROPERTY_BLOCK_STYLE } from '@/lib/colors';
import { fmtDate } from '@/lib/dates';
import type { BookingStatus } from '@db/enums';
import { eur } from '@/lib/format';
import { PropertyEditModal } from './PropertyEditModal';

// ============================================================================
// PerPropertyFutureStrip — one card per property, five across at lg+.
//
// Layout per card:
//   ┌─ LEVANTE                       ● confirmed ─┐
//   │ PUBLIC   €185 / night · MAY              ✎  │
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
//   - Today-status pill (header)      → opens today's booking / block
//   - Bookings sub-card               → opens BookingsListModal
//   - Payments sub-card               → opens PaymentsListModal
//   - Pencil affordance (top right of the meta row)
//                                    → opens PropertyEditModal (the single
//                                       admin surface for editing a
//                                       property: title, description,
//                                       features, beds, m², visibility,
//                                       cleaning, + the season-based rate
//                                       editor). There is no /admin/properties
//                                       route anymore.
//
// Header right side shows a today-status dot — amber (request), violet
// (invite), ocean (held), slate (available), slate-800 (block). The
// meta row underneath is editorial chrome: publicity + the current
// month's nightly rate so the host can sanity-check pricing at a glance.
// ============================================================================

export type PerPropertyFutureStripProps = {
  rows: FuturePropertyData[];
  /** Full Property records keyed by slug. Used by the Edit pencil on each
   *  card to mount a PropertyEditModal preloaded with every field. */
  propertyBySlug: Record<string, Property>;
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
  propertyBySlug,
  activeSlug,
  onToggleProperty,
  onOpenBookings,
  onOpenPayments,
  onOpenToday,
}: PerPropertyFutureStripProps) {
  // The edit modal lives at the strip level so dismissing it doesn't have
  // to fight with each card's mounting; only one is ever open at a time.
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const editingProperty = editingSlug ? propertyBySlug[editingSlug] : null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
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
              onOpenEdit={() => setEditingSlug(r.slug)}
            />
          );
        })}
      </div>

      {editingProperty && (
        <PropertyEditModal
          property={editingProperty}
          onClose={() => setEditingSlug(null)}
        />
      )}
    </>
  );
}

// ----------------------------------------------------------------------------

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Card({
  row,
  isActive,
  onToggleActive,
  onOpenBookings,
  onOpenPayments,
  onOpenToday,
  onOpenEdit,
}: {
  row: FuturePropertyData;
  isActive: boolean;
  onToggleActive: () => void;
  onOpenBookings: () => void;
  onOpenPayments: () => void;
  onOpenToday: () => void;
  onOpenEdit: () => void;
}) {
  const totalUpcoming = row.pending_count + row.confirmed_count;
  const fullyPaid = row.outstanding_count === 0;
  const monthLabel = MONTH_LABELS[new Date().getMonth()];

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

      <MetaRow
        isPublic={row.is_public}
        rateCents={row.rate_current_cents}
        monthLabel={monthLabel}
        onOpenEdit={onOpenEdit}
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

// MetaRow — the chrome between the title and the metric sub-cards.
// Three slots:
//   left   → public / private chip (read-only here; toggle lives in the modal)
//   middle → current month's nightly rate (the "cool price" — a host
//            often wants to remind themselves what new bookings price at)
//   right  → pencil button → opens PropertyEditModal
//
// The pencil stops propagation so it doesn't toggle the card's active
// state, and the modal opens above the dashboard so the gantt stays in
// view behind the dim.
function MetaRow({
  isPublic,
  rateCents,
  monthLabel,
  onOpenEdit,
}: {
  isPublic: boolean;
  rateCents: number;
  monthLabel: string;
  onOpenEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
      <div className="flex items-center gap-2 min-w-0">
        <VisibilityChip isPublic={isPublic} />
        <RateBadge cents={rateCents} monthLabel={monthLabel} />
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenEdit();
        }}
        aria-label="Edit property"
        title="Edit property"
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-ocean hover:bg-ocean/5 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function VisibilityChip({ isPublic }: { isPublic: boolean }) {
  if (isPublic) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-mono uppercase tracking-widest"
        title="Listed on the public /finca routes"
      >
        <Eye className="w-2.5 h-2.5" /> Public
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-mono uppercase tracking-widest"
      title="Hidden from public routes (admin can still book)"
    >
      <EyeOff className="w-2.5 h-2.5" /> Private
    </span>
  );
}

function RateBadge({ cents, monthLabel }: { cents: number; monthLabel: string }) {
  if (cents <= 0) {
    return (
      <span className="text-[10px] font-mono text-slate-400 italic truncate">
        rate not set
      </span>
    );
  }
  return (
    <span className="inline-flex items-baseline gap-1 text-[11px] font-mono text-slate-600 truncate">
      <span className="font-semibold tabular-nums text-slate-900">{eur(cents)}</span>
      <span className="text-slate-400">/ night</span>
      <span className="text-slate-300">·</span>
      <span className="uppercase tracking-widest text-slate-400">{monthLabel}</span>
    </span>
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
