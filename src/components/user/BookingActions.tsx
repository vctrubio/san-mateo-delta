'use client';

import { useState, useTransition } from 'react';
import { CreditCard, Loader2, X, AlertTriangle, ChevronRight } from 'lucide-react';
import Modal from '@/components/shared/Modal';
import { createCheckoutSession } from '@/actions/checkout';
import { cancelBooking } from '@/actions/bookings';
import { computeRefund, DEFAULT_REFUND_POLICY } from '@/lib/refund';
import { eur } from '@/lib/format';
import { fmtDateRange } from '@/lib/dates';
import type { BookingRow } from '@/lib/bookings';
import { PROPERTY_LABELS, type PropertySlug } from '@/lib/colors';

// ============================================================================
// BookingActions — guest-side action footer for a single booking row in
// UserDashboard. Two affordances:
//
//   1. Pay outstanding (when owed > 0 and not cancelled) — pushes the guest
//      into Stripe Checkout with kind='balance'. The 14-day scheduled charge
//      isn't wired yet, so this is the manual path for the guest to settle.
//
//   2. Cancel (when status is request / confirmed) — opens a small modal
//      that previews the refund tier ("75% refund · ≥15 days before") so the
//      guest knows the outcome before they commit. Submits to cancelBooking
//      with cancelled_by='guest'.
//
// Terminal statuses (checked_in / checked_out / cancelled) get no actions —
// at that point everything goes through the host.
// ============================================================================

export default function BookingActions({ booking }: { booking: BookingRow }) {
  const owed = booking.agreed_total_cents - booking.paid_cents;
  const canPay = owed > 0 && booking.status !== 'cancelled' && booking.status !== 'checked_out';
  const canCancel = booking.status === 'request' || booking.status === 'confirmed' || booking.status === 'invite';

  const [payError, setPayError] = useState<string | null>(null);
  const [isPaying, startPay] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!canPay && !canCancel) return null;

  function payOutstanding() {
    setPayError(null);
    startPay(async () => {
      const result = await createCheckoutSession(booking.id, 'balance');
      if (!result.ok) {
        setPayError(result.error);
        return;
      }
      window.location.href = result.url;
    });
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {canPay && (
          <button
            type="button"
            onClick={payOutstanding}
            disabled={isPaying}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 text-white text-[10px] font-mono uppercase tracking-widest hover:bg-ocean transition disabled:opacity-50"
          >
            {isPaying ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
            Pay {eur(owed)} balance
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-slate-500 ring-1 ring-slate-200 text-[10px] font-mono uppercase tracking-widest hover:text-rose-700 hover:ring-rose-200 transition"
          >
            Cancel booking
          </button>
        )}
      </div>
      {payError && (
        <p className="text-[11px] text-rose-700 mt-1">{payError}</p>
      )}
      {cancelOpen && (
        <CancelDialog booking={booking} onClose={() => setCancelOpen(false)} />
      )}
    </>
  );
}

function CancelDialog({ booking, onClose }: { booking: BookingRow; onClose: () => void }) {
  const propLabel = PROPERTY_LABELS[booking.property_slug as PropertySlug] ?? booking.property_slug;
  const refund = computeRefund({
    agreedPropertyCents: booking.agreed_property_cents,
    agreedCleaningCents: booking.agreed_cleaning_cents,
    checkInDate: booking.date_check_in,
    policy: DEFAULT_REFUND_POLICY,
  });
  const actuallyRefundable = Math.min(refund.refundAmountCents, booking.paid_cents);

  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set('booking_id', booking.id);
    fd.set('cancelled_by', 'guest');
    if (reason.trim()) fd.set('reason', reason.trim());
    startTransition(async () => {
      try {
        await cancelBooking(fd);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not cancel.');
      }
    });
  }

  return (
    <Modal onClose={onClose}>
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 grid place-items-center w-8 h-8 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 mb-5">
          <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-rose-700">Cancel booking</p>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
              {propLabel}
            </h3>
            <p className="text-sm text-slate-600">{fmtDateRange(booking.date_check_in, booking.date_check_out)}</p>
          </div>
        </div>

        {/* Refund preview */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 mb-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Refund preview</p>
          <PreviewRow label="Booking total" value={eur(booking.agreed_total_cents)} />
          <PreviewRow label="Paid to date"  value={eur(booking.paid_cents)} />
          <PreviewRow label="Policy"        value={refund.policyApplied} />
          <div className="pt-2 mt-2 border-t border-slate-200">
            <PreviewRow
              label="Estimated refund"
              value={eur(actuallyRefundable)}
              highlight
            />
            {actuallyRefundable < refund.refundAmountCents && (
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Policy allows {eur(refund.refundAmountCents)}, capped at what you've actually paid.
              </p>
            )}
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
            Stripe refunds are issued by the host after cancellation. You'll see the refund on your dashboard once it's processed.
          </p>
        </div>

        <label className="block mb-4">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Reason (optional)
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Anything the host should know…"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean resize-none"
          />
        </label>

        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-900 mb-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 text-xs font-mono uppercase tracking-widest hover:bg-slate-50"
          >
            Keep booking
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 text-white text-xs font-mono uppercase tracking-widest font-bold hover:bg-rose-700 disabled:opacity-50 transition"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Cancel anyway
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PreviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-[11px] font-mono uppercase tracking-widest ${highlight ? 'text-slate-900' : 'text-slate-500'}`}>
        {label}
      </span>
      <span className={`tabular-nums ${highlight ? 'text-base font-bold text-emerald-700' : 'text-sm text-slate-700'}`}>
        {value}
      </span>
    </div>
  );
}
