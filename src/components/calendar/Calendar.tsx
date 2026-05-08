'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import type { CalendarItem, CalendarMode } from '@/lib/calendar';
import { BLOCKING_BOOKING_STATUSES } from '@/lib/colors';
import MonthGrid from './MonthGrid';
import CalendarLegend from './CalendarLegend';
import BlockConfirmBar from './BlockConfirmBar';
import BookingActionPanel from './BookingActionPanel';
import {
  addMonths,
  isSameDay,
  isWithinHalfOpen,
  parseYmd,
  startOfDay,
  startOfMonth,
} from './dateUtils';

// ============================================================================
// Calendar — single component, two modes.
//
// PUBLIC MODE
//   Default 2 months. Held items (confirmed/checked_in/checked_out) and blocks
//   are unselectable; everything else is invisible to the guest. Two-click
//   range selection. When a valid range is set, fires `onSelectRange(start, end)`
//   so the parent (BookNowForm) can drive its hidden inputs + re-quote.
//
// ADMIN MODE
//   Default 4 months, with toggle (4 / 8 / 12). Every booking renders in its
//   status color. Clicking an item opens BookingActionPanel for inline status
//   transitions or block removal. Clicking empty days uses the same two-click
//   selection. When a valid range is set, BlockConfirmBar appears with a
//   reason input; on submit it calls `createBlock` and `revalidatePath`.
//
// The calendar is stateless about data — `items` is passed in by the caller
// (server-fetched via `getCalendarItems`).
// ============================================================================

export type CalendarProps = {
  /** Property slug — used by BlockConfirmBar to call createBlock. Required in admin mode. */
  slug?: string;
  /** First month to render. Defaults to start of current month. */
  startMonth?: Date;
  /** Initial number of months. Public defaults 2; admin defaults 4. */
  monthsDefault?: 2 | 4 | 8 | 12;
  /** Pre-fetched items overlapping the rendered window. */
  items: CalendarItem[];
  mode: CalendarMode;
  /** Public mode: fires when the user has a valid range. */
  onSelectRange?: (start: Date, end: Date) => void;
  /** Public mode: cleared signal when user resets selection. */
  onClearRange?: () => void;
  /** Optional initial selection (e.g. driven by a parent form). */
  selectedRange?: { start: Date; end: Date | null };
};

export default function Calendar({
  slug,
  startMonth,
  monthsDefault,
  items,
  mode,
  onSelectRange,
  onClearRange,
  selectedRange,
}: CalendarProps) {
  // Defaults differ by mode
  const initialMonths = monthsDefault ?? (mode === 'public' ? 2 : 4);

  const [months, setMonths] = useState<2 | 4 | 8 | 12>(initialMonths);
  const [currentMonth, setCurrentMonth] = useState<Date>(
    startOfMonth(startMonth ?? new Date()),
  );
  const [selStart, setSelStart] = useState<Date | null>(selectedRange?.start ?? null);
  const [selEnd, setSelEnd] = useState<Date | null>(selectedRange?.end ?? null);
  const [hoverEnd, setHoverEnd] = useState<Date | null>(null);
  const [activeItem, setActiveItem] = useState<CalendarItem | null>(null);

  // Sync external controlled selection (e.g. parent form clears the form)
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

  // Detect if the current selection overlaps any held day (which would make
  // both the booking and the block invalid).
  const selectionHasHeldOverlap = useMemo(() => {
    if (!selStart || !selEnd) return false;
    for (const it of items) {
      const isBlocking =
        it.kind === 'block' ||
        (it.kind === 'booking' && BLOCKING_BOOKING_STATUSES.includes(it.status));
      if (!isBlocking) continue;
      const itStart = parseYmd(it.start);
      const itEnd = parseYmd(it.end);
      // overlap iff !(itEnd <= selStart || itStart >= selEnd) — using closed-end selection
      // (selEnd is the chosen check-out / block-end, exclusive of nights occupied)
      if (!(itEnd.getTime() <= selStart.getTime() || itStart.getTime() >= selEnd.getTime())) {
        return true;
      }
    }
    return false;
  }, [selStart, selEnd, items]);

  // Public mode: fire onSelectRange whenever we have a valid two-day pair
  useEffect(() => {
    if (mode !== 'public') return;
    if (selStart && selEnd && !selectionHasHeldOverlap) {
      onSelectRange?.(selStart, selEnd);
    }
  }, [mode, selStart?.getTime(), selEnd?.getTime(), selectionHasHeldOverlap]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearSelection() {
    setSelStart(null);
    setSelEnd(null);
    setHoverEnd(null);
    onClearRange?.();
  }

  function handleDayClick(day: Date, owning: CalendarItem[]) {
    // Admin: clicking on an existing item → open action panel, abandon selection.
    if (mode === 'admin' && owning.length > 0) {
      // Prefer the most "interesting" item: block > held booking > soft booking
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

    // Public mode: don't allow clicks on held days (DayCell already disables).
    if (mode === 'public' && owning.length > 0) {
      return;
    }

    // Selection state machine
    if (!selStart || (selStart && selEnd)) {
      setSelStart(day);
      setSelEnd(null);
      setActiveItem(null);
      onClearRange?.();
      return;
    }
    if (day.getTime() <= selStart.getTime()) {
      // Clicking same or earlier day → restart from there
      setSelStart(day);
      setSelEnd(null);
      onClearRange?.();
      return;
    }
    setSelEnd(day);
  }

  // Render the month windows
  const monthWindows = Array.from({ length: months }, (_, i) => addMonths(currentMonth, i));
  const gridCols =
    months === 2 ? 'grid-cols-1 md:grid-cols-2' :
    months === 4 ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4' :
    months === 8 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
                   'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <div className="rounded-3xl bg-white border border-slate-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100 flex-wrap">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-4 h-4 text-ocean shrink-0" />
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400">
            {mode === 'public' ? 'Availability' : 'Calendar'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {mode === 'admin' && (
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

      {/* Body: grid + (admin) action panel */}
      <div className={`p-5 grid gap-5 ${activeItem ? 'lg:grid-cols-[1fr_320px]' : ''}`}>
        <div>
          <div className={`grid gap-x-8 gap-y-6 ${gridCols}`}>
            {monthWindows.map((m, i) => (
              <MonthGrid
                key={`${m.getFullYear()}-${m.getMonth()}-${i}`}
                month={m}
                items={items}
                mode={mode}
                today={today}
                selectionStart={selStart}
                selectionEnd={selEnd}
                hoverEnd={hoverEnd}
                onDayClick={handleDayClick}
                onDayHover={setHoverEnd}
              />
            ))}
          </div>

          {/* Selection summary + Clear */}
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

          {/* Conflict warning */}
          {selectionHasHeldOverlap && (
            <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-[12px] text-rose-900">
              Selected range overlaps a held booking or block. Pick a clear range.
            </div>
          )}

          {/* Admin: block confirmation */}
          {mode === 'admin' && slug && selStart && selEnd && !selectionHasHeldOverlap && !activeItem && (
            <BlockConfirmBar
              slug={slug}
              start={selStart}
              end={selEnd}
              onClear={clearSelection}
              onSuccess={clearSelection}
            />
          )}
        </div>

        {/* Admin action panel (right column on lg+, stacked on mobile) */}
        <AnimatePresence>
          {activeItem && (
            <div className="lg:relative">
              <BookingActionPanel item={activeItem} onClose={() => setActiveItem(null)} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
        <CalendarLegend mode={mode} />
      </div>
    </div>
  );
}

function fmt(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
