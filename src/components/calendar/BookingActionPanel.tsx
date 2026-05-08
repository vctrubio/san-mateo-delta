'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Loader2, X, ExternalLink, CalendarX } from 'lucide-react';
import { transitionStatus, cancelBooking } from '@/actions/bookings';
import { deleteBlock } from '@/actions/blocks';
import type { CalendarItem } from '@/lib/calendar';
import type { BookingStatus } from '@db/enums';
import { BOOKING_STATUS_STYLES, PROPERTY_BLOCK_STYLE } from '@/lib/colors';
import { fmtDateRange } from '@/lib/dates';

// ============================================================================
// Side-panel that opens when admin clicks an item in the admin calendar.
// - Booking item: shows summary + status-action buttons (confirm/check-in/
//   check-out/cancel) + a link to the full record at /admin/bookings/[id].
// - Block item: shows the dates + reason + a Remove block button.
// Always re-uses the same Server Actions (transitionStatus, cancelBooking,
// deleteBlock) so the action layer remains the single source of truth.
// ============================================================================

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const NEXT: Record<BookingStatus, Array<{ to: BookingStatus; label: string; tone: 'primary' | 'danger' }>> = {
  request:     [{ to: 'confirmed',   label: 'Confirm',   tone: 'primary' }, { to: 'cancelled', label: 'Cancel', tone: 'danger' }],
  invite:      [{ to: 'confirmed',   label: 'Confirm',   tone: 'primary' }, { to: 'cancelled', label: 'Cancel', tone: 'danger' }],
  confirmed:   [{ to: 'checked_in',  label: 'Check-in',  tone: 'primary' }, { to: 'cancelled', label: 'Cancel', tone: 'danger' }],
  checked_in:  [{ to: 'checked_out', label: 'Check-out', tone: 'primary' }],
  checked_out: [],
  cancelled:   [],
};

export type BookingActionPanelProps = {
  item: CalendarItem;
  onClose: () => void;
};

export default function BookingActionPanel({ item, onClose }: BookingActionPanelProps) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.18 }}
      className="rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 p-5 sticky top-4"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          {item.kind === 'booking' ? (
            <span
              className={`inline-block text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full ${BOOKING_STATUS_STYLES[item.status].chip}`}
            >
              {BOOKING_STATUS_STYLES[item.status].label}
            </span>
          ) : (
            <span className={`inline-block text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full ${PROPERTY_BLOCK_STYLE.chip}`}>
              {PROPERTY_BLOCK_STYLE.label}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {item.kind === 'booking' ? <BookingBody item={item} onClose={onClose} /> : <BlockBody item={item} onClose={onClose} />}
    </motion.aside>
  );
}

// ----------------------------------------------------------------------------
// BOOKING BODY
// ----------------------------------------------------------------------------

function BookingBody({ item, onClose }: { item: Extract<CalendarItem, { kind: 'booking' }>; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const next = NEXT[item.status];
  const remaining = item.agreed_total_cents - item.paid_cents;
  const fullyPaid = remaining <= 0;

  function transition(to: BookingStatus) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('booking_id', item.id);
      fd.set('to', to);
      try {
        await transitionStatus(fd);
        onClose();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Transition failed');
      }
    });
  }

  function cancel() {
    if (!confirm('Cancel this booking? The refund policy will run automatically.')) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('booking_id', item.id);
      fd.set('cancelled_by', 'admin');
      try {
        await cancelBooking(fd);
        onClose();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Cancel failed');
      }
    });
  }

  return (
    <>
      <h3 className="text-lg font-bold text-slate-900 leading-tight">
        {item.user_name ?? <span className="italic text-slate-400">No user (admin booking)</span>}
      </h3>
      {item.user_email && (
        <p className="text-[11px] font-mono text-slate-400">{item.user_email}</p>
      )}

      <dl className="mt-4 space-y-2 text-[12px]">
        <Row label="Dates">
          {fmtDateRange(item.start, item.end)}
        </Row>
        <Row label="Guests">
          {item.guests.adults}A
          {item.guests.children ? ` · ${item.guests.children}C` : ''}
          {item.guests.infants ? ` · ${item.guests.infants}I` : ''}
          {item.guests.pets ? ` · ${item.guests.pets}🐾` : ''}
        </Row>
        <Row label="Property">€{(item.agreed_property_cents / 100).toFixed(0)}</Row>
        <Row label="Cleaning">€{(item.agreed_cleaning_cents / 100).toFixed(0)}</Row>
        <Row label="Agreed total" emphasis>
          {eur(item.agreed_total_cents)}
        </Row>
        <Row label="Paid">
          <span className={fullyPaid ? 'text-emerald-700' : 'text-amber-700'}>
            {eur(item.paid_cents)}
          </span>
          {!fullyPaid && (
            <span className="text-slate-400 ml-1.5">· {eur(remaining)} remaining</span>
          )}
        </Row>
      </dl>

      {next.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-400">Actions</p>
          <div className="flex flex-wrap gap-2">
            {next.map(({ to, label, tone }) =>
              to === 'cancelled' ? (
                <button
                  key={to}
                  type="button"
                  onClick={cancel}
                  disabled={isPending}
                  className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-mono uppercase tracking-widest hover:border-rose-300 hover:text-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {label}
                </button>
              ) : (
                <button
                  key={to}
                  type="button"
                  onClick={() => transition(to)}
                  disabled={isPending}
                  className={
                    tone === 'primary'
                      ? 'px-3 py-2 rounded-lg bg-slate-900 text-white text-[11px] font-mono uppercase tracking-widest hover:bg-ocean transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5'
                      : 'px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-mono uppercase tracking-widest hover:border-slate-300 hover:text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  }
                >
                  {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  {label}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {next.length === 0 && (
        <p className="mt-5 text-[10px] font-mono text-slate-300 uppercase tracking-widest">terminal · no further actions</p>
      )}

      {item.href && (
        <Link
          href={item.href}
          className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-ocean hover:underline"
        >
          View full booking <ExternalLink className="w-3 h-3" />
        </Link>
      )}
    </>
  );
}

// ----------------------------------------------------------------------------
// BLOCK BODY
// ----------------------------------------------------------------------------

function BlockBody({ item, onClose }: { item: Extract<CalendarItem, { kind: 'block' }>; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!confirm('Remove this block? Dates will become available again.')) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('block_id', item.id);
      const result = await deleteBlock(fd);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <>
      <h3 className="text-lg font-bold text-slate-900 leading-tight">
        Property block
      </h3>
      <dl className="mt-4 space-y-2 text-[12px]">
        <Row label="Dates">
          {fmtDateRange(item.start, item.end)}
        </Row>
        <Row label="Reason">
          {item.reason ?? <span className="italic text-slate-400">none</span>}
        </Row>
      </dl>

      <div className="mt-5">
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-mono uppercase tracking-widest hover:border-rose-300 hover:text-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarX className="w-3.5 h-3.5" />}
          Remove block
        </button>
      </div>
    </>
  );
}

// ----------------------------------------------------------------------------

function Row({ label, children, emphasis }: { label: string; children: React.ReactNode; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-slate-50 pb-1.5 last:border-0">
      <dt className="text-[9px] font-mono uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className={emphasis ? 'text-sm font-bold text-slate-900 tabular-nums' : 'text-[12px] text-slate-700 tabular-nums'}>
        {children}
      </dd>
    </div>
  );
}
