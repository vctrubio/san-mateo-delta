'use client';

import { useState } from 'react';
import Calendar from '@/components/calendar/Calendar';
import GanttStrip, { type GanttProperty } from '@/components/calendar/GanttStrip';
import SelectionSummary from '@/components/calendar/SelectionSummary';
import PerPropertyFutureStrip from '@/components/admin/PerPropertyFutureStrip';
import {
  BookingsListModal,
  PaymentsListModal,
} from '@/components/admin/PropertyDetailModals';
import type { CalendarItem } from '@/lib/calendar';
import type { FuturePropertyData } from '@/lib/properties';

// ============================================================================
// AdminCalendarView — client shell for /admin/calendar.
//
//   ┌─ PerPropertyFutureStrip (4-card grid · property selector) ─┐
//   ├─ GanttStrip (scanner + booking-click → modal) ─────────────┤
//   ├─ SelectionSummary (date range, when one is in progress) ───┤
//   ├─ Calendar (full grid for active property) ─────────────────┤
//   └────────────────────────────────────────────────────────────┘
//
// Property selection lives ENTIRELY in the strip — clicking a card toggles
// it active, with a highlighted border. The gantt is read-only for property
// switching; its only interactive elements are item-cells that open the
// booking action modal.
//
// State:
//   - activeSlug:  string | null — null = nothing focused
//   - selection:   in-progress two-click range, mirrored from <Calendar>
//   - activeItem:  the booking/block whose modal is open (driven from
//                  either Calendar or GanttStrip item-cell click)
// ============================================================================

export type AdminCalendarViewProps = {
  properties: (GanttProperty & { id: string })[];
  itemsBySlug: Record<string, CalendarItem[]>;
  futureBySlug: Record<string, FuturePropertyData>;
};

export default function AdminCalendarView({
  properties,
  itemsBySlug,
  futureBySlug,
}: AdminCalendarViewProps) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ start: Date; end: Date | null } | null>(null);
  const [activeItem, setActiveItem] = useState<CalendarItem | null>(null);
  const [openListModal, setOpenListModal] = useState<
    { type: 'bookings' | 'payments'; slug: string } | null
  >(null);

  const activeProperty = activeSlug
    ? properties.find((p) => p.slug === activeSlug)
    : null;
  const activeItems = activeSlug ? itemsBySlug[activeSlug] ?? [] : [];

  const futureRows = properties
    .map((p) => futureBySlug[p.slug])
    .filter((r): r is FuturePropertyData => Boolean(r));

  function handleToggleProperty(slug: string | null) {
    setActiveSlug(slug);
    setSelection(null);
    setActiveItem(null);
  }

  function handleGanttItemClick(item: CalendarItem, slug: string) {
    if (slug !== activeSlug) {
      setActiveSlug(slug);
      setSelection(null);
    }
    setActiveItem(item);
  }

  return (
    <div className="space-y-5">
      <PerPropertyFutureStrip
        rows={futureRows}
        activeSlug={activeSlug}
        onToggleProperty={handleToggleProperty}
        onOpenBookings={(slug) => setOpenListModal({ type: 'bookings', slug })}
        onOpenPayments={(slug) => setOpenListModal({ type: 'payments', slug })}
      />

      {openListModal?.type === 'bookings' && (
        <BookingsListModal
          slug={openListModal.slug}
          items={itemsBySlug[openListModal.slug] ?? []}
          onClose={() => setOpenListModal(null)}
        />
      )}
      {openListModal?.type === 'payments' && (
        <PaymentsListModal
          slug={openListModal.slug}
          items={itemsBySlug[openListModal.slug] ?? []}
          onClose={() => setOpenListModal(null)}
        />
      )}

      <GanttStrip
        properties={properties}
        itemsBySlug={itemsBySlug}
        activeSlug={activeSlug}
        onSelectItem={handleGanttItemClick}
        selection={
          selection && activeSlug
            ? { slug: activeSlug, start: selection.start, end: selection.end }
            : null
        }
      />

      {activeProperty && (
        <>
          <SelectionSummary
            selection={selection}
            propertyLabel={activeProperty.label}
          />
          <Calendar
            admin
            slug={activeProperty.slug}
            items={activeItems}
            monthsDefault={4}
            selectedRange={selection ?? undefined}
            onSelectRange={(start, end) => setSelection({ start, end })}
            onClearRange={() => setSelection(null)}
            selectedItem={activeItem}
            onSelectItem={setActiveItem}
          />
        </>
      )}
    </div>
  );
}
