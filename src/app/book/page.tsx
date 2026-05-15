import { notFound, redirect } from 'next/navigation';
import { listProperties } from '@/lib/properties';
import { getActivePaymentPolicy } from '@/lib/systemSettings';
import { todayYmd } from '@/lib/dates';
import { DEFAULT_GUESTS } from '@/lib/guests';
import { ReservationClient } from '@/components/book/ReservationClient';
import {
  EMPTY_IDENTITY,
  type ReservationCtx,
  type ReservationState,
} from '@/lib/reservation';

export const dynamic = 'force-dynamic';

// ============================================================================
// /book — top-level booking route.
//
// Query params:
//   slug      — required, property slug; must be public
//   from, to  — required, YYYY-MM-DD; check_out > check_in; check_in ≥ today
//   adults    — optional, default 2
//   children, infants, pets — optional, default 0
//
// Server validates the inputs, fetches the property + active payment
// policy, then hands ReservationClient (client) the seed `ctx + state`.
// Anything malformed → redirect back to /finca/[slug] (or /finca if no
// slug). We never `notFound()` the route just because the user pasted a
// bad date.
//
// TODO(auth): when auth lands, redirect to /login if no session; prefill
//   identity from the logged-in user.
// ============================================================================

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function intParam(v: string | string[] | undefined, fallback: number): number {
  if (typeof v !== 'string') return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const slug = typeof sp.slug === 'string' ? sp.slug : '';
  const from = typeof sp.from === 'string' ? sp.from : '';
  const to   = typeof sp.to   === 'string' ? sp.to   : '';

  if (!slug) redirect('/finca');

  // The slug page is the only legitimate entry point to /book, so we
  // bounce back to it for any input we can't make sense of. Avoids
  // surfacing a 500 to guests who navigated here by accident.
  const fallbackUrl = `/finca/${slug}`;

  if (!YMD.test(from) || !YMD.test(to)) redirect(fallbackUrl);
  if (from >= to) redirect(fallbackUrl);

  const today = todayYmd();
  if (from < today) redirect(fallbackUrl);

  // Fetch property + estate-wide active policy in parallel.
  const [properties, activePolicy] = await Promise.all([
    listProperties({ publicOnly: true }),
    getActivePaymentPolicy(),
  ]);
  const property = properties.find((p) => p.slug === slug);
  if (!property) notFound();

  const adults   = intParam(sp.adults,   DEFAULT_GUESTS.adults);
  const children = intParam(sp.children, DEFAULT_GUESTS.children);
  const infants  = intParam(sp.infants,  DEFAULT_GUESTS.infants);
  const pets     = intParam(sp.pets,     DEFAULT_GUESTS.pets);

  const ctx: ReservationCtx = {
    property,
    activePolicy: activePolicy.policy,
    today,
  };

  const initial: ReservationState = {
    range: { from, to },
    guests: { adults, children, infants, pets },
    identity: EMPTY_IDENTITY,
  };

  return <ReservationClient ctx={ctx} initial={initial} />;
}
