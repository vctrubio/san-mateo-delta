'use client';

import Link from 'next/link';
import { X, ExternalLink, Inbox, CheckCircle2, Wallet } from 'lucide-react';
import Modal from '@/components/shared/Modal';
import { BOOKING_STATUS_STYLES, BLOCKING_BOOKING_STATUSES } from '@/lib/colors';
import { fmtDateRange } from '@/lib/dates';
import type { CalendarBooking, CalendarItem } from '@/lib/calendar';

// ============================================================================
// PropertyDetailModals — list views opened from PerPropertyFutureStrip card
// sections.
//
//   BookingsListModal   — upcoming non-cancelled bookings, grouped by status
//                         bucket (to confirm: request/invite vs confirmed:
//                         confirmed/checked_in/checked_out).
//   PaymentsListModal   — upcoming non-cancelled bookings with anything still
//                         owed, sorted by largest unpaid first.
//
// Both are fed from `itemsBySlug` already on the page (no extra fetch).
// ============================================================================

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(cents / 100);
}

function isUpcomingNonCancelled(b: CalendarBooking): boolean {
  return b.status !== 'cancelled';
}

function isPending(b: CalendarBooking): boolean {
  return b.status === 'request' || b.status === 'invite';
}

function isConfirmedBucket(b: CalendarBooking): boolean {
  return BLOCKING_BOOKING_STATUSES.includes(b.status);
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
  const bookings = items.filter(
    (it): it is CalendarBooking => it.kind === 'booking' && isUpcomingNonCancelled(it),
  );
  const pending = bookings.filter(isPending).sort(byStartAsc);
  const confirmed = bookings.filter(isConfirmedBucket).sort(byStartAsc);

  return (
    <Modal onClose={onClose}>
      <ModalShell
        slug={slug}
        title="Upcoming bookings"
        onClose={onClose}
      >
        {bookings.length === 0 ? (
          <p className="text-[12px] text-slate-400 italic px-1 py-3">no upcoming bookings</p>
        ) : (
          <>
            <Group
              icon={<Inbox className="w-3.5 h-3.5" />}
              label="To confirm"
              count={pending.length}
              bookings={pending}
            />
            <Group
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              label="Confirmed"
              count={confirmed.length}
              bookings={confirmed}
            />
          </>
        )}
      </ModalShell>
    </Modal>
  );
}

function Group({
  icon, label, count, bookings,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  bookings: CalendarBooking[];
}) {
  return (
    <section className="mb-4 last:mb-0">
      <header className="flex items-center gap-1.5 px-1 mb-2">
        <span className="text-slate-500">{icon}</span>
        <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-500">
          {label}
        </span>
        <span className="text-[10px] font-mono text-slate-300">{count}</span>
      </header>
      {bookings.length === 0 ? (
        <p className="text-[12px] text-slate-400 italic px-1">none</p>
      ) : (
        <ul className="space-y-1.5">
          {bookings.map((b) => <li key={b.id}><BookingRow booking={b} /></li>)}
        </ul>
      )}
    </section>
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
        <p className="text-[11px] text-slate-500 tabular-nums">
          {fmtDateRange(booking.start, booking.end)}
        </p>
      </div>
      <span className="text-[13px] font-bold tabular-nums text-slate-700 shrink-0">
        {eur(booking.agreed_total_cents)}
      </span>
      {booking.href && (
        <ExternalLink className="w-3 h-3 text-slate-300 shrink-0" />
      )}
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
  const owing = items
    .filter((it): it is CalendarBooking => it.kind === 'booking' && isUpcomingNonCancelled(it))
    .map((b) => ({
      booking: b,
      owed: Math.max(0, b.agreed_total_cents - b.paid_cents),
    }))
    .filter((row) => row.owed > 0)
    .sort((a, b) => b.owed - a.owed);

  const totalOwed = owing.reduce((sum, r) => sum + r.owed, 0);

  return (
    <Modal onClose={onClose}>
      <ModalShell
        slug={slug}
        title="Outstanding payments"
        onClose={onClose}
        eyebrow={
          owing.length > 0 ? (
            <span className="tabular-nums">
              {eur(totalOwed)} <span className="text-slate-400">across {owing.length}</span>
            </span>
          ) : null
        }
      >
        {owing.length === 0 ? (
          <p className="text-[12px] text-slate-400 italic px-1 py-3">all upcoming bookings are fully paid</p>
        ) : (
          <ul className="space-y-1.5">
            {owing.map(({ booking, owed }) => (
              <li key={booking.id}><PaymentRow booking={booking} owed={owed} /></li>
            ))}
          </ul>
        )}
      </ModalShell>
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
        <p className="text-[11px] text-slate-500 tabular-nums shrink-0">
          {fmtDateRange(booking.start, booking.end)}
        </p>
      </div>
      <div className="flex items-baseline justify-between gap-2 text-[11px] tabular-nums">
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

function ModalShell({
  slug,
  title,
  eyebrow,
  onClose,
  children,
}: {
  slug: string;
  title: string;
  eyebrow?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 w-full max-w-lg max-h-[85vh] flex flex-col">
      <header className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: `var(--color-property-${slug})` }}
            />
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400">
              {slug}
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {eyebrow && (
            <p className="text-[12px] text-slate-500 mt-0.5">{eyebrow}</p>
          )}
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
      <div className="overflow-y-auto p-4 flex-1">
        {children}
      </div>
    </div>
  );
}

function byStartAsc(a: CalendarBooking, b: CalendarBooking): number {
  return a.start.localeCompare(b.start);
}
