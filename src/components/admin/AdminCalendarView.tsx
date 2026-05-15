'use client';

import { useMemo, useState } from 'react';
import AdminSection from '@/components/admin/AdminSection';
import EstateOverview from '@/components/admin/EstateOverview';
import Calendar from '@/components/calendar/Calendar';
import GanttStrip, { type GanttProperty } from '@/components/calendar/GanttStrip';
import SelectionSummary from '@/components/calendar/SelectionSummary';
import PerPropertyFutureStrip from '@/components/admin/PerPropertyFutureStrip';
import BookingActionModal from '@/components/shared/BookingActionModal';
import {
  BookingsListModal,
  PaymentsListModal,
} from '@/components/shared/PropertyDetailModals';
import SelectionActionModal, {
  type SelectionUserOption,
} from '@/components/shared/SelectionActionModal';
import type { CalendarBooking, CalendarBlock, CalendarItem } from '@/lib/calendar';
import { BLOCKING_BOOKING_STATUSES } from '@/lib/colors';
import { parseYmd, startOfDay } from '@/components/calendar/dateUtils';
import type { FuturePropertyData } from '@/lib/properties';
import type { EstateOverview as EstateOverviewData } from '@/lib/dashboard';
import type { BookingStatus } from '@db/enums';
import type { PaymentPolicyKey } from '@/lib/payment';

// ============================================================================
// AdminCalendarView — client shell that owns all the calendar-page state
// (active property, in-progress range, active item, list-modal state) and
// renders the page as four AdminSection blocks:
//
//   ┌─ AdminSection eyebrow="Upcoming"     · EstateOverview ──────────┐
//   ├─ AdminSection eyebrow="Availability" · GanttStrip ──────────────┤
//   ├─ AdminSection eyebrow="Properties"   · PerPropertyFutureStrip ──┤
//   ├─ (only when a property is active)                                │
//   │   AdminSection eyebrow="Calendar"    · SelectionSummary +        │
//   │                                       Calendar                   │
//   └──────────────────────────────────────────────────────────────────┘
//
// Property selection paths (all converge on `setActiveSlug`):
//   - PerPropertyFutureStrip card click   → toggle active
//   - GanttStrip slug-label click         → toggle active
//   - GanttStrip item-cell click          → switch to that slug + open modal
//   - PerPropertyFutureStrip "today" pill → switch to that slug + open
//                                           today's booking/block in modal
// ============================================================================

export type AdminCalendarViewProps = {
  properties: (GanttProperty & { id: string; max_guests: number })[];
  itemsBySlug: Record<string, CalendarItem[]>;
  futureBySlug: Record<string, FuturePropertyData>;
  overview: EstateOverviewData;
  users: SelectionUserOption[];
  /** Active estate-wide policy key. Preselects the per-booking preset picker
   *  in the selection modal; admin can still override per booking. */
  defaultPaymentPolicyKey: PaymentPolicyKey;
};

export default function AdminCalendarView({
  properties,
  itemsBySlug,
  futureBySlug,
  overview,
  users,
  defaultPaymentPolicyKey,
}: AdminCalendarViewProps) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ start: Date; end: Date | null } | null>(null);
  const [activeItem, setActiveItem] = useState<CalendarItem | null>(null);
  // Modal-suppression: when the user dismisses the selection-action modal
  // (Esc or backdrop), we keep the highlighted range visible but stop
  // re-opening the modal automatically. Re-opening only happens when the
  // selection changes — so the modal won't pop back the moment the user
  // tries to inspect the calendar with the selection still on screen.
  const [selectionModalDismissed, setSelectionModalDismissed] = useState(false);
  const [openListModal, setOpenListModal] = useState<
    { type: 'bookings' | 'payments'; slug: string } | null
  >(null);

  const activeProperty = activeSlug
    ? properties.find((p) => p.slug === activeSlug)
    : null;
  const activeItems = activeSlug ? itemsBySlug[activeSlug] ?? [] : [];

  // The selection-action modal opens auto-magically the moment a complete
  // range exists on a focused property AND the range doesn't overlap a held
  // booking/block. The Calendar surfaces the "no overlap" check internally
  // by only firing onSelectRange when the range is valid, so we just check
  // for selection.end here.
  const selectionModalOpen = useMemo(() => {
    return Boolean(
      activeProperty
      && selection?.start
      && selection?.end
      && !selectionModalDismissed,
    );
  }, [activeProperty, selection?.start, selection?.end, selectionModalDismissed]);

  const futureRows = properties
    .map((p) => futureBySlug[p.slug])
    .filter((r): r is FuturePropertyData => Boolean(r));

  function setActive(slug: string | null) {
    setActiveSlug(slug);
    setSelection(null);
    setActiveItem(null);
    setSelectionModalDismissed(false);
  }

  function clearSelection() {
    setSelection(null);
    setSelectionModalDismissed(false);
  }

  function handleToggleProperty(slug: string | null) {
    setActive(slug);
  }

  // Gantt slug-label click — toggle active for that property.
  function handleSelectProperty(slug: string) {
    setActive(slug === activeSlug ? null : slug);
  }

  // Gantt item-cell click — switch slug if needed and open the item's modal.
  function handleGanttItemClick(item: CalendarItem, slug: string) {
    if (slug !== activeSlug) {
      setActiveSlug(slug);
      setSelection(null);
    }
    setActiveItem(item);
  }

  // Today indicator click. JUST opens the item's modal — does NOT switch the
  // active slug or otherwise mutate selection state. The modal is rendered
  // independently below (see "Action modal" block) so it works even when
  // Calendar isn't mounted (no property focused).
  //   1. Block first (admin-imposed unavailability is the strongest signal)
  //   2. Highest-priority non-cancelled booking covering today
  //      (held > invite > request, mirroring the SQL `today_indicator_status`)
  function handleOpenToday(slug: string) {
    const items = itemsBySlug[slug] ?? [];
    const today = startOfDay(new Date()).getTime();

    const block = items.find(
      (it): it is CalendarBlock =>
        it.kind === 'block' &&
        parseYmd(it.start).getTime() <= today &&
        parseYmd(it.end).getTime() > today,
    );
    if (block) {
      setActiveItem(block);
      return;
    }

    const candidates = items.filter(
      (it): it is CalendarBooking =>
        it.kind === 'booking' &&
        it.status !== 'cancelled' &&
        parseYmd(it.start).getTime() <= today &&
        parseYmd(it.end).getTime() > today,
    );
    if (candidates.length === 0) return;
    const priority = (s: BookingStatus): number =>
      BLOCKING_BOOKING_STATUSES.includes(s) ? 1 :
        s === 'invite' ? 2 :
          s === 'request' ? 3 : 4;
    candidates.sort((a, b) => priority(a.status) - priority(b.status));
    setActiveItem(candidates[0]);
  }

  return (
    <>
      <AdminSection eyebrow="Upcoming" hint="Money to be made across the estate">
        <EstateOverview data={overview} />
      </AdminSection>

      <AdminSection eyebrow="Availability" hint="90 days · click a slug to focus · a booking to act">
        <GanttStrip
          properties={properties}
          itemsBySlug={itemsBySlug}
          activeSlug={activeSlug}
          onSelectProperty={handleSelectProperty}
          onSelectItem={handleGanttItemClick}
          selection={
            selection && activeSlug
              ? { slug: activeSlug, start: selection.start, end: selection.end }
              : null
          }
        />
      </AdminSection>

      <AdminSection eyebrow="Properties" hint="Click a card to focus · a section to drill in">
        <PerPropertyFutureStrip
          rows={futureRows}
          activeSlug={activeSlug}
          onToggleProperty={handleToggleProperty}
          onOpenBookings={(slug) => setOpenListModal({ type: 'bookings', slug })}
          onOpenPayments={(slug) => setOpenListModal({ type: 'payments', slug })}
          onOpenToday={handleOpenToday}
        />
      </AdminSection>

      {activeProperty && (
        <AdminSection eyebrow="Calendar" hint={activeProperty.label.toUpperCase()}>
          <div className="space-y-3">
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
              onSelectRange={(start, end) => {
                setSelection({ start, end });
                setSelectionModalDismissed(false);
              }}
              onClearRange={clearSelection}
              selectedItem={activeItem}
              onSelectItem={setActiveItem}
            />
          </div>
        </AdminSection>
      )}

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

      {/* Action modal — owned here so it works even when no property is
          focused (e.g. clicking the today indicator on a non-active card).
          Calendar.tsx skips its internal modal when controlled, so this is
          the single source of truth for the active item. */}
      {activeItem && (
        <BookingActionModal
          item={activeItem}
          onClose={() => setActiveItem(null)}
        />
      )}

      {/* Selection-action modal — auto-opens once admin completes a valid
          two-day range on a focused property. Replaces the old dark
          BlockConfirmBar with a chooser-first flow (block vs new booking). */}
      {selectionModalOpen && activeProperty && selection?.start && selection?.end && (
        <SelectionActionModal
          slug={activeProperty.slug}
          propertyLabel={activeProperty.label}
          propertyMaxGuests={activeProperty.max_guests}
          start={selection.start}
          end={selection.end}
          users={users}
          defaultPaymentPolicyKey={defaultPaymentPolicyKey}
          onClose={() => setSelectionModalDismissed(true)}
          onSuccess={() => {
            setSelection(null);
            setSelectionModalDismissed(false);
          }}
        />
      )}
    </>
  );
}
