// ============================================================================
// Reservation — the umbrella unit of work for booking a property.
//
// This file is pure TypeScript (no React, no DB). It defines:
//   - The state shape (ReservationState) and context (ReservationCtx).
//   - Pure helpers that compute derived values: quote, resolved policy,
//     validation.
//
// The React surface lives in `src/components/book/useReservation.ts`,
// which wraps these helpers in `useState` + `useMemo` + `useCallback`.
// Splitting like this keeps the math testable without a DOM, and lets
// server code (the `/book` page's initial render) call the same
// helpers to produce a seed quote.
// ============================================================================

import type { Month } from '@db/enums';
import type { Property } from '@/lib/properties';
import type { PaymentPolicy, ResolvedPolicy } from '@/lib/payment';
import { resolvePolicy } from '@/lib/payment';
import type { GuestCounts } from '@/lib/guests';
import { DEFAULT_GUESTS, totalGuests } from '@/lib/guests';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Identity = {
  name: string;
  email: string;
  tif: string;
  nationality: string;
  /** YYYY-MM-DD. Empty string when not provided. */
  dob: string;
};

export const EMPTY_IDENTITY: Identity = {
  name: '',
  email: '',
  tif: '',
  nationality: '',
  dob: '',
};

export type DateRange = {
  /** YYYY-MM-DD inclusive. */
  from: string;
  /** YYYY-MM-DD exclusive (the day the guest leaves). */
  to: string;
};

export type ReservationCtx = {
  property: Property;
  activePolicy: PaymentPolicy;
  /** YYYY-MM-DD, evaluated at page load. Passed in to keep helpers pure. */
  today: string;
};

export type ReservationState = {
  range: DateRange | null;
  guests: GuestCounts;
  identity: Identity;
};

export const EMPTY_STATE: ReservationState = {
  range: null,
  guests: DEFAULT_GUESTS,
  identity: EMPTY_IDENTITY,
};

// ─── Quote (pure, mirrors src/lib/bookings.ts#computeQuote) ─────────────────

export type Quote = {
  nights: number;
  night_rate_cents: number;
  rate_month: number;
  agreed_property_cents: number;
  agreed_cleaning_cents: number;
  agreed_total_cents: number;
};

/** Whole-day difference between two YYYY-MM-DD strings, computed in UTC. */
export function nightsBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs   = Date.parse(`${to}T00:00:00Z`);
  return Math.round((toMs - fromMs) / 86_400_000);
}

/**
 * Pure quote calculation. Returns null when the inputs aren't usable
 * (no range picked, or zero nights). The matching server-side
 * `computeQuote` in `src/lib/bookings.ts` is still the source of truth
 * for persisted bookings — this is for the live receipt UI.
 */
export function computeReservationQuote(ctx: ReservationCtx, state: ReservationState): Quote | null {
  if (!state.range) return null;
  const nights = nightsBetween(state.range.from, state.range.to);
  if (nights <= 0) return null;

  const monthIn = Number(state.range.from.slice(5, 7)) as Month;
  const night_rate_cents = ctx.property.rates[monthIn];
  if (typeof night_rate_cents !== 'number') return null;

  const agreed_property_cents = nights * night_rate_cents;
  const agreed_cleaning_cents = ctx.property.cleaning_fee_cents;

  return {
    nights,
    night_rate_cents,
    rate_month: monthIn,
    agreed_property_cents,
    agreed_cleaning_cents,
    agreed_total_cents: agreed_property_cents + agreed_cleaning_cents,
  };
}

// ─── Policy resolution ──────────────────────────────────────────────────────

/**
 * Resolve the active estate-wide policy against the picked check-in
 * date. If a split policy can't clear before check-in, this collapses
 * to 100% upfront (same method) — see `resolvePolicy` in
 * `src/lib/payment.ts`. The collapsed reason is surfaced in the UI.
 *
 * Returns null when no range is picked (no date to resolve against).
 */
export function resolveReservationPolicy(ctx: ReservationCtx, state: ReservationState): ResolvedPolicy | null {
  if (!state.range) return null;
  return resolvePolicy(ctx.activePolicy, state.range.from, ctx.today);
}

// ─── Validation ─────────────────────────────────────────────────────────────

export type ValidationError = {
  /** Field name — matches the form input the user can correct. */
  field: 'range' | 'guests' | 'name' | 'email';
  message: string;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: ValidationError[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateReservation(ctx: ReservationCtx, state: ReservationState): ValidationResult {
  const errors: ValidationError[] = [];

  if (!state.range) {
    errors.push({ field: 'range', message: 'Pick your dates.' });
  } else if (nightsBetween(state.range.from, state.range.to) <= 0) {
    errors.push({ field: 'range', message: 'Check-out must be after check-in.' });
  } else if (state.range.from < ctx.today) {
    errors.push({ field: 'range', message: 'Check-in must be today or later.' });
  }

  const adults = state.guests.adults ?? 0;
  if (adults < 1) {
    errors.push({ field: 'guests', message: 'At least one adult is required.' });
  }
  const total = totalGuests(state.guests);
  if (total > ctx.property.max_guests) {
    errors.push({
      field: 'guests',
      message: `This property sleeps ${ctx.property.max_guests}; you entered ${total}.`,
    });
  }

  if (!state.identity.name.trim()) {
    errors.push({ field: 'name', message: 'Name is required.' });
  }
  if (!state.identity.email.trim()) {
    errors.push({ field: 'email', message: 'Email is required.' });
  } else if (!EMAIL_RE.test(state.identity.email.trim())) {
    errors.push({ field: 'email', message: 'That email doesn\'t look valid.' });
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// ─── FormData serialisation ─────────────────────────────────────────────────
// The server action `requestBooking` takes FormData. Building it here keeps
// the action's contract in one place and makes the client submit a one-liner.

export function buildRequestBookingFormData(ctx: ReservationCtx, state: ReservationState): FormData {
  if (!state.range) throw new Error('Cannot build FormData without a date range.');
  const fd = new FormData();
  fd.set('slug', ctx.property.slug);
  fd.set('check_in', state.range.from);
  fd.set('check_out', state.range.to);
  fd.set('adults', String(state.guests.adults));
  fd.set('children', String(state.guests.children));
  fd.set('infants', String(state.guests.infants));
  fd.set('pets', String(state.guests.pets));
  fd.set('name', state.identity.name.trim());
  fd.set('email', state.identity.email.trim().toLowerCase());
  if (state.identity.tif) fd.set('tif', state.identity.tif);
  if (state.identity.nationality) fd.set('nationality', state.identity.nationality);
  if (state.identity.dob) fd.set('dob', state.identity.dob);
  return fd;
}

// ─── External availability stub (TODO: Airbnb iCal) ─────────────────────────
//
// When a guest hits Submit we should cross-check the picked range against
// the property's Airbnb iCal feed — Airbnb-side bookings don't surface in
// our DB yet, so the only thing currently stopping a double-booking is
// the host catching it manually. The proper fix is a separate phase (see
// case-study.md → Phase 4). This function is the stub the booking flow
// will call once that lands.

export type ExternalAvailabilityResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function checkExternalAvailability(
  _slug: string,
  _range: DateRange,
): Promise<ExternalAvailabilityResult> {
  // TODO(airbnb-ical): fetch the per-property ICS URL, parse VEVENTs,
  //   return { ok: false } if the picked range overlaps an Airbnb stay.
  return { ok: true };
}
