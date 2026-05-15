'use client';

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import {
  CalendarX,
  CalendarPlus,
  Loader2,
  UserPlus,
  UserX,
} from 'lucide-react';
import Modal from '@/components/shared/Modal';
import {
  MODAL_CARD_CLASS,
  INPUT_CLASS,
  ModalHeader,
  Section,
  Field,
  PickerTile,
  DiffStrip,
  ErrorBanner,
  eur,
} from '@/components/shared/modalKit';
import { createBlock } from '@/actions/blocks';
import { createAdminBooking } from '@/actions/bookings';
import { previewQuote } from '@/actions/bookings';
import { ymd } from '@/components/calendar/dateUtils';
import { fmtDate, fmtDateRange, nightsBetween } from '@/lib/dates';
import type { Quote } from '@/lib/bookings';
import {
  PAYMENT_PRESETS,
  resolvePolicy,
  computeDepositCents,
  type PaymentPolicyKey,
} from '@/lib/payment';
import { todayYmd } from '@/lib/dates';
import PaymentPolicyPresetPicker from '@/components/admin/PaymentPolicyPresetPicker';
import fincaData from '@config/finca.json';

// ============================================================================
// SelectionActionModal — opens after the admin completes a date range on the
// admin calendar. Replaces the old dark BlockConfirmBar with a chooser-first
// modal flow:
//
//   ┌─ Chooser ─────────────────────────────────┐
//   │ SELECTED · Jul 7 → Jul 11 · 4n · LEVANTE  │
//   │  [ BLOCK DATES ]  [ CREATE BOOKING ]      │
//   └───────────────────────────────────────────┘
//                ↓                    ↓
//           Block view           Booking view
//          (createBlock)      (createAdminBooking)
//
// Both inner views are sub-components in this file so the entire selection
// flow lives in one place — same pattern as PropertyDetailModals.tsx.
//
// Booking view supports both invite (status='invite', requires user) and
// direct confirm (status='confirmed', user optional → ghost bookings),
// with optional time_check_in/out and optional initial cash payment.
// ============================================================================

export type SelectionUserOption = { id: string; name: string; email: string };

export type SelectionActionModalProps = {
  slug: string;
  propertyLabel: string;
  propertyMaxGuests: number;
  start: Date;
  end: Date;
  users: SelectionUserOption[];
  /** Active estate-wide policy — preselected in the per-booking preset picker. */
  defaultPaymentPolicyKey: PaymentPolicyKey;
  onClose: () => void;
  /** Fired after a successful action so the parent can clear the selection. */
  onSuccess: () => void;
};

type Mode = 'chooser' | 'block' | 'booking';

export default function SelectionActionModal({
  slug,
  propertyLabel,
  propertyMaxGuests,
  start,
  end,
  users,
  defaultPaymentPolicyKey,
  onClose,
  onSuccess,
}: SelectionActionModalProps) {
  const [mode, setMode] = useState<Mode>('chooser');
  const nights = nightsBetween(start, end);

  return (
    <Modal onClose={onClose}>
      <div className={MODAL_CARD_CLASS}>
        <ModalHeader
          eyebrow={mode === 'chooser' ? 'Selected' : mode === 'block' ? 'Block dates' : 'New booking'}
          eyebrowAccent={propertyLabel}
          title={
            <>
              {fmtDateRange(start, end)}
              <span className="text-slate-400 font-mono text-xs ml-2 tracking-widest uppercase">
                · {nights}n
              </span>
            </>
          }
          onClose={onClose}
          onBack={mode !== 'chooser' ? () => setMode('chooser') : undefined}
        />

        <div className="px-5 py-5 overflow-y-auto flex-1">
          {mode === 'chooser' && (
            <ChooserView
              onPickBlock={() => setMode('block')}
              onPickBooking={() => setMode('booking')}
            />
          )}
          {mode === 'block' && (
            <BlockView
              slug={slug}
              start={start}
              end={end}
              nights={nights}
              onSuccess={() => { onSuccess(); onClose(); }}
            />
          )}
          {mode === 'booking' && (
            <BookingView
              slug={slug}
              start={start}
              end={end}
              nights={nights}
              propertyMaxGuests={propertyMaxGuests}
              users={users}
              defaultPaymentPolicyKey={defaultPaymentPolicyKey}
              onSuccess={() => { onSuccess(); onClose(); }}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Chooser ────────────────────────────────────────────────────────────────

function ChooserView({
  onPickBlock,
  onPickBooking,
}: {
  onPickBlock: () => void;
  onPickBooking: () => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <ChoiceCard
        icon={<CalendarX className="w-5 h-5" />}
        title="Block dates"
        sub="Owner stay · maintenance · pause listing"
        tone="slate"
        onClick={onPickBlock}
      />
      <ChoiceCard
        icon={<CalendarPlus className="w-5 h-5" />}
        title="Create booking"
        sub="Invite a guest or confirm directly"
        tone="ocean"
        onClick={onPickBooking}
      />
    </div>
  );
}

function ChoiceCard({
  icon, title, sub, tone, onClick,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  tone: 'slate' | 'ocean';
  onClick: () => void;
}) {
  const toneClass = tone === 'ocean'
    ? 'border-ocean/30 hover:border-ocean hover:bg-ocean/5 text-ocean'
    : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-700';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl border-2 px-5 py-6 transition-colors ${toneClass}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-bold uppercase tracking-widest">{title}</h3>
      </div>
      <p className="text-xs text-slate-500 leading-snug">{sub}</p>
    </button>
  );
}

// ─── Block view ─────────────────────────────────────────────────────────────

function BlockView({
  slug, start, end, nights, onSuccess,
}: {
  slug: string;
  start: Date;
  end: Date;
  nights: number;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('slug', slug);
      fd.set('date_check_in', ymd(start));
      fd.set('date_check_out', ymd(end));
      if (reason.trim()) fd.set('reason', reason.trim());
      const result = await createBlock(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess();
    });
  }

  return (
    <div className="space-y-4">
      <Section label="Reason" hint="optional">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Owner stay · Maintenance · Pause listing"
          className={INPUT_CLASS}
        />
      </Section>

      {error && <ErrorBanner message={error} />}

      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold uppercase tracking-[0.2em] text-xs hover:bg-ocean transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarX className="w-4 h-4" />}
        {isPending ? 'Blocking…' : `Block ${nights} night${nights === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}

// ─── Booking view ───────────────────────────────────────────────────────────

type PaymentChoice = 'none' | 'deposit' | 'full' | 'custom';

function BookingView({
  slug, start, end, nights, propertyMaxGuests, users, defaultPaymentPolicyKey, onSuccess,
}: {
  slug: string;
  start: Date;
  end: Date;
  nights: number;
  propertyMaxGuests: number;
  users: SelectionUserOption[];
  defaultPaymentPolicyKey: PaymentPolicyKey;
  onSuccess: () => void;
}) {
  // Payment policy for THIS booking. Preselected to the estate-wide active
  // key but admin can override here without changing the estate default.
  // The picker shows a too-close caption when the policy will collapse on
  // submit; the resolved policy is what `createAdminBooking` snapshots.
  const [paymentPolicyKey, setPaymentPolicyKey] = useState<PaymentPolicyKey>(defaultPaymentPolicyKey);
  const policy = PAYMENT_PRESETS[paymentPolicyKey].policy;
  const resolvedPolicy = resolvePolicy(policy, ymd(start), todayYmd());
  const [withUser, setWithUser] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const [propertyEuros, setPropertyEuros] = useState('');
  const [cleaningEuros, setCleaningEuros] = useState('');
  const [touchedPricing, setTouchedPricing] = useState(false);

  const [defaultQuote, setDefaultQuote] = useState<Quote | null>(null);
  const [defaultError, setDefaultError] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);

  // 'invite' is unavailable without a user (you can't invite a ghost).
  const [statusChoice, setStatusChoice] = useState<'invite' | 'confirmed'>('confirmed');
  useEffect(() => { if (!withUser) setStatusChoice('confirmed'); }, [withUser]);

  // Defaults come from finca.json so the estate's check-in / check-out
  // policy lives in one place — admin form, guest-facing copy, and the
  // booking detail page all read from the same source.
  const [checkInTime, setCheckInTime] = useState(fincaData.check_in_time);
  const [checkOutTime, setCheckOutTime] = useState(fincaData.check_out_time);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('none');
  const [customPaymentEuros, setCustomPaymentEuros] = useState('');

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ─── Quote on mount ───
  useEffect(() => {
    let cancelled = false;
    setIsQuoting(true);
    setDefaultError(null);
    previewQuote({
      slug,
      check_in: ymd(start),
      check_out: ymd(end),
    }).then((res) => {
      if (cancelled) return;
      setIsQuoting(false);
      if (res.ok) {
        setDefaultQuote(res.quote);
        if (!touchedPricing) {
          setPropertyEuros(eurInputVal(res.quote.agreed_property_cents));
          setCleaningEuros(eurInputVal(res.quote.agreed_cleaning_cents));
        }
      } else {
        setDefaultQuote(null);
        setDefaultError(res.error);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, start.getTime(), end.getTime()]);

  // ─── Derived ───
  const customPropertyCents = parseEur(propertyEuros);
  const customCleaningCents = parseEur(cleaningEuros);
  const customTotalCents =
    customPropertyCents != null && customCleaningCents != null
      ? customPropertyCents + customCleaningCents
      : null;
  const defaultTotalCents = defaultQuote?.agreed_total_cents ?? null;
  const diffCents =
    customTotalCents != null && defaultTotalCents != null
      ? customTotalCents - defaultTotalCents
      : null;
  const diffPct =
    diffCents != null && defaultTotalCents && defaultTotalCents > 0
      ? Math.round((diffCents / defaultTotalCents) * 100)
      : 0;

  const paymentAmountCents = useMemo(() => {
    if (paymentChoice === 'none' || customTotalCents == null) return 0;
    if (paymentChoice === 'full') return customTotalCents;
    if (paymentChoice === 'deposit') return computeDepositCents(customTotalCents, resolvedPolicy.effective);
    const v = parseEur(customPaymentEuros);
    return v ?? 0;
  }, [paymentChoice, customTotalCents, customPaymentEuros, resolvedPolicy.effective]);

  const totalGuests = adults + children;
  const overCapacity = totalGuests > propertyMaxGuests;

  const ready =
    !isPending &&
    customPropertyCents != null && customCleaningCents != null &&
    !overCapacity &&
    (!withUser || (email.trim() && name.trim())) &&
    // Custom-payment input must have a positive value when shown — but the
    // payment section is hidden on invite, so don't gate on it then.
    (statusChoice !== 'confirmed' || paymentChoice !== 'custom' || (parseEur(customPaymentEuros) ?? 0) > 0);

  // ─── Email autocomplete — autofill name when an existing user matches. ───
  function onEmailChange(v: string) {
    setEmail(v);
    if (!name) {
      const match = users.find((u) => u.email.toLowerCase() === v.trim().toLowerCase());
      if (match) setName(match.name);
    }
  }

  function submit() {
    setSubmitError(null);
    if (!ready) return;
    if (customPropertyCents == null || customCleaningCents == null) return;

    const fd = new FormData();
    fd.set('slug', slug);
    fd.set('check_in', ymd(start));
    fd.set('check_out', ymd(end));
    fd.set('agreed_property_cents', String(customPropertyCents));
    fd.set('agreed_cleaning_cents', String(customCleaningCents));
    fd.set('status', statusChoice);
    fd.set('adults', String(adults));
    fd.set('children', String(children));
    if (withUser) {
      fd.set('email', email.trim());
      fd.set('name', name.trim());
    }
    if (checkInTime) {
      fd.set('time_check_in', combineDateTime(start, checkInTime));
    }
    if (checkOutTime) {
      fd.set('time_check_out', combineDateTime(end, checkOutTime));
    }
    // Payment policy for this booking — server resolves it again against
    // the check-in date and snapshots the result onto bookings.payment_policy.
    fd.set('payment_policy_key', paymentPolicyKey);

    // Payment only flows to the action when the booking is being confirmed —
    // an invite hasn't been accepted yet, so there's nothing to charge for.
    // (UI also hides the payment section on invite, but the state may still
    // hold a stale choice from a prior toggle.)
    if (statusChoice === 'confirmed' && paymentAmountCents > 0) {
      fd.set('payment_amount_cents', String(paymentAmountCents));
      // Full payment → 'balance', anything less → 'deposit'.
      const type = customTotalCents != null && paymentAmountCents >= customTotalCents
        ? 'balance' : 'deposit';
      fd.set('payment_type', type);
    }

    startTransition(async () => {
      const result = await createAdminBooking(fd);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      onSuccess();
    });
  }

  // Sections render in order: Guest → Pricing → Check-in/out → Payment (only
  // when status='confirmed' — invite has nothing to charge for yet) → Status.
  // Status is last because it's the final gate before submit.

  return (
    <div className="divide-y divide-slate-100">
      {/* ─ Guest ─ guest mode + identity + party. Single section since they
          all answer the same question: who's this booking for? */}
      <Section label="Guest" hint={`sleeps ${propertyMaxGuests}`}>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <PickerTile
            active={withUser}
            onClick={() => setWithUser(true)}
            icon={<UserPlus className="w-3.5 h-3.5" />}
            label="With guest"
            sub="Email + name"
          />
          <PickerTile
            active={!withUser}
            onClick={() => setWithUser(false)}
            icon={<UserX className="w-3.5 h-3.5" />}
            label="No guest"
            sub="Admin hold"
          />
        </div>
        {withUser ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <Field label="Email *">
              <input
                type="email"
                required
                list="selection-modal-emails"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                autoComplete="off"
                className={INPUT_CLASS}
              />
              <datalist id="selection-modal-emails">
                {users.map((u) => (
                  <option key={u.id} value={u.email}>{u.name}</option>
                ))}
              </datalist>
            </Field>
            <Field label="Name *">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic mb-4">
            Holds the dates with no user. Attach a guest later from the
            booking detail page.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Adults">
            <input
              type="number" min={1} max={propertyMaxGuests} value={adults}
              onChange={(e) => setAdults(parseInt(e.target.value, 10) || 1)}
              className={INPUT_CLASS + ' tabular-nums'}
            />
          </Field>
          <Field label="Children">
            <input
              type="number" min={0} max={propertyMaxGuests} value={children}
              onChange={(e) => setChildren(parseInt(e.target.value, 10) || 0)}
              className={INPUT_CLASS + ' tabular-nums'}
            />
          </Field>
        </div>
        {overCapacity && (
          <p className="text-xs text-rose-700 mt-2">
            Sleeps {propertyMaxGuests}; party of {totalGuests} exceeds it.
          </p>
        )}
      </Section>

      {/* ─ Pricing ─ */}
      <Section
        label="Pricing"
        hint={isQuoting ? 'computing default…' : defaultError ? 'no default rate' : undefined}
      >
        <div className="space-y-1">
          <EurField
            label={`Property fee${nights > 0 && customPropertyCents != null ? ` · ${eur(Math.round(customPropertyCents / nights))}/night` : ''}`}
            value={propertyEuros}
            onChange={(v) => { setPropertyEuros(v); setTouchedPricing(true); }}
            defaultCents={defaultQuote?.agreed_property_cents}
          />
          <EurField
            label="Cleaning fee"
            value={cleaningEuros}
            onChange={(v) => { setCleaningEuros(v); setTouchedPricing(true); }}
            defaultCents={defaultQuote?.agreed_cleaning_cents}
          />
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-baseline justify-between">
          <span className="text-xs font-mono uppercase tracking-widest text-slate-500">Total</span>
          <div className="text-right">
            <p className="text-xl font-bold text-slate-900 tabular-nums leading-none">
              {customTotalCents != null ? eur(customTotalCents) : '—'}
            </p>
            {defaultQuote && (
              <p className="text-xs text-slate-400 tabular-nums mt-1">
                default {eur(defaultQuote.agreed_total_cents)}
              </p>
            )}
          </div>
        </div>
        {defaultError && (
          <p className="text-xs text-amber-700 italic mt-2">{defaultError}</p>
        )}
        {defaultQuote && diffCents != null && diffCents !== 0 && (
          <div className="mt-3">
            <DiffStrip diffCents={diffCents} diffPct={diffPct} />
          </div>
        )}
      </Section>

      {/* ─ Check-in / Check-out ─ */}
      <Section label="Check-in / check-out">
        <div className="grid grid-cols-2 gap-3">
          <Field label={fmtDate(start)}>
            <input
              type="time"
              value={checkInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
              className={INPUT_CLASS + ' tabular-nums'}
            />
          </Field>
          <Field label={fmtDate(end)}>
            <input
              type="time"
              value={checkOutTime}
              onChange={(e) => setCheckOutTime(e.target.value)}
              className={INPUT_CLASS + ' tabular-nums'}
            />
          </Field>
        </div>
      </Section>

      {/* ─ Payment policy ─ the *terms* of this booking. Distinct from the
          cash-payment section below (which records actual money received).
          Pick a preset; the server resolves it against the check-in date and
          snapshots the effective policy onto the booking row. */}
      <Section
        label="Payment policy"
        hint={resolvedPolicy.collapsed ? 'will collapse to 100% upfront' : undefined}
      >
        <PaymentPolicyPresetPicker
          value={paymentPolicyKey}
          onChange={setPaymentPolicyKey}
          checkInYmd={ymd(start)}
        />
      </Section>

      {/* ─ Cash payment ─ only on direct confirm. Records money already
          collected from the guest in person — distinct from the policy
          above. Invites have nothing to charge for until the guest accepts. */}
      {statusChoice === 'confirmed' && (
        <Section
          label="Cash payment"
          hint={paymentAmountCents > 0 ? `${eur(paymentAmountCents)} · cash` : 'none recorded'}
        >
          <div className="grid grid-cols-2 gap-2">
            <PickerTile
              active={paymentChoice === 'none'}
              onClick={() => setPaymentChoice('none')}
              label="None"
              sub="Skip"
            />
            <PickerTile
              active={paymentChoice === 'deposit'}
              onClick={() => setPaymentChoice('deposit')}
              label={`Deposit · ${resolvedPolicy.effective.deposit_pct}%`}
              sub={customTotalCents != null
                ? eur(computeDepositCents(customTotalCents, resolvedPolicy.effective))
                : '—'}
            />
            <PickerTile
              active={paymentChoice === 'full'}
              onClick={() => setPaymentChoice('full')}
              label="Full"
              sub={customTotalCents != null ? eur(customTotalCents) : '—'}
            />
            <CustomPaymentTile
              active={paymentChoice === 'custom'}
              onPick={() => setPaymentChoice('custom')}
              value={customPaymentEuros}
              onChange={setCustomPaymentEuros}
            />
          </div>
        </Section>
      )}

      {/* ─ Status ─ last gate before submit. */}
      <Section label="Status">
        <div className="grid grid-cols-2 gap-2">
          <PickerTile
            active={statusChoice === 'invite'}
            onClick={() => withUser && setStatusChoice('invite')}
            disabled={!withUser}
            label="Hold for invite"
            sub={withUser ? 'Guest must accept' : 'Needs a guest'}
          />
          <PickerTile
            active={statusChoice === 'confirmed'}
            onClick={() => setStatusChoice('confirmed')}
            label="Confirm now"
            sub="Locks dates"
            accent
          />
        </div>
      </Section>

      <div className="pt-5 space-y-3">
        {submitError && <ErrorBanner message={submitError} />}

        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold uppercase tracking-[0.2em] text-xs hover:bg-ocean transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
          {isPending
            ? 'Creating…'
            : statusChoice === 'invite'
              ? `Create invite${customTotalCents != null ? ' · ' + eur(customTotalCents) : ''}`
              : `Confirm booking${customTotalCents != null ? ' · ' + eur(customTotalCents) : ''}`}
        </button>
      </div>
    </div>
  );
}

// ─── Modal-local widgets ────────────────────────────────────────────────────

// EurField — fee input that always shows the default beneath. Local to this
// modal because the "default fee reference" UX is specific to the new-booking
// pricing flow; other modals use simpler money inputs.
function EurField({
  label, value, onChange, defaultCents,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  defaultCents?: number;
}) {
  const customCents = parseEur(value);
  const showDiff = defaultCents != null && customCents != null && customCents !== defaultCents;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs font-mono uppercase tracking-widest text-slate-600 flex-1 min-w-0">
        {label}
      </span>
      <div className="text-right shrink-0">
        <span className="inline-flex items-center bg-white rounded-lg border border-slate-200 focus-within:ring-2 focus-within:ring-ocean/30 focus-within:border-ocean">
          <span className="px-2 text-slate-400 text-sm">€</span>
          <input
            type="number"
            step={1}
            min={0}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-24 px-2 py-2 text-sm text-right tabular-nums focus:outline-none bg-transparent"
          />
        </span>
        {defaultCents != null && (
          <p className={`text-xs tabular-nums mt-1 ${showDiff ? 'text-slate-500' : 'text-slate-300'}`}>
            default {eur(defaultCents)}
          </p>
        )}
      </div>
    </div>
  );
}

// CustomPaymentTile — same shape as modalKit's PickerTile, but when active
// its sub-line becomes the input itself (admin asked: "if i hit custom, that
// div becomes the input"). Inactive state delegates to a normal PickerTile.
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
          className="w-full max-w-[7rem] px-1.5 py-1 text-sm text-right tabular-nums focus:outline-none bg-transparent"
        />
      </span>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function eurInputVal(cents: number): string {
  return String(Math.round(cents / 100));
}

function parseEur(input: string): number | null {
  if (input.trim() === '') return null;
  const n = Math.round(parseFloat(input.replace(',', '.')) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Combine a calendar date with a "HH:MM" string into an ISO timestamp the
// server can drop straight into a TIMESTAMPTZ column. Uses the browser's
// local timezone (which is what the admin sees and types).
function combineDateTime(date: Date, hhmm: string): string {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
  const d = new Date(date.getTime());
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}
