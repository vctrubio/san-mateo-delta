'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { requestBooking } from '@/actions/bookings';
import { createCheckoutSession } from '@/actions/checkout';
import { chargesCardAtBooking } from '@/lib/payment';
import type { GuestCounts } from '@/lib/guests';
import {
  buildRequestBookingFormData,
  checkExternalAvailability,
  computeReservationQuote,
  resolveReservationPolicy,
  validateReservation,
  type DateRange,
  type Identity,
  type ReservationCtx,
  type ReservationState,
  type ValidationResult,
} from '@/lib/reservation';

// ============================================================================
// useReservation — the React surface for booking. Wraps the pure helpers in
// `src/lib/reservation.ts` with state + memoised derived values + a
// submit handler that fires the existing server actions.
//
// Consumers (ReservationClient + its panes) read `quote`, `total`,
// `deposit`, `chargesCard`, `validation` — all memoised on the inputs
// that feed them. Setters merge into state; the derived values
// recompute the next render.
//
// `submit` returns a SubmitResult. The caller is responsible for the
// redirect; this hook never touches `window` directly.
// ============================================================================

export type SubmitResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: string };

export function useReservation(
  ctx: ReservationCtx,
  initial: ReservationState,
) {
  const [state, setState] = useState<ReservationState>(initial);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  // ─── Setters ──────────────────────────────────────────────────────────────
  // All cheap — they merge into state. Memoised so panes can pass them as
  // stable callbacks without re-mounting children.

  const setRange = useCallback((range: DateRange | null) => {
    setState((s) => ({ ...s, range }));
  }, []);

  const setGuests = useCallback((guests: GuestCounts) => {
    setState((s) => ({ ...s, guests }));
  }, []);

  const setIdentity = useCallback((patch: Partial<Identity>) => {
    setState((s) => ({ ...s, identity: { ...s.identity, ...patch } }));
  }, []);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const quote = useMemo(
    () => computeReservationQuote(ctx, state),
    [ctx, state.range],
  );

  const resolvedPolicy = useMemo(
    () => resolveReservationPolicy(ctx, state),
    [ctx, state.range],
  );

  const validation: ValidationResult = useMemo(
    () => validateReservation(ctx, state),
    [ctx, state],
  );

  const total = quote?.agreed_total_cents ?? 0;
  const deposit = useMemo(() => {
    if (!resolvedPolicy) return 0;
    return Math.round((total * resolvedPolicy.effective.deposit_pct) / 100);
  }, [total, resolvedPolicy]);

  const chargesCard = resolvedPolicy ? chargesCardAtBooking(resolvedPolicy.effective) : false;

  // ─── Submit ───────────────────────────────────────────────────────────────
  //
  // 1. Re-validate (UX — server re-validates anyway).
  // 2. Stub: check external availability (Airbnb iCal — currently no-op).
  // 3. Call `requestBooking` server action.
  // 4. Branch:
  //      - chargesCard → createCheckoutSession → return Stripe URL
  //      - else        → return /user/[id]?just_booked=<id>
  //
  // The hook never redirects. Caller does `window.location.href = result.redirectUrl`
  // so the navigation is the consumer's choice and tests stay simple.

  const submit = useCallback(async (): Promise<SubmitResult> => {
    setServerError(null);
    if (!validation.ok) {
      return { ok: false, error: validation.errors[0].message };
    }
    if (!state.range) {
      return { ok: false, error: 'Pick your dates first.' };
    }

    const external = await checkExternalAvailability(ctx.property.slug, state.range);
    if (!external.ok) {
      const msg = external.reason || 'Those dates are taken on Airbnb.';
      setServerError(msg);
      return { ok: false, error: msg };
    }

    const result = await requestBooking(buildRequestBookingFormData(ctx, state));
    if (!result.ok) {
      setServerError(result.error);
      return { ok: false, error: result.error };
    }

    if (chargesCard) {
      const checkout = await createCheckoutSession(result.bookingId, 'deposit');
      if (!checkout.ok) {
        // Booking was inserted but Stripe failed. Send the guest to
        // their dashboard so they can pay the balance manually.
        const fallback = `/user/${result.userId}?just_booked=${result.bookingId}`;
        const msg = `Booking saved (#${result.bookingId}), but Stripe checkout failed: ${checkout.error}.`;
        setServerError(msg);
        return { ok: true, redirectUrl: fallback };
      }
      return { ok: true, redirectUrl: checkout.url };
    }

    return {
      ok: true,
      redirectUrl: `/user/${result.userId}?just_booked=${result.bookingId}`,
    };
  }, [ctx, state, validation, chargesCard]);

  /** Wrap submit in a React transition so the UI stays responsive while it runs. */
  const submitWithTransition = useCallback(
    (onResult: (r: SubmitResult) => void) => {
      startSubmitTransition(async () => {
        const r = await submit();
        onResult(r);
      });
    },
    [submit],
  );

  return {
    // state
    state,
    setRange,
    setGuests,
    setIdentity,
    // derived
    quote,
    resolvedPolicy,
    total,
    deposit,
    chargesCard,
    validation,
    // submit
    submit: submitWithTransition,
    isSubmitting,
    serverError,
  };
}

export type UseReservationReturn = ReturnType<typeof useReservation>;
