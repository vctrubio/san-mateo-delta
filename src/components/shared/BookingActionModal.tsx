'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import {
  Loader2,
  ExternalLink,
  CalendarX,
  CheckCircle2,
  LogIn,
  LogOut,
  XCircle,
  Wallet,
} from 'lucide-react';
import Modal from '@/components/shared/Modal';
import {
  MODAL_CARD_CLASS,
  ModalHeader,
  Section,
  PickerTile,
  ErrorBanner,
  eur,
  relativeStayLabel,
} from '@/components/shared/modalKit';
import { transitionStatus, cancelBooking } from '@/actions/bookings';
import { deleteBlock } from '@/actions/blocks';
import { registerCashPayment } from '@/actions/payments';
import { BOOKING_STATUS_STYLES, PROPERTY_BLOCK_STYLE } from '@/lib/colors';
import { fmtDateRange, nightsBetween } from '@/lib/dates';
import type { CalendarItem, CalendarBooking, CalendarBlock } from '@/lib/calendar';
import type { BookingStatus } from '@db/enums';

// ============================================================================
// BookingActionModal — opens when admin clicks an existing booking or block
// on the calendar. Owns its Modal so it can be mounted directly (replaces
// the old BookingActionPanel + manual <Modal> wrapper pattern).
//
// Booking flavour:
//   ┌─ HEADER ────────────────── confirmed · LEVANTE ── × ┐
//   │ 10 → 24 Jun 2026 · 14n                              │
//   │ in 12 days                                          │
//   ├─────────────────────────────────────────────────────┤
//   │ GUEST   Camille Laurent · camille@fr.example        │
//   │ STAY    14 nights · 1A · 2🐾                         │
//   │ PRICING property 4620 · cleaning 90 · total 4710    │
//   │         paid 1413 · remaining 3297                  │
//   │ PAYMENT [None] [Pay remaining 3297] [Custom]        │
//   │         → Register button                           │
//   │ ACTIONS [Check-in]  [Cancel]                        │
//   └─────────────────────────────────────────────────────┘
//
// Block flavour: same shell but a single Reason section + a Remove-block
// action.
// ============================================================================

const STATUS_TRANSITIONS: Record<BookingStatus, Array<{ to: BookingStatus; label: string; icon: 'confirm' | 'in' | 'out' }>> = {
  request:     [{ to: 'confirmed',   label: 'Confirm',   icon: 'confirm' }],
  invite:      [{ to: 'confirmed',   label: 'Confirm',   icon: 'confirm' }],
  confirmed:   [{ to: 'checked_in',  label: 'Check-in',  icon: 'in' }],
  checked_in:  [{ to: 'checked_out', label: 'Check-out', icon: 'out' }],
  checked_out: [],
  cancelled:   [],
};

export type BookingActionModalProps = {
  item: CalendarItem;
  onClose: () => void;
};

export default function BookingActionModal({ item, onClose }: BookingActionModalProps) {
  return (
    <Modal onClose={onClose}>
      <div className={MODAL_CARD_CLASS}>
        {item.kind === 'booking'
          ? <BookingShell item={item} onClose={onClose} />
          : <BlockShell  item={item} onClose={onClose} />}
      </div>
    </Modal>
  );
}

// ─── Booking ────────────────────────────────────────────────────────────────

function BookingShell({
  item, onClose,
}: {
  item: CalendarBooking;
  onClose: () => void;
}) {
  const nights = nightsBetween(item.start, item.end);
  const remaining = Math.max(0, item.agreed_total_cents - item.paid_cents);
  const fullyPaid = remaining === 0;
  const status = item.status;
  const transitions = STATUS_TRANSITIONS[status];
  const cancellable = status !== 'cancelled' && status !== 'checked_out';
  const statusStyle = BOOKING_STATUS_STYLES[status];

  return (
    <>
      <ModalHeader
        eyebrow={statusStyle.label}
        eyebrowAccent={item.property_slug.toUpperCase()}
        title={fmtDateRange(item.start, item.end) + ` · ${nights}n`}
        sub={relativeStayLabel(item.start, item.end)}
        onClose={onClose}
      />

      <div className="px-5 py-2 overflow-y-auto flex-1 divide-y divide-slate-100">
        {/* ─ Guest ─ */}
        <Section label="Guest">
          <p className="text-base font-bold text-slate-900 leading-tight">
            {item.user_name ?? <span className="italic text-slate-400 font-normal">No user · admin booking</span>}
          </p>
          {item.user_email && (
            <p className="text-xs font-mono text-slate-500 mt-0.5">{item.user_email}</p>
          )}
          <p className="text-xs text-slate-500 mt-2 tabular-nums">
            {item.guests.adults}A
            {item.guests.children ? ` · ${item.guests.children}C` : ''}
            {item.guests.infants ? ` · ${item.guests.infants}I` : ''}
            {item.guests.pets ? ` · ${item.guests.pets}🐾` : ''}
          </p>
        </Section>

        {/* ─ Pricing ─ */}
        <Section
          label="Pricing"
          hint={fullyPaid ? 'fully paid' : `${eur(remaining)} owed`}
        >
          <dl className="space-y-1 text-sm">
            <Row label="Property" value={eur(item.agreed_property_cents)} />
            <Row label="Cleaning" value={eur(item.agreed_cleaning_cents)} />
          </dl>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-baseline justify-between">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500">Total</span>
            <span className="text-lg font-bold text-slate-900 tabular-nums">
              {eur(item.agreed_total_cents)}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between text-xs tabular-nums">
            <span className="font-mono uppercase tracking-widest text-slate-400">Paid</span>
            <span>
              <span className={fullyPaid ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                {eur(item.paid_cents)}
              </span>
              {!fullyPaid && (
                <span className="text-slate-400 ml-1.5">· {eur(remaining)} remaining</span>
              )}
            </span>
          </div>
        </Section>

        {/* ─ Register cash payment ─ only when there's an outstanding balance
            and the booking isn't cancelled. Cancelled bookings shouldn't
            accept new money. */}
        {!fullyPaid && status !== 'cancelled' && (
          <PaymentSection
            bookingId={item.id}
            remainingCents={remaining}
            totalCents={item.agreed_total_cents}
            onSuccess={onClose}
          />
        )}

        {/* ─ Actions ─ */}
        {(transitions.length > 0 || cancellable) && (
          <Section label="Actions">
            <ActionsRow
              bookingId={item.id}
              transitions={transitions}
              cancellable={cancellable}
              onSuccess={onClose}
            />
          </Section>
        )}
        {transitions.length === 0 && !cancellable && (
          <Section label="Actions">
            <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
              Terminal · no further actions
            </p>
          </Section>
        )}
      </div>

      {item.href && (
        <div className="px-5 py-3 border-t border-slate-100">
          <Link
            href={item.href}
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-ocean hover:underline"
          >
            View full booking <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}
    </>
  );
}

// ─── Actions row — fires server actions on tile click ───────────────────────

function ActionsRow({
  bookingId, transitions, cancellable, onSuccess,
}: {
  bookingId: string;
  transitions: { to: BookingStatus; label: string; icon: 'confirm' | 'in' | 'out' }[];
  cancellable: boolean;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function transition(to: BookingStatus) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('booking_id', bookingId);
      fd.set('to', to);
      try {
        await transitionStatus(fd);
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transition failed');
      }
    });
  }

  function cancel() {
    if (!confirm('Cancel this booking? The refund policy will run automatically.')) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('booking_id', bookingId);
      fd.set('cancelled_by', 'admin');
      try {
        await cancelBooking(fd);
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Cancel failed');
      }
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {transitions.map((t) => (
          <PickerTile
            key={t.to}
            active={false}
            onClick={() => transition(t.to)}
            disabled={isPending}
            icon={
              t.icon === 'confirm' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
              t.icon === 'in'      ? <LogIn className="w-3.5 h-3.5" /> :
                                     <LogOut className="w-3.5 h-3.5" />
            }
            label={t.label}
            sub="Click to fire"
          />
        ))}
        {cancellable && (
          <PickerTile
            active={false}
            onClick={cancel}
            disabled={isPending}
            danger
            icon={<XCircle className="w-3.5 h-3.5" />}
            label="Cancel"
            sub="Runs refund policy"
          />
        )}
      </div>
      {isPending && (
        <p className="text-xs text-slate-400 mt-2 inline-flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Working…
        </p>
      )}
      {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
    </>
  );
}

// ─── Payment section — register cash received ──────────────────────────────

type PayChoice = 'none' | 'remaining' | 'custom';

function PaymentSection({
  bookingId, remainingCents, totalCents, onSuccess,
}: {
  bookingId: string;
  remainingCents: number;
  totalCents: number;
  onSuccess: () => void;
}) {
  const [choice, setChoice] = useState<PayChoice>('none');
  const [customEuros, setCustomEuros] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const customCents = parseEur(customEuros);
  const amountCents = useMemo(() => {
    if (choice === 'remaining') return remainingCents;
    if (choice === 'custom') return customCents ?? 0;
    return 0;
  }, [choice, remainingCents, customCents]);

  const ready = !isPending && amountCents > 0 && amountCents <= remainingCents;

  function submit() {
    if (!ready) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('booking_id', bookingId);
      fd.set('amount_cents', String(amountCents));
      // Full balance → 'balance', anything less → 'deposit'.
      fd.set('type', amountCents >= remainingCents ? 'balance' : 'deposit');
      const result = await registerCashPayment(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess();
    });
  }

  return (
    <Section
      label="Register cash payment"
      hint={amountCents > 0 ? `${eur(amountCents)} · cash` : 'none'}
    >
      <div className="grid grid-cols-2 gap-2 mb-3">
        <PickerTile
          active={choice === 'none'}
          onClick={() => setChoice('none')}
          label="None"
          sub="Skip"
        />
        <PickerTile
          active={choice === 'remaining'}
          onClick={() => setChoice('remaining')}
          icon={<Wallet className="w-3.5 h-3.5" />}
          label="Pay remaining"
          sub={`${eur(remainingCents)} of ${eur(totalCents)}`}
        />
        <CustomTile
          active={choice === 'custom'}
          onPick={() => setChoice('custom')}
          value={customEuros}
          onChange={setCustomEuros}
          maxCents={remainingCents}
        />
      </div>

      {choice !== 'none' && (
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold uppercase tracking-[0.2em] text-xs hover:bg-ocean transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
          {isPending ? 'Registering…' : `Register ${eur(amountCents)}`}
        </button>
      )}

      {choice === 'custom' && customCents != null && customCents > remainingCents && (
        <p className="text-xs text-rose-700 mt-2">
          Amount exceeds outstanding balance ({eur(remainingCents)}).
        </p>
      )}

      {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
    </Section>
  );
}

function CustomTile({
  active, onPick, value, onChange,
}: {
  active: boolean;
  onPick: () => void;
  value: string;
  onChange: (v: string) => void;
  maxCents: number;
}) {
  if (!active) {
    return (
      <PickerTile
        active={false}
        onClick={onPick}
        label="Custom"
        sub="Enter amount"
      />
    );
  }
  return (
    <div className="rounded-xl border-ocean ring-2 ring-ocean/15 border bg-white px-3 py-2.5">
      <span className="block text-sm font-bold text-slate-900 mb-1">Custom</span>
      <span className="inline-flex items-center bg-white rounded-md border border-slate-200 focus-within:ring-2 focus-within:ring-ocean/30 focus-within:border-ocean">
        <span className="px-1.5 text-slate-400 text-sm">€</span>
        <input
          type="number"
          step={1}
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
          placeholder="0"
          className="w-full max-w-[7rem] px-1.5 py-1 text-sm text-right tabular-nums focus:outline-none bg-transparent"
        />
      </span>
    </div>
  );
}

// ─── Block ──────────────────────────────────────────────────────────────────

function BlockShell({
  item, onClose,
}: {
  item: CalendarBlock;
  onClose: () => void;
}) {
  const nights = nightsBetween(item.start, item.end);
  return (
    <>
      <ModalHeader
        eyebrow={PROPERTY_BLOCK_STYLE.label}
        eyebrowAccent={item.property_slug.toUpperCase()}
        title={fmtDateRange(item.start, item.end) + ` · ${nights}n`}
        sub={relativeStayLabel(item.start, item.end)}
        onClose={onClose}
      />

      <div className="px-5 py-2 overflow-y-auto flex-1 divide-y divide-slate-100">
        <Section label="Reason">
          <p className="text-sm text-slate-700">
            {item.reason ?? <span className="italic text-slate-400">none</span>}
          </p>
        </Section>

        <Section label="Actions">
          <RemoveBlockButton blockId={item.id} onSuccess={onClose} />
        </Section>
      </div>
    </>
  );
}

function RemoveBlockButton({
  blockId, onSuccess,
}: {
  blockId: string;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm('Remove this block? Dates will become available again.')) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('block_id', blockId);
      const result = await deleteBlock(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess();
    });
  }

  return (
    <>
      <PickerTile
        active={false}
        onClick={remove}
        disabled={isPending}
        danger
        icon={<CalendarX className="w-3.5 h-3.5" />}
        label="Remove block"
        sub="Frees the dates"
      />
      {isPending && (
        <p className="text-xs text-slate-400 mt-2 inline-flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Removing…
        </p>
      )}
      {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
    </>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-xs">
      <dt className="font-mono uppercase tracking-widest text-slate-400 text-xs">{label}</dt>
      <dd className="text-slate-700 tabular-nums">{value}</dd>
    </div>
  );
}

function parseEur(input: string): number | null {
  if (input.trim() === '') return null;
  const n = Math.round(parseFloat(input.replace(',', '.')) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
