'use client';

import type { CalendarItem, CalendarMode } from '@/lib/calendar';
import { BOOKING_STATUS_STYLES, PROPERTY_BLOCK_STYLE, isBlockingStatus } from '@/lib/colors';
import { isSameDay, isWithinClosed, isWithinHalfOpen, parseYmd } from './dateUtils';

// ============================================================================
// One day in the calendar grid. Decides its own visual state from the items
// that cover it. Pure presentational + a single onClick.
//
// Visual hierarchy (most → least important):
//   1. Property block       → hatched dark fill
//   2. Held booking          → status color from BOOKING_STATUS_STYLES.cell
//   3. Non-blocking booking  → admin only: muted status color (request, invite, cancelled)
//   4. Selection range       → ring overlay
//   5. Selection start/end   → solid ocean dot
//   6. Past day              → low-opacity, not-allowed
//   7. Plain available       → hover ring
// ============================================================================

export type DayCellProps = {
  day: Date;
  /** Items overlapping this day. Pre-filtered by parent. */
  items: CalendarItem[];
  mode: CalendarMode;
  isPast: boolean;
  isOutOfMonth: boolean;
  selectionStart: Date | null;
  selectionEnd: Date | null;
  /** Hover preview while user has a start but no end yet. */
  hoverEnd: Date | null;
  onClick: (day: Date, items: CalendarItem[]) => void;
  onHover?: (day: Date | null) => void;
};

export default function DayCell({
  day,
  items,
  mode,
  isPast,
  isOutOfMonth,
  selectionStart,
  selectionEnd,
  hoverEnd,
  onClick,
  onHover,
}: DayCellProps) {
  // --- classify items covering this day ---
  // Bookings use half-open [start, end): the check-out day is NOT held by that
  // booking — it's the next guest's potential check-in. Blocks use the same
  // semantics. So we use isWithinHalfOpen for "is this day owned by item X".
  const owning = items.filter((it) =>
    isWithinHalfOpen(day, parseYmd(it.start), parseYmd(it.end)),
  );
  const block = owning.find((it) => it.kind === 'block');
  const heldBooking = owning.find(
    (it) => it.kind === 'booking' && isBlockingStatus(it.status),
  );
  const softBooking = owning.find(
    (it) => it.kind === 'booking' && !isBlockingStatus(it.status),
  );

  // public mode: invisible items (cancelled, request, invite) → treat as empty
  const visibleSoft = mode === 'admin' ? softBooking : undefined;

  const isHeld = !!block || !!heldBooking;
  const isSelectableForBlock = mode === 'admin' && !isPast && !isHeld;
  const isSelectableForBooking = mode === 'public' && !isPast && !isHeld;
  // Held cells are clickable in admin (open the action panel) but not in public.
  const isClickable = mode === 'admin' || isSelectableForBooking;

  // --- selection ---
  const isStart = selectionStart && isSameDay(day, selectionStart);
  const isEnd = selectionEnd && isSameDay(day, selectionEnd);
  const inRange = (() => {
    if (!selectionStart) return false;
    const end = selectionEnd ?? hoverEnd;
    if (!end) return false;
    if (end.getTime() < selectionStart.getTime()) return false;
    return isWithinClosed(day, selectionStart, end);
  })();

  // --- styles ---
  let bg = '';
  let text = 'text-slate-700';
  let cursor = 'cursor-default';
  let extra = '';

  if (isPast) {
    text = 'text-slate-300';
    cursor = 'cursor-not-allowed';
  } else if (block) {
    bg = PROPERTY_BLOCK_STYLE.cell;
    text = 'text-white';
    cursor = mode === 'admin' ? 'cursor-pointer' : 'cursor-not-allowed';
  } else if (heldBooking && heldBooking.kind === 'booking') {
    const s = BOOKING_STATUS_STYLES[heldBooking.status];
    bg = s.cell;
    cursor = mode === 'admin' ? 'cursor-pointer' : 'cursor-not-allowed';
  } else if (visibleSoft && visibleSoft.kind === 'booking') {
    // soft (request/invite/cancelled) only shows in admin mode, with reduced intensity
    const s = BOOKING_STATUS_STYLES[visibleSoft.status];
    bg = `${s.cell} opacity-60`;
    cursor = 'cursor-pointer';
  } else {
    cursor = isClickable ? 'cursor-pointer' : 'cursor-default';
  }

  if (inRange && !block && !heldBooking) {
    extra = 'ring-2 ring-inset ring-ocean/60 bg-ocean/10';
  }
  if (isStart || isEnd) {
    bg = 'bg-ocean text-white shadow-md shadow-ocean/30';
    text = 'text-white';
    extra = 'z-10 scale-105 font-bold';
  }

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={() => onClick(day, owning)}
      onMouseEnter={() => onHover?.(day)}
      onMouseLeave={() => onHover?.(null)}
      className={[
        'relative h-11 w-full flex items-center justify-center text-xs font-medium rounded-md transition-all',
        bg,
        text,
        cursor,
        extra,
        isOutOfMonth ? 'opacity-30' : '',
        isClickable && !isHeld && !inRange ? 'hover:bg-slate-100' : '',
        isClickable && isHeld ? 'hover:brightness-95' : '',
      ].filter(Boolean).join(' ')}
      aria-label={`${day.toDateString()}${isHeld ? ' (held)' : ''}`}
      title={
        block?.kind === 'block'
          ? `Blocked${block.reason ? ` — ${block.reason}` : ''}`
          : heldBooking?.kind === 'booking'
          ? `${heldBooking.label} (${heldBooking.status})`
          : visibleSoft?.kind === 'booking'
          ? `${visibleSoft.label} (${visibleSoft.status})`
          : isPast ? 'Past' : ''
      }
    >
      <span>{day.getDate()}</span>
      {/* tiny corner dot for held days, in case bg color contrast is too soft */}
      {isHeld && !isStart && !isEnd && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      )}
    </button>
  );
}
