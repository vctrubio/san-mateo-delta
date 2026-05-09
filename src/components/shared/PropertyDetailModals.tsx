'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, ExternalLink } from 'lucide-react';
import Modal from '@/components/shared/Modal';
import { BOOKING_STATUS_STYLES, BLOCKING_BOOKING_STATUSES } from '@/lib/colors';
import { fmtDateRange } from '@/lib/dates';
import type { CalendarBooking, CalendarItem } from '@/lib/calendar';

// ============================================================================
// PropertyDetailModals — list views opened from the per-property strip card
// sections. Both wrap the shared <Modal> shell.
//
// Header: just the slug as the title and a small subtitle ("Upcoming
// bookings" / "Outstanding payments"). Below the header sits a 2-tab
// segmented control that slices the rows into bucket views — each tab
// shows its count and sum so you can size the pile before clicking in.
//
//   ┌─ LEVANTE ─────────────────────────── × ┐
//   │ Upcoming bookings                       │
//   ├─────────────────────────────────────────┤
//   │ ┌─ Confirmed ───┐  ┌─ To be confirmed ┐ │
//   │ │ 5 · €4,500    │  │ 3 · €2,700       │ │
//   │ └───────────────┘  └──────────────────┘ │
//   ├─────────────────────────────────────────┤
//   │ <booking rows for the active bucket>    │
//   └─────────────────────────────────────────┘
//
// Both modals are fed from `itemsBySlug` already on the page; no extra fetch.
// ============================================================================

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(cents / 100);
}

type Bucket = 'confirmed' | 'pending';

function isUpcomingNonCancelled(b: CalendarBooking): boolean {
  return b.status !== 'cancelled';
}

function isPending(b: CalendarBooking): boolean {
  return b.status === 'request' || b.status === 'invite';
}

function isConfirmedBucket(b: CalendarBooking): boolean {
  return BLOCKING_BOOKING_STATUSES.includes(b.status);
}

function bucketBookings(items: CalendarItem[]) {
  const bookings = items.filter(
    (it): it is CalendarBooking => it.kind === 'booking' && isUpcomingNonCancelled(it),
  );
  return {
    confirmed: bookings.filter(isConfirmedBucket).sort(byStartAsc),
    pending: bookings.filter(isPending).sort(byStartAsc),
  };
}

function sumAgreed(bs: CalendarBooking[]): number {
  return bs.reduce((s, b) => s + b.agreed_total_cents, 0);
}

function sumOwed(bs: CalendarBooking[]): number {
  return bs.reduce((s, b) => s + Math.max(0, b.agreed_total_cents - b.paid_cents), 0);
}

// ----------------------------------------------------------------------------
// Bookings list
// ----------------------------------------------------------------------------

export function BookingsListModal({
  slug,
  items,
  onClose,
}: {
  slug: string;
  items: CalendarItem[];
  onClose: () => void;
}) {
  const { confirmed, pending } = bucketBookings(items);
  const [bucket, setBucket] = useState<Bucket>(
    confirmed.length === 0 && pending.length > 0 ? 'pending' : 'confirmed',
  );
  const visible = bucket === 'confirmed' ? confirmed : pending;

  return (
    <Modal onClose={onClose}>
      <Shell slug={slug} subtitle="Upcoming bookings" onClose={onClose}>
        <BucketTabs
          active={bucket}
          onChange={setBucket}
          confirmedCount={confirmed.length}
          confirmedSum={sumAgreed(confirmed)}
          pendingCount={pending.length}
          pendingSum={sumAgreed(pending)}
        />
        <List
          rows={visible}
          renderRow={(b) => <BookingRow booking={b} />}
          rowKey={(b) => b.id}
          empty={`no ${bucket === 'confirmed' ? 'confirmed' : 'pending'} bookings`}
        />
      </Shell>
    </Modal>
  );
}

function BookingRow({ booking }: { booking: CalendarBooking }) {
  const style = BOOKING_STATUS_STYLES[booking.status];
  const body = (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50/70 hover:bg-slate-100 transition-colors">
      <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${style.chip}`}>
        {style.label}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-slate-800 font-bold truncate">
          {booking.user_name ?? <span className="italic text-slate-400 font-normal">no user</span>}
        </p>
        <p className="text-[11px] text-slate-500 tabular-nums truncate">
          {fmtDateRange(booking.start, booking.end)}
        </p>
      </div>
      <span className="text-[13px] font-bold tabular-nums text-slate-700 shrink-0">
        {eur(booking.agreed_total_cents)}
      </span>
      {booking.href && <ExternalLink className="w-3 h-3 text-slate-300 shrink-0" />}
    </div>
  );
  return booking.href
    ? <Link href={booking.href} className="block">{body}</Link>
    : body;
}

// ----------------------------------------------------------------------------
// Payments list
// ----------------------------------------------------------------------------

export function PaymentsListModal({
  slug,
  items,
  onClose,
}: {
  slug: string;
  items: CalendarItem[];
  onClose: () => void;
}) {
  const { confirmed, pending } = bucketBookings(items);
  const confirmedOwing = confirmed.filter(
    (b) => b.agreed_total_cents > b.paid_cents,
  );
  const pendingOwing = pending.filter(
    (b) => b.agreed_total_cents > b.paid_cents,
  );

  const [bucket, setBucket] = useState<Bucket>(
    confirmedOwing.length === 0 && pendingOwing.length > 0 ? 'pending' : 'confirmed',
  );
  const source = bucket === 'confirmed' ? confirmedOwing : pendingOwing;
  const visible = source
    .map((b) => ({ booking: b, owed: Math.max(0, b.agreed_total_cents - b.paid_cents) }))
    .sort((a, b) => b.owed - a.owed);

  return (
    <Modal onClose={onClose}>
      <Shell slug={slug} subtitle="Outstanding payments" onClose={onClose}>
        <BucketTabs
          active={bucket}
          onChange={setBucket}
          confirmedCount={confirmedOwing.length}
          confirmedSum={sumOwed(confirmedOwing)}
          pendingCount={pendingOwing.length}
          pendingSum={sumOwed(pendingOwing)}
        />
        <List
          rows={visible}
          renderRow={({ booking, owed }) => <PaymentRow booking={booking} owed={owed} />}
          rowKey={({ booking }) => booking.id}
          empty={bucket === 'confirmed' ? 'no confirmed bookings owe' : 'no pending bookings'}
        />
      </Shell>
    </Modal>
  );
}

function PaymentRow({ booking, owed }: { booking: CalendarBooking; owed: number }) {
  const style = BOOKING_STATUS_STYLES[booking.status];
  const body = (
    <div className="px-3 py-2.5 rounded-lg bg-slate-50/70 hover:bg-slate-100 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${style.chip}`}>
          {style.label}
        </span>
        <p className="text-[13px] text-slate-800 font-bold truncate flex-1">
          {booking.user_name ?? <span className="italic text-slate-400 font-normal">no user</span>}
        </p>
        <p className="text-[11px] text-slate-500 tabular-nums shrink-0 truncate">
          {fmtDateRange(booking.start, booking.end)}
        </p>
      </div>
      <div className="flex items-baseline justify-between gap-2 text-[11px] tabular-nums flex-wrap">
        <span className="text-slate-500">
          {eur(booking.paid_cents)} paid <span className="text-slate-300">of</span> {eur(booking.agreed_total_cents)}
        </span>
        <span className="text-amber-700 font-bold">{eur(owed)} owed</span>
      </div>
    </div>
  );
  return booking.href
    ? <Link href={booking.href} className="block">{body}</Link>
    : body;
}

// ----------------------------------------------------------------------------

function Shell({
  slug,
  subtitle,
  onClose,
  children,
}: {
  slug: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 w-full max-w-lg max-h-[85vh] flex flex-col">
      <header className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
        <div className="min-w-0">
          <h2 className="text-lg font-bold uppercase tracking-wider text-slate-900">{slug}</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </header>
      <div className="px-4 pt-4 pb-4 overflow-y-auto flex-1">
        {children}
      </div>
    </div>
  );
}

function BucketTabs({
  active,
  onChange,
  confirmedCount,
  confirmedSum,
  pendingCount,
  pendingSum,
}: {
  active: Bucket;
  onChange: (b: Bucket) => void;
  confirmedCount: number;
  confirmedSum: number;
  pendingCount: number;
  pendingSum: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-3">
      <Tab
        label="Confirmed"
        count={confirmedCount}
        sum={confirmedSum}
        active={active === 'confirmed'}
        onClick={() => onChange('confirmed')}
      />
      <Tab
        label="To be confirmed"
        count={pendingCount}
        sum={pendingSum}
        active={active === 'pending'}
        onClick={() => onChange('pending')}
      />
    </div>
  );
}

function Tab({
  label,
  count,
  sum,
  active,
  onClick,
}: {
  label: string;
  count: number;
  sum: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'rounded-lg px-3 py-2 text-left transition-colors',
        active
          ? 'bg-white shadow-sm ring-1 ring-slate-200'
          : 'text-slate-500 hover:text-slate-900',
      ].join(' ')}
    >
      <p className={`text-[10px] font-mono uppercase tracking-widest ${active ? 'text-slate-700' : 'text-slate-400'}`}>
        {label}
      </p>
      <p className={`text-sm tabular-nums ${active ? 'text-slate-900' : 'text-slate-500'}`}>
        <span className="font-bold">{count}</span>
        <span className="text-slate-300"> · </span>
        <span>{eur(sum)}</span>
      </p>
    </button>
  );
}

function List<T>({
  rows,
  renderRow,
  rowKey,
  empty,
}: {
  rows: T[];
  renderRow: (row: T) => React.ReactNode;
  rowKey: (row: T) => string;
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-[12px] text-slate-400 italic px-1 py-3">{empty}</p>;
  }
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => <li key={rowKey(r)}>{renderRow(r)}</li>)}
    </ul>
  );
}

function byStartAsc(a: CalendarBooking, b: CalendarBooking): number {
  return a.start.localeCompare(b.start);
}
