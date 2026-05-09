'use client';

import { ChevronRight } from 'lucide-react';
import type { FuturePropertyData } from '@/lib/properties';
import { BOOKING_STATUS_STYLES } from '@/lib/colors';
import { fmtDate } from '@/lib/dates';
import type { BookingStatus } from '@db/enums';

// ============================================================================
// PerPropertyFutureStrip — four cards, one per property.
//
// Each card has three click targets:
//   - Header (slug)            → toggles the property as active (calendar
//                                opens below)
//   - Bookings section         → opens the bookings list modal
//   - Payments section         → opens the outstanding-payments modal
//
// Today + Next check-in are read-only.
//
// Hierarchy: every clickable section leads with its TOTAL as the headline
// number (large, bold, tabular), with breakdown text small + subtle below.
// Today's section also shows the held booking's payment state inline.
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
};

export default function PerPropertyFutureStrip({
  rows,
  activeSlug,
  onToggleProperty,
  onOpenBookings,
  onOpenPayments,
}: PerPropertyFutureStripProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {rows.map((r) => {
        const isActive = r.slug === activeSlug;
        return (
          <div
            key={r.slug}
            className={[
              'rounded-2xl bg-white p-5 transition-all border-2',
              isActive
                ? 'border-ocean shadow-lg shadow-ocean/10'
                : 'border-slate-100',
            ].join(' ')}
          >
            <Card
              row={r}
              isActive={isActive}
              onToggleActive={() => onToggleProperty(isActive ? null : r.slug)}
              onOpenBookings={() => onOpenBookings(r.slug)}
              onOpenPayments={() => onOpenPayments(r.slug)}
            />
          </div>
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
}: {
  row: FuturePropertyData;
  isActive: boolean;
  onToggleActive: () => void;
  onOpenBookings: () => void;
  onOpenPayments: () => void;
}) {
  const totalUpcoming = row.pending_count + row.confirmed_count;
  const fullyPaid = row.outstanding_count === 0;

  return (
    <>
      <Header
        slug={row.slug}
        isActive={isActive}
        todayIndicator={row.today_indicator_status}
        onClick={onToggleActive}
      />

      <ClickableSection label="Bookings" onClick={onOpenBookings}>
        <Headline value={String(totalUpcoming)} />
        <Sub>
          {totalUpcoming === 0 ? (
            <span className="italic text-slate-400">no upcoming bookings</span>
          ) : (
            <BookingsBreakdown pending={row.pending_count} confirmed={row.confirmed_count} />
          )}
        </Sub>
      </ClickableSection>

      <ClickableSection label="Payments" onClick={onOpenPayments}>
        <Headline
          value={fullyPaid ? '—' : eur(row.outstanding_cents)}
          tone={fullyPaid ? 'muted' : 'amber'}
        />
        <Sub>
          {fullyPaid ? (
            <span className="italic text-slate-400">fully paid</span>
          ) : (
            <>
              outstanding · <span className="tabular-nums">{row.outstanding_count}</span>{' '}
              {row.outstanding_count === 1 ? 'booking' : 'bookings'}
            </>
          )}
        </Sub>
      </ClickableSection>

      <Section label="Today">
        <TodayContent row={row} />
      </Section>

      <Section label="Next check-in" last>
        <NextContent date={row.next_check_in} guest={row.next_check_in_guest} />
      </Section>
    </>
  );
}

// ----------------------------------------------------------------------------

function Header({
  slug,
  isActive,
  todayIndicator,
  onClick,
}: {
  slug: string;
  isActive: boolean;
  todayIndicator: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className="w-full text-left flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 hover:opacity-80 transition-opacity"
    >
      <h4 className={`text-base font-bold uppercase tracking-wider ${isActive ? 'text-ocean' : 'text-slate-900'}`}>
        {slug}
      </h4>
      {isActive ? (
        <span className="text-[9px] font-mono uppercase tracking-widest text-ocean">
          active
        </span>
      ) : (
        <TodayIndicator status={todayIndicator} />
      )}
    </button>
  );
}

function TodayIndicator({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-slate-400">
        <span className="w-2 h-2 rounded-full bg-slate-300" />
        available
      </span>
    );
  }
  const s = status as BookingStatus;
  const dot =
    s === 'request' ? 'bg-amber-400'
    : s === 'invite' ? 'bg-violet-400'
    : 'bg-ocean';
  return (
    <span className="inline-flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-slate-500">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {BOOKING_STATUS_STYLES[s]?.label ?? s}
    </span>
  );
}

function ClickableSection({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left mb-3 -mx-2 px-2 py-1 rounded-md hover:bg-slate-50 transition-colors group"
    >
      <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-400 mb-1 flex items-center gap-1">
        {label}
        <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </p>
      {children}
    </button>
  );
}

function Section({
  label,
  last,
  children,
}: {
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={last ? '' : 'mb-3'}>
      <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-400 mb-1">
        {label}
      </p>
      {children}
    </div>
  );
}

function Headline({
  value,
  tone = 'default',
}: {
  value: string;
  tone?: 'default' | 'amber' | 'muted';
}) {
  const cls =
    tone === 'amber' ? 'text-amber-700'
    : tone === 'muted' ? 'text-slate-300'
    : 'text-slate-900';
  return <p className={`text-2xl font-bold tabular-nums leading-none ${cls}`}>{value}</p>;
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-slate-500 mt-1">{children}</p>;
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

function TodayContent({ row }: { row: FuturePropertyData }) {
  if (!row.today_occupied || !row.today_status) {
    return <p className="text-[13px] text-slate-400 italic">available</p>;
  }
  const status = row.today_status as BookingStatus;
  const style = BOOKING_STATUS_STYLES[status];
  return (
    <div className="text-[13px] leading-snug">
      <p className="text-slate-700">
        <span className="font-bold">
          {row.today_guest_name ?? <span className="italic text-slate-400 font-normal">no guest</span>}
        </span>
        <span className={`text-[10px] font-mono uppercase tracking-widest ml-1.5 ${style.text}`}>
          {style.label}
        </span>
      </p>
      {row.today_check_out && (
        <p className="text-[11px] text-slate-400">until {fmtDate(row.today_check_out)}</p>
      )}
      <TodayPaymentLine
        agreed={row.today_agreed_cents}
        paid={row.today_paid_cents}
      />
    </div>
  );
}

function TodayPaymentLine({
  agreed,
  paid,
}: {
  agreed: number | null;
  paid: number | null;
}) {
  if (agreed == null) return null;
  const paidCents = paid ?? 0;
  const owed = Math.max(0, agreed - paidCents);

  if (owed === 0) {
    return (
      <p className="text-[11px] mt-1">
        <span className="text-ocean font-bold">Fully paid</span>
        <span className="text-slate-400"> · {eur(agreed)}</span>
      </p>
    );
  }
  if (paidCents === 0) {
    return (
      <p className="text-[11px] mt-1">
        <span className="text-amber-700 font-bold">Unpaid</span>
        <span className="text-slate-400"> · {eur(agreed)} due</span>
      </p>
    );
  }
  return (
    <p className="text-[11px] mt-1 tabular-nums">
      <span className="text-slate-600">{eur(paidCents)} paid</span>
      <span className="text-slate-300"> · </span>
      <span className="text-amber-700 font-bold">{eur(owed)} owed</span>
    </p>
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
