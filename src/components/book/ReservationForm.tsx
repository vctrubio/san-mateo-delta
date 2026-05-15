'use client';

import { useRouter } from 'next/navigation';
import { CreditCard, Loader2 } from 'lucide-react';
import GuestConfig from '@/components/shared/GuestConfig';
import { eur } from '@/lib/format';
import { type UseReservationReturn } from './useReservation';
import type { ReservationCtx } from '@/lib/reservation';

// ============================================================================
// ReservationForm — right pane of the /book "open book".
//
// Two sections + submit:
//   1. Guests (uses the existing shared GuestConfig)
//   2. Identity (name, email, plus optional TIF/nationality/DOB)
//   3. Submit — calls `rv.submit`, redirects on success.
//
// Validation surfaces both inline (per-field) and globally (banner at top
// when the server action rejects). The submit button is disabled when
// validation hasn't passed, with a hint label that swaps based on the
// resolved policy (e.g. "Pay €X deposit" vs "Reserve · pay on arrival").
// ============================================================================

export function ReservationForm({
  ctx,
  rv,
}: {
  ctx: ReservationCtx;
  rv: UseReservationReturn;
}) {
  const router = useRouter();

  // Field-level errors, keyed by `field`. Empty when validation.ok = true.
  const errorsByField = !rv.validation.ok
    ? Object.fromEntries(rv.validation.errors.map((e) => [e.field, e.message]))
    : {};

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    rv.submit((result) => {
      if (result.ok) {
        router.push(result.redirectUrl);
      }
      // Error case already lives on rv.serverError via the hook.
    });
  }

  const submitLabel = (() => {
    if (rv.isSubmitting) return 'Working…';
    if (!rv.resolvedPolicy || !rv.quote) return 'Pick dates first';
    if (rv.deposit === 0) return 'Reserve · pay on arrival';
    if (rv.deposit < rv.total) return `Pay €${(rv.deposit / 100).toFixed(0)} deposit`;
    return `Pay €${(rv.total / 100).toFixed(0)} now`;
  })();

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6 lg:p-8 flex flex-col gap-8"
    >
      {/* Server error banner — shows after a failed submit. */}
      {rv.serverError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800">
          {rv.serverError}
        </div>
      )}

      {/* Guests */}
      <section>
        <header className="mb-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-ocean">
            Who's coming
          </p>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight mt-1">
            Guests
          </h3>
        </header>
        <GuestConfig
          value={rv.state.guests}
          onChange={rv.setGuests}
          maxGuests={ctx.property.max_guests}
        />
        {errorsByField.guests && (
          <p className="mt-2 text-xs text-rose-700">{errorsByField.guests}</p>
        )}
      </section>

      {/* Identity */}
      <section>
        <header className="mb-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-ocean">
            For the booking
          </p>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight mt-1">
            Your details
          </h3>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field
            label="Full name"
            value={rv.state.identity.name}
            onChange={(v) => rv.setIdentity({ name: v })}
            error={errorsByField.name}
            required
          />
          <Field
            label="Email"
            type="email"
            value={rv.state.identity.email}
            onChange={(v) => rv.setIdentity({ email: v })}
            error={errorsByField.email}
            required
          />
          <Field
            label="TIF / NIE (optional)"
            value={rv.state.identity.tif}
            onChange={(v) => rv.setIdentity({ tif: v })}
          />
          <Field
            label="Nationality (optional)"
            value={rv.state.identity.nationality}
            onChange={(v) => rv.setIdentity({ nationality: v })}
          />
          <Field
            label="Date of birth (optional)"
            type="date"
            value={rv.state.identity.dob}
            onChange={(v) => rv.setIdentity({ dob: v })}
          />
        </div>
      </section>

      {/* Submit */}
      <section className="pt-4 border-t border-slate-100">
        <button
          type="submit"
          disabled={rv.isSubmitting || !rv.validation.ok}
          className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-2xl bg-ocean text-white font-bold uppercase tracking-[0.2em] text-xs hover:shadow-xl hover:shadow-ocean/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
        >
          {rv.isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CreditCard className="w-4 h-4" />
          )}
          {submitLabel}
        </button>

        {/* Range/validation errors that aren't tied to a visible field
            (no date inputs on this form — dates are picked back on
            /finca/[slug]). Show them so the user knows why submit is
            blocked. */}
        {errorsByField.range && (
          <p className="mt-3 text-xs text-rose-700 text-center">{errorsByField.range}</p>
        )}

        <p className="mt-3 text-[10px] font-mono uppercase tracking-widest text-slate-400 text-center">
          Total {eur(rv.total)} · Test mode · No real charge
        </p>
      </section>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'email' | 'date';
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-invalid={!!error}
        className={
          'px-3 py-2.5 rounded-lg border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 ' +
          (error
            ? 'border-rose-300 focus:border-rose-400'
            : 'border-slate-200 focus:border-ocean')
        }
      />
      {error && <span className="text-[11px] text-rose-700">{error}</span>}
    </label>
  );
}
