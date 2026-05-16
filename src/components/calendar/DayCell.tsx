'use client';

import type { CalendarItem } from '@/lib/calendar';
import { BOOKING_STATUS_STYLES, PROPERTY_BLOCK_STYLE, isBlockingStatus } from '@/lib/colors';
import { isSameDay, isWithinClosed, isWithinHalfOpen, parseYmd } from './dateUtils';

// ============================================================================
// One day in the calendar grid. Decides its own visual state from the items
// that cover it. Pure presentational + a single onClick.
//
// Two modes share this component:
//
//   ADMIN — wants to know *why* a day is held. Property block → hatched
//   dark; held booking → its status color (ocean for confirmed,
//   emerald for checked_in, slate for checked_out); non-blocking
//   booking → muted status color.
//
//   PUBLIC — the guest has no business reading status colors. Every
//   held day (block or any blocking booking) renders as a single
//   "unavailable" hatch, matching the legend's three states:
//   Selected / Available / Unavailable. No corner dots, no per-status
//   tinting — just "you can't pick this day".
//
// Visual hierarchy (most → least important):
//   1. Property block / public-mode held → hatched dark fill (unavailable)
//   2. Admin held booking          → status color from BOOKING_STATUS_STYLES.cell
//   3. Admin non-blocking booking  → muted status color (request, invite, cancelled)
//   4. Selection range             → ring overlay
//   5. Selection start/end         → solid ocean dot
//   6. Past day                    → low-opacity, not-allowed
//   7. Plain available             → hover ring
// ============================================================================

// Public-mode unavailable cell — same diagonal hatch the block uses, but
// keyed off the slate palette so it reads as a hard "no" without
// pretending to be a host-imposed block. One look for every reason a
// day is held: confirmed, checked_in, checked_out, block — all the
// same to the guest.
const PUBLIC_UNAVAILABLE_CELL =
  'bg-slate-200 text-slate-400 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(148,163,184,0.45)_3px,rgba(148,163,184,0.45)_6px)]';

export type DayCellProps = {
  day: Date;
  /** Items overlapping this day. Pre-filtered by parent. */
  items: CalendarItem[];
  admin: boolean;
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
  admin,
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
  const visibleSoft = admin ? softBooking : undefined;

  const isHeld = !!block || !!heldBooking;
  const isSelectableForBooking = !admin && !isPast && !isHeld;
  // Held cells are clickable in admin (open the action panel) but not in public.
  const isClickable = admin || isSelectableForBooking;

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
  } else if (!admin && isHeld) {
    // Public mode: collapse every "held" reason (block, confirmed,
    // checked_in, checked_out) into a single unavailable look. Guests
    // don't read status colors.
    bg = PUBLIC_UNAVAILABLE_CELL;
    text = '';
    cursor = 'cursor-not-allowed';
  } else if (block) {
    bg = PROPERTY_BLOCK_STYLE.cell;
    text = 'text-white';
    cursor = 'cursor-pointer';
  } else if (heldBooking && heldBooking.kind === 'booking') {
    const s = BOOKING_STATUS_STYLES[heldBooking.status];
    bg = s.cell;
    cursor = 'cursor-pointer';
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
      {/* Admin-only corner dot for held days, in case bg color contrast
          is too soft. Public mode already has the hatch — no extra mark. */}
      {admin && isHeld && !isStart && !isEnd && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      )}
    </button>
  );
}
