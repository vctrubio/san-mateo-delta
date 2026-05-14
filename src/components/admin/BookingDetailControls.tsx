'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  LogIn,
  LogOut,
  XCircle,
  Wallet,
  UserPlus,
  Loader2,
  Search,
  ExternalLink,
  Undo2,
} from 'lucide-react';
import StatusBadge from '@/components/admin/StatusBadge';
import { fmtDateTime } from '@/lib/dates';
import {
  INPUT_CLASS,
  PickerTile,
  ErrorBanner,
  eur,
} from '@/components/shared/modalKit';
import {
  transitionStatus,
  cancelBooking,
  assignUserToBooking,
  updateBookingTime,
} from '@/actions/bookings';
import {
  registerCashPayment,
  refundStripePayment,
} from '@/actions/payments';
import type { BookingStatus } from '@db/enums';

// ============================================================================
// BookingDetailControls — client islands powering the /admin/bookings/[id]
// page. Each export is a focused interactive surface; the page server-renders
// the static stuff and lets these hydrate.
//
//   Transitions       — Confirm / Check-in / Check-out tiles + Cancel-with-reason
//   RegisterCashPayment — None / Pay remaining / Custom (morph) tiles + submit
//   PaymentRowAction   — per-payment "Refund full" (Stripe only)
//   AssignUserPicker   — search+pick UI for ghost bookings (user_id IS NULL)
//
// All four use the modalKit primitives so they read as the same family as
// BookingActionModal / SelectionActionModal (same PickerTile, eur, INPUT_CLASS,
// ErrorBanner). Same shape, different host.
// ============================================================================

// ─── BookingSummaryCard (the BOOKING card on the detail page) ──────────────
//
// Mirrors EstateOverview's Shell visuals on /admin: rounded-2xl, white,
// slate-100 border, p-5; eyebrow with icon top-left, status chip top-right
// (clickable), then content (children). When the chip is clicked, the card
// expands inline below the children to show transition tiles + cancel.
//
// Terminal statuses (cancelled, checked_out) render the chip plain — no
// chevron, no expansion.

export function BookingSummaryCard({
  bookingId, status, eyebrow, children,
}: {
  bookingId: string;
  status: BookingStatus;
  /** Top-left eyebrow content — e.g. <><Icon /> Booking</>. */
  eyebrow: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const interactive = status !== 'cancelled' && status !== 'checked_out';

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400">
          {eyebrow}
        </div>
        {interactive ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            title={open ? 'Close status actions' : 'Change status'}
            className="inline-flex items-center gap-1.5 rounded-full hover:opacity-80 transition cursor-pointer"
          >
            <StatusBadge status={status} />
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        ) : (
          <StatusBadge status={status} />
        )}
      </div>
      {children}
      {open && interactive && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <BookingTransitions bookingId={bookingId} status={status} />
        </div>
      )}
    </div>
  );
}

// ─── Transitions + Cancel ───────────────────────────────────────────────────

const STATUS_TRANSITIONS: Record<
  BookingStatus,
  Array<{ to: BookingStatus; label: string; icon: 'confirm' | 'in' | 'out' }>
> = {
  request:     [{ to: 'confirmed',   label: 'Confirm',   icon: 'confirm' }],
  invite:      [{ to: 'confirmed',   label: 'Confirm',   icon: 'confirm' }],
  confirmed:   [{ to: 'checked_in',  label: 'Check-in',  icon: 'in'      }],
  checked_in:  [{ to: 'checked_out', label: 'Check-out', icon: 'out'     }],
  checked_out: [],
  cancelled:   [],
};

export function BookingTransitions({
  bookingId, status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const transitions = STATUS_TRANSITIONS[status];
  const cancellable = status !== 'cancelled' && status !== 'checked_out';
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  function fire(to: BookingStatus) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('booking_id', bookingId);
      fd.set('to', to);
      try {
        await transitionStatus(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transition failed');
      }
    });
  }

  function fireCancel() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('booking_id', bookingId);
      fd.set('cancelled_by', 'admin');
      if (cancelReason.trim()) fd.set('reason', cancelReason.trim());
      try {
        await cancelBooking(fd);
        setCancelOpen(false);
        setCancelReason('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Cancel failed');
      }
    });
  }

  if (transitions.length === 0 && !cancellable) {
    return (
      <p className="text-xs font-mono uppercase tracking-widest text-slate-400">
        Terminal · no further actions
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {transitions.map((t) => (
          <PickerTile
            key={t.to}
            active={false}
            onClick={() => fire(t.to)}
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
            active={cancelOpen}
            onClick={() => setCancelOpen((v) => !v)}
            disabled={isPending}
            danger
            icon={<XCircle className="w-3.5 h-3.5" />}
            label="Cancel"
            sub={cancelOpen ? 'Add reason below' : 'Runs refund policy'}
          />
        )}
      </div>

      {cancelOpen && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/40 px-3 py-3 space-y-2">
          <label className="block">
            <span className="text-xs font-mono uppercase tracking-widest text-rose-700/70 mb-1 block">
              Reason (optional)
            </span>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              placeholder="Owner pulled the dates · guest no-show · …"
              className={`${INPUT_CLASS} resize-none`}
            />
          </label>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setCancelOpen(false); setCancelReason(''); }}
              className="px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-widest text-slate-500 hover:bg-slate-100"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={fireCancel}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-mono uppercase tracking-widest hover:bg-rose-700 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Cancel booking
            </button>
          </div>
        </div>
      )}

      {isPending && !cancelOpen && (
        <p className="text-xs text-slate-400 inline-flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Working…
        </p>
      )}
      {error && <ErrorBanner message={error} />}
    </div>
  );
}

// ─── Register cash payment ──────────────────────────────────────────────────

type PayChoice = 'none' | 'remaining' | 'custom';

export function RegisterCashPayment({
  bookingId, agreedCents, paidCents, status,
}: {
  bookingId: string;
  agreedCents: number;
  paidCents: number;
  status: BookingStatus;
}) {
  const remaining = Math.max(0, agreedCents - paidCents);
  const fullyPaid = remaining === 0;

  const [choice, setChoice] = useState<PayChoice>('none');
  const [customEuros, setCustomEuros] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (status === 'cancelled') {
    return (
      <p className="text-xs text-slate-400 italic">
        Cannot record new payments on a cancelled booking — the refund policy already settled.
      </p>
    );
  }
  if (fullyPaid) {
    return (
      <p className="text-xs text-emerald-700 inline-flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" /> Booking is fully paid.
      </p>
    );
  }

  const customCents = parseEur(customEuros);
  const amountCents = useMemo(() => {
    if (choice === 'remaining') return remaining;
    if (choice === 'custom') return customCents ?? 0;
    return 0;
  }, [choice, remaining, customCents]);

  const overflow = choice === 'custom' && customCents != null && customCents > remaining;
  const ready = !isPending && amountCents > 0 && !overflow;

  function submit() {
    if (!ready) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('booking_id', bookingId);
      fd.set('amount_cents', String(amountCents));
      fd.set('type', amountCents >= remaining ? 'balance' : 'deposit');
      const result = await registerCashPayment(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setChoice('none');
      setCustomEuros('');
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
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
          sub={eur(remaining)}
        />
        <CustomPaymentTile
          active={choice === 'custom'}
          onPick={() => setChoice('custom')}
          value={customEuros}
          onChange={setCustomEuros}
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
          {isPending
            ? 'Registering…'
            : amountCents > 0
              ? `Register ${eur(amountCents)}`
              : 'Enter an amount'}
        </button>
      )}

      {overflow && (
        <p className="text-xs text-rose-700">
          Amount exceeds outstanding balance ({eur(remaining)}).
        </p>
      )}

      {error && <ErrorBanner message={error} />}
    </div>
  );
}

function CustomPaymentTile({
  active, onPick, value, onChange,
}: {
  active: boolean;
  onPick: () => void;
  value: string;
  onChange: (v: string) => void;
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
          className="w-full max-w-[6.5rem] px-1.5 py-1 text-sm text-right tabular-nums focus:outline-none bg-transparent"
        />
      </span>
    </div>
  );
}

function parseEur(input: string): number | null {
  if (input.trim() === '') return null;
  const n = Math.round(parseFloat(input.replace(',', '.')) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ─── Per-payment row actions ────────────────────────────────────────────────

export function PaymentRowAction({
  paymentId, method, status, amountCents, refundedCents,
}: {
  paymentId: string;
  method: 'cash' | 'stripe' | string;
  status: 'pending' | 'succeeded' | 'failed' | string;
  amountCents: number;
  refundedCents: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function refundFull() {
    if (!confirm(`Refund the full ${eur(amountCents - refundedCents)} via Stripe?`)) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('payment_id', paymentId);
      try {
        await refundStripePayment(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Refund failed');
      }
    });
  }

  if (method === 'stripe' && status === 'succeeded' && amountCents > refundedCents) {
    return (
      <div className="flex items-center justify-end gap-2">
        {error && <span className="text-xs text-rose-700">{error}</span>}
        <button
          type="button"
          onClick={refundFull}
          disabled={isPending}
          className="px-2.5 py-1 text-xs font-mono uppercase tracking-widest rounded bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
          Refund full
        </button>
      </div>
    );
  }

  return null;
}

// ─── User picker for ghost bookings ─────────────────────────────────────────

export type AssignableUser = {
  id: string;
  name: string;
  email: string;
};

export function AssignUserPicker({
  bookingId, users,
}: {
  bookingId: string;
  users: AssignableUser[];
}) {
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users.slice(0, 6);
    return users
      .filter((u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, users]);

  function attach() {
    if (!pickedId) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('booking_id', bookingId);
      fd.set('user_id', pickedId);
      const result = await assignUserToBooking(fd);
      if (!result.ok) setError(result.error);
      else setPickedId(null);
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
      <div className="flex items-baseline gap-2">
        <UserPlus className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-xs font-mono uppercase tracking-widest text-slate-600 font-bold">
          Attach a user
        </p>
        <span className="text-xs text-slate-400">
          ghost booking · no user attached
        </span>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPickedId(null); }}
          placeholder="Search by name or email…"
          className={`${INPUT_CLASS} pl-9`}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-slate-400 italic px-1">
          No users match — refine the search or create one in <code className="font-mono">/admin/users</code>.
        </p>
      ) : (
        <ul className="space-y-1 max-h-[200px] overflow-y-auto">
          {filtered.map((u) => {
            const picked = pickedId === u.id;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setPickedId(picked ? null : u.id)}
                  className={[
                    'w-full text-left rounded-lg border px-3 py-2 transition flex items-baseline justify-between gap-3',
                    picked
                      ? 'border-ocean bg-white ring-2 ring-ocean/15'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  ].join(' ')}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900 truncate">{u.name}</span>
                    <span className="block text-xs font-mono text-slate-500 truncate">{u.email}</span>
                  </span>
                  {picked && (
                    <span className="text-xs font-mono uppercase tracking-widest text-ocean shrink-0">
                      selected
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {pickedId && (
        <button
          type="button"
          onClick={attach}
          disabled={isPending}
          className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold uppercase tracking-[0.2em] text-xs hover:bg-ocean transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
          {isPending ? 'Attaching…' : 'Attach this user'}
        </button>
      )}

      {error && <ErrorBanner message={error} />}
    </div>
  );
}

// ─── EditableTime — inline edit for time_check_in / time_check_out ──────────
//
// Display mode: stamped time (or "not yet" italic) + small "edit" affordance.
// Edit mode:    datetime-local input + Save / Clear / Cancel buttons.
// On save: posts to `updateBookingTime` action (clear = empty value → NULL).

export function EditableTime({
  bookingId, field, value,
}: {
  bookingId: string;
  field: 'check_in' | 'check_out';
  /** Current ISO timestamp from the DB, or null. */
  value: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(toLocalInputValue(value));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function open() {
    setDraft(toLocalInputValue(value));
    setEditing(true);
    setError(null);
  }

  function close() {
    setEditing(false);
    setError(null);
  }

  function submit(payloadValue: string) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('booking_id', bookingId);
      fd.set('field', field);
      fd.set('value', payloadValue);
      const result = await updateBookingTime(fd);
      if (!result.ok) setError(result.error);
      else close();
    });
  }

  if (!editing) {
    return (
      <div className="inline-flex items-baseline gap-2 min-w-0">
        {value ? (
          <span className="text-emerald-700 tabular-nums text-sm">
            {fmtDateTime(value)}
          </span>
        ) : (
          <span className="text-slate-400 italic text-sm">not yet</span>
        )}
        <button
          type="button"
          onClick={open}
          className="text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-ocean"
        >
          edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 items-end min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        <input
          type="datetime-local"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={`${INPUT_CLASS} max-w-[200px] py-1.5 text-xs`}
        />
        <button
          type="button"
          onClick={() => submit(draft)}
          disabled={isPending}
          className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-xs font-mono uppercase tracking-widest hover:bg-ocean disabled:opacity-50 inline-flex items-center gap-1"
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Save
        </button>
        {value && (
          <button
            type="button"
            onClick={() => submit('')}
            disabled={isPending}
            title="Clear stamp"
            className="px-2.5 py-1 rounded-md bg-white border border-rose-200 text-rose-700 text-xs font-mono uppercase tracking-widest hover:bg-rose-50 disabled:opacity-50"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={close}
          disabled={isPending}
          className="px-2.5 py-1 rounded-md text-slate-500 text-xs font-mono uppercase tracking-widest hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
      {error && <ErrorBanner message={error} />}
    </div>
  );
}

// datetime-local input wants local-time `YYYY-MM-DDTHH:MM` with no zone.
function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// ─── Tiny helper used by the page header ────────────────────────────────────

export function StripeLink({ intentId }: { intentId: string }) {
  return (
    <a
      href={`https://dashboard.stripe.com/test/payments/${intentId}`}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1 text-xs font-mono text-violet-700 hover:underline"
      title="Open in Stripe dashboard"
    >
      stripe <ExternalLink className="w-3 h-3" />
    </a>
  );
}
