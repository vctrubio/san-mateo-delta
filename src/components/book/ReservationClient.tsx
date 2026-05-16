'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PROPERTY_LABELS, type PropertySlug } from '@/lib/colors';
import { useReservation } from './useReservation';
import { ReservationSummary } from './ReservationSummary';
import { ReservationForm } from './ReservationForm';
import type { ReservationCtx, ReservationState } from '@/lib/reservation';
import type { CalendarItem } from '@/lib/calendar';

// ============================================================================
// ReservationClient — top-level client component for /book. Owns the
// reservation state via useReservation; renders:
//
//   - a thin back-link strip ("← LEVANTE") so the guest can return to
//     the property page without losing what they've filled in (browser
//     back also works; this is the visible affordance);
//   - the "open book" two-pane layout: summary on the left, form on
//     the right.
//
// `calendarItems` is the public-mode availability window for this
// property. The summary's "Change dates" affordance uses it to render
// an inline `<Calendar>` so the guest can adjust without leaving the
// page.
// ============================================================================

export function ReservationClient({
  ctx,
  initial,
  calendarItems,
}: {
  ctx: ReservationCtx;
  initial: ReservationState;
  calendarItems: CalendarItem[];
}) {
  const rv = useReservation(ctx, initial);
  const label = PROPERTY_LABELS[ctx.property.slug as PropertySlug] ?? ctx.property.slug.toUpperCase();

  return (
    <>
      <div className="mb-6">
        <Link
          href={`/finca/${ctx.property.slug}`}
          className="group inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.4em] text-slate-500 hover:text-ocean transition-colors"
        >
          <ArrowLeft className="w-3 h-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
          {label}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <ReservationSummary ctx={ctx} rv={rv} calendarItems={calendarItems} />
        <ReservationForm ctx={ctx} rv={rv} />
      </div>
    </>
  );
}
