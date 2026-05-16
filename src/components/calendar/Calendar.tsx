'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import type { CalendarItem } from '@/lib/calendar';
import { BLOCKING_BOOKING_STATUSES } from '@/lib/colors';
import BookingActionModal from '@/components/shared/BookingActionModal';
import MonthGrid from './MonthGrid';
import CalendarLegend from './CalendarLegend';
import {
  addMonths,
  parseYmd,
  startOfDay,
  startOfMonth,
} from './dateUtils';

// ============================================================================
// Calendar — single component, two modes selected via the `admin` boolean.
//
// PUBLIC (admin = false, default)
//   Default 2 months. Held items (confirmed/checked_in/checked_out) and blocks
//   are unselectable; everything else (request, invite, cancelled) is invisible
//   to the guest. Two-click range selection. When a valid range is set, fires
//   `onSelectRange(start, end)` so the parent (PropertySectionTabs on the
//   slug page, the showcase modal on the landing page, the inline picker
//   on /book, or any admin shell) can mirror the range into its own state.
//
// ADMIN (admin = true)
//   Default 4 months, with toggle (4 / 8 / 12). Every booking renders in its
//   status color. Clicking an item opens BookingActionModal for inline
//   status transitions, cash payment registration, or block removal.
//   Clicking empty days uses the same two-click selection. When a valid
//   range is set, the parent (AdminCalendarView) auto-opens
//   SelectionActionModal — Calendar itself no longer renders any inline
//   submit panel.
//
// `onSelectRange` mirrors the in-progress range to the parent.
// `onSelectItem` + `selectedItem` let a parent (e.g. AdminCalendarView) drive
// the modal — useful for opening the same panel from a sibling GanttStrip.
//
// Cancelled bookings are NOT held (see docs/availability.md). They're filtered
// out server-side for public mode and rendered muted-but-selectable in admin.
//
// The calendar is stateless about data — `items` is passed in by the caller
// (server-fetched via `getCalendarItems`).
// ============================================================================

export type CalendarProps = {
  /** Property slug — surfaced back to the parent on selection so it can issue
   *  the right createBlock / createAdminBooking call. Required when admin=true. */
  slug?: string;
  /** First month to render. Defaults to start of current month. */
  startMonth?: Date;
  /** Initial number of months. Defaults to 2 (public) or 4 (admin). */
  monthsDefault?: 1 | 2 | 4 | 8 | 12;
  /** Pre-fetched items overlapping the rendered window. */
  items: CalendarItem[];
  /** Admin mode toggle. Defaults to false (public). */
  admin?: boolean;
  /** Show cancelled bookings as colored cells (admin only). Defaults to false
   *  so the dates stay selectable for re-booking and the legend hides the
   *  cancelled chip. Public mode never shows cancelled regardless. */
  showCancellation?: boolean;
  /** Fires whenever the user has a valid two-day range, in either mode. */
  onSelectRange?: (start: Date, end: Date) => void;
  /** Cleared signal when the user resets selection. */
  onClearRange?: () => void;
  /** Optional initial / controlled selection (e.g. driven by a parent form). */
  selectedRange?: { start: Date; end: Date | null };
  /** Controlled active item — when provided, overrides Calendar's internal state. */
  selectedItem?: CalendarItem | null;
  /** Fires when an admin clicks an item (or when the modal closes with null). */
  onSelectItem?: (item: CalendarItem | null) => void;
};

export default function Calendar({
  slug,
  startMonth,
  monthsDefault,
  items,
  admin = false,
  showCancellation = false,
  onSelectRange,
  onClearRange,
  selectedRange,
  selectedItem,
  onSelectItem,
}: CalendarProps) {
  const initialMonths = monthsDefault ?? (admin ? 4 : 2);

  // Drop cancelled bookings from the rendered set unless the caller explicitly
  // opts in. Cancelled is non-blocking, so leaving it visible just clutters
  // the grid and steals click targets on otherwise free days. Public mode
  // already filters cancelled out server-side; this guard makes admin
  // consistent.
  const displayItems = useMemo(() => {
    if (showCancellation) return items;
    return items.filter(
      (it) => !(it.kind === 'booking' && it.status === 'cancelled'),
    );
  }, [items, showCancellation]);

  const [months, setMonths] = useState<1 | 2 | 4 | 8 | 12>(initialMonths);
  const [currentMonth, setCurrentMonth] = useState<Date>(
    startOfMonth(startMonth ?? new Date()),
  );
  const [selStart, setSelStart] = useState<Date | null>(selectedRange?.start ?? null);
  const [selEnd, setSelEnd] = useState<Date | null>(selectedRange?.end ?? null);
  const [hoverEnd, setHoverEnd] = useState<Date | null>(null);
  const [internalActiveItem, setInternalActiveItem] = useState<CalendarItem | null>(null);

  // Controlled mode = the parent is driving the modal (passed both
  // selectedItem and onSelectItem). When controlled, Calendar still tracks
  // activeItem internally for selection-clearing behaviour, but skips
  // rendering its own Modal — the parent owns the modal so it can open one
  // without Calendar being mounted (and so AdminCalendarView can mount the
  // SelectionActionModal alongside it).
  const isControlled = selectedItem !== undefined;
  const activeItem = isControlled ? selectedItem : internalActiveItem;
  const setActiveItem = (item: CalendarItem | null) => {
    if (!isControlled) setInternalActiveItem(item);
    onSelectItem?.(item);
  };

  // Sync external controlled selection (e.g. parent form clears the form).
  useEffect(() => {
    if (selectedRange) {
      setSelStart(selectedRange.start);
      setSelEnd(selectedRange.end);
    } else {
      setSelStart(null);
      setSelEnd(null);
    }
  }, [selectedRange?.start?.getTime(), selectedRange?.end?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = startOfDay(new Date());

  const selectionHasHeldOverlap = useMemo(() => {
    if (!selStart || !selEnd) return false;
    for (const it of items) {
      const isBlocking =
        it.kind === 'block' ||
        (it.kind === 'booking' && BLOCKING_BOOKING_STATUSES.includes(it.status));
      if (!isBlocking) continue;
      const itStart = parseYmd(it.start);
      const itEnd = parseYmd(it.end);
      if (!(itEnd.getTime() <= selStart.getTime() || itStart.getTime() >= selEnd.getTime())) {
        return true;
      }
    }
    return false;
  }, [selStart, selEnd, items]);

  // Fire onSelectRange whenever there's a valid two-day pair, in either mode.
  useEffect(() => {
    if (selStart && selEnd && !selectionHasHeldOverlap) {
      onSelectRange?.(selStart, selEnd);
    }
  }, [selStart?.getTime(), selEnd?.getTime(), selectionHasHeldOverlap]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearSelection() {
    setSelStart(null);
    setSelEnd(null);
    setHoverEnd(null);
    onClearRange?.();
  }

  function handleDayClick(day: Date, owning: CalendarItem[]) {
    // Admin: clicking an existing item → open the action panel.
    if (admin && owning.length > 0) {
      const block = owning.find((it) => it.kind === 'block');
      const held = owning.find(
        (it) => it.kind === 'booking' && BLOCKING_BOOKING_STATUSES.includes(it.status),
      );
      const soft = owning.find((it) => it.kind === 'booking');
      const target = block ?? held ?? soft;
      if (target) {
        setActiveItem(target);
        clearSelection();
        return;
      }
    }

    // Public: held days are unclickable (DayCell already disables the button).
    if (!admin && owning.length > 0) return;

    // Selection state machine.
    if (!selStart || (selStart && selEnd)) {
      setSelStart(day);
      setSelEnd(null);
      setActiveItem(null);
      onClearRange?.();
      return;
    }
    if (day.getTime() <= selStart.getTime()) {
      setSelStart(day);
      setSelEnd(null);
      onClearRange?.();
      return;
    }
    setSelEnd(day);
  }

  const monthWindows = Array.from({ length: months }, (_, i) => addMonths(currentMonth, i));
  const gridCols =
    months === 2 ? 'grid-cols-1 md:grid-cols-2' :
    months === 4 ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4' :
    months === 8 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
                   'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <div className="rounded-3xl bg-white border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100 flex-wrap">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-4 h-4 text-ocean shrink-0" />
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400">
            {admin ? 'Calendar' : 'Availability'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {admin && (
            <div className="flex bg-slate-50 rounded-full p-1 text-[10px] font-mono uppercase tracking-widest">
              {[4, 8, 12].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMonths(n as 4 | 8 | 12)}
                  className={`px-3 py-1.5 rounded-full transition-colors ${
                    months === n
                      ? 'bg-white text-slate-900 shadow'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {n}M
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
              className="p-2 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className={`grid gap-x-8 gap-y-6 ${gridCols}`}>
          {monthWindows.map((m, i) => (
            <MonthGrid
              key={`${m.getFullYear()}-${m.getMonth()}-${i}`}
              month={m}
              items={displayItems}
              admin={admin}
              today={today}
              selectionStart={selStart}
              selectionEnd={selEnd}
              hoverEnd={hoverEnd}
              onDayClick={handleDayClick}
              onDayHover={setHoverEnd}
            />
          ))}
        </div>

        {(selStart || selEnd) && (
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[12px] text-slate-600">
              {selStart && !selEnd && (
                <span>
                  <span className="font-mono text-slate-400 uppercase tracking-widest text-[10px]">Start</span>
                  {' '}{fmt(selStart)} — pick a check-out day
                </span>
              )}
              {selStart && selEnd && (
                <span>
                  <span className="font-mono text-slate-400 uppercase tracking-widest text-[10px]">Selected</span>
                  {' '}{fmt(selStart)} → {fmt(selEnd)}
                  {' '}<span className="text-slate-400">·</span>{' '}
                  <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
                    {Math.round((selEnd.getTime() - selStart.getTime()) / 86_400_000)} nights
                  </span>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="text-[10px] font-mono uppercase tracking-widest text-slate-400 hover:text-ocean"
            >
              Clear
            </button>
          </div>
        )}

        {selectionHasHeldOverlap && (
          <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-[12px] text-rose-900">
            Selected range overlaps a held booking or block. Pick a clear range.
          </div>
        )}
      </div>

      {!isControlled && activeItem && (
        <BookingActionModal
          item={activeItem}
          onClose={() => setActiveItem(null)}
        />
      )}

      <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
        <CalendarLegend admin={admin} showCancellation={showCancellation} />
      </div>
    </div>
  );
}

function fmt(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
