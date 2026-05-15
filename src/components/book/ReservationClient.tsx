'use client';

import { useReservation } from './useReservation';
import { ReservationSummary } from './ReservationSummary';
import { ReservationForm } from './ReservationForm';
import type { ReservationCtx, ReservationState } from '@/lib/reservation';

// ============================================================================
// ReservationClient — top-level client component for /book. Owns the
// reservation state via useReservation; renders the "open book"
// two-pane layout: summary on the left, form on the right.
//
// The server page builds the initial state from URL params + Property +
// active policy, passes them in here, and the rest is interactive on
// the client.
//
// On lg+ screens the panes sit side-by-side. On smaller screens they
// stack — summary first so the guest sees what they're booking before
// they fill the form.
// ============================================================================

export function ReservationClient({
  ctx,
  initial,
}: {
  ctx: ReservationCtx;
  initial: ReservationState;
}) {
  const rv = useReservation(ctx, initial);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
      <ReservationSummary ctx={ctx} rv={rv} />
      <ReservationForm ctx={ctx} rv={rv} />
    </div>
  );
}
