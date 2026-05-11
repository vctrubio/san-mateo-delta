'use client';

import { useMemo } from 'react';
import type { CalendarItem } from '@/lib/calendar';
import {
  BLOCKING_BOOKING_STATUSES,
  BOOKING_STATUS_STYLES,
  PROPERTY_BLOCK_STYLE,
} from '@/lib/colors';
import {
  addDays,
  isSameDay,
  isWithinClosed,
  isWithinHalfOpen,
  parseYmd,
  startOfDay,
  MONTH_LABELS,
} from './dateUtils';

// ============================================================================
// GanttStrip — one row per property, days flow horizontally. Pure scanner +
// booking-clicker for the all-properties admin view.
//
// Per-day cell color (most → least important):
//   1. Property block           → slate-700 hatch     (clickable)
//   2. Held booking             → status dot color    (clickable)
//   3. Soft booking (req/inv)   → muted dot @ 50%     (clickable)
//   4. Cancelled                → treated as available (no fill, not clickable)
//   5. Available                → faint slate         (not clickable)
//
// Two interactive elements per row:
//   - The slug label on the left  → fires `onSelectProperty(slug)` to focus
//                                    the calendar below. The rest of the row
//                                    is non-interactive for selection.
//   - Per-day item cells           → fire `onSelectItem(item, slug)` to open
//                                    the booking action modal.
//
// `activeSlug` is still accepted so the row matching the focused property
// can render with a soft highlight, and `selection` so the in-progress range
// from the active Calendar is mirrored on its row.
// ============================================================================

export type GanttProperty = {
  slug: string;
  label: string;
};

export type GanttStripProps = {
  properties: GanttProperty[];
  itemsBySlug: Record<string, CalendarItem[]>;
  /** First day to render. Defaults to today. */
  startDate?: Date;
  /** Number of days to render. Defaults to 90 (~3 months). */
  days?: number;
  /** Highlights the row matching the focused property. Read-only signal. */
  activeSlug?: string | null;
  /** Fires when an admin clicks the slug label on the left of a row. The
   *  rest of the row is non-interactive for property selection — only this
   *  label and the per-day item cells trigger anything. */
  onSelectProperty?: (slug: string) => void;
  /** Fires when an admin clicks a day cell that covers an item. */
  onSelectItem?: (item: CalendarItem, slug: string) => void;
  /** Echoes the per-property Calendar selection on its row. */
  selection?: { slug: string; start: Date; end: Date | null } | null;
};

export default function GanttStrip({
  properties,
  itemsBySlug,
  startDate,
  days = 90,
  activeSlug,
  onSelectProperty,
  onSelectItem,
  selection,
}: GanttStripProps) {
  const start = useMemo(() => startOfDay(startDate ?? new Date()), [startDate]);
  const today = useMemo(() => startOfDay(new Date()), []);

  const dayList = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < days; i++) out.push(addDays(start, i));
    return out;
  }, [start, days]);

  const monthBands = useMemo(() => {
    const bands: { label: string; span: number; key: string }[] = [];
    for (const d of dayList) {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const last = bands[bands.length - 1];
      if (!last || last.key !== key) {
        bands.push({
          key,
          label: `${MONTH_LABELS[d.getMonth()].slice(0, 3)} ${d.getFullYear() % 100}`,
          span: 1,
        });
      } else {
        last.span += 1;
      }
    }
    return bands;
  }, [dayList]);

  const gridTemplate = `120px repeat(${dayList.length}, minmax(0, 1fr))`;

  return (
    <div className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[640px] px-5 py-4">
          {/* Month band header */}
          <div
            className="grid items-end gap-px text-[9px] font-mono uppercase tracking-widest text-slate-400 mb-1"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="sticky left-0 z-10 bg-white" />
            {monthBands.map((b) => (
              <div
                key={b.key}
                className="border-l border-slate-100 pl-1.5 truncate"
                style={{ gridColumn: `span ${b.span}` }}
              >
                {b.label}
              </div>
            ))}
          </div>

          {/* Property rows */}
          {properties.map((p) => {
            const items = itemsBySlug[p.slug] ?? [];
            const isActive = p.slug === activeSlug;
            const rowSelection = selection?.slug === p.slug ? selection : null;
            return (
              <div
                key={p.slug}
                className={`grid items-center gap-px py-1.5 rounded-lg ${
                  isActive ? 'bg-ocean/5' : ''
                }`}
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {onSelectProperty ? (
                  <button
                    type="button"
                    onClick={() => onSelectProperty(p.slug)}
                    aria-pressed={isActive}
                    className={`sticky left-0 z-10 bg-white pl-5 pr-3 py-1 text-left text-[11px] font-mono uppercase tracking-widest truncate transition-colors ${
                      isActive
                        ? 'text-slate-900 font-bold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                ) : (
                  <span
                    className={`sticky left-0 z-10 bg-white pl-5 pr-3 py-1 text-left text-[11px] font-mono uppercase tracking-widest truncate ${
                      isActive ? 'text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    {p.label}
                  </span>
                )}
                {dayList.map((day) => (
                  <DayBar
                    key={day.getTime()}
                    day={day}
                    items={items}
                    today={today}
                    selection={rowSelection}
                    onSelectItem={
                      onSelectItem
                        ? (item) => onSelectItem(item, p.slug)
                        : undefined
                    }
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------

function DayBar({
  day,
  items,
  today,
  selection,
  onSelectItem,
}: {
  day: Date;
  items: CalendarItem[];
  today: Date;
  selection: { start: Date; end: Date | null } | null;
  onSelectItem?: (item: CalendarItem) => void;
}) {
  const owning = items.filter((it) =>
    isWithinHalfOpen(day, parseYmd(it.start), parseYmd(it.end)),
  );
  const block = owning.find((it) => it.kind === 'block');
  const held = owning.find(
    (it) => it.kind === 'booking' && BLOCKING_BOOKING_STATUSES.includes(it.status),
  );
  const soft = owning.find(
    (it) =>
      it.kind === 'booking' &&
      !BLOCKING_BOOKING_STATUSES.includes(it.status) &&
      it.status !== 'cancelled',
  );

  const isPast = day.getTime() < today.getTime();
  const isToday = isSameDay(day, today);

  let fill = 'bg-slate-100';
  let label = day.toDateString();
  let target: CalendarItem | null = null;

  if (block) {
    fill = PROPERTY_BLOCK_STYLE.cell;
    target = block;
    label = `Block${block.kind === 'block' && block.reason ? ` · ${block.reason}` : ''} — ${day.toDateString()}`;
  } else if (held && held.kind === 'booking') {
    fill = BOOKING_STATUS_STYLES[held.status].dot;
    target = held;
    label = `${held.label} (${held.status}) — ${day.toDateString()}`;
  } else if (soft && soft.kind === 'booking') {
    fill = `${BOOKING_STATUS_STYLES[soft.status].dot} opacity-50`;
    target = soft;
    label = `${soft.label} (${soft.status}) — ${day.toDateString()}`;
  }

  const inSelection = (() => {
    if (!selection) return false;
    const end = selection.end ?? selection.start;
    if (end.getTime() < selection.start.getTime()) return false;
    return isWithinClosed(day, selection.start, end);
  })();

  const className = [
    'h-5 rounded-[2px]',
    fill,
    isPast && !target ? 'opacity-30' : '',
    inSelection ? 'ring-2 ring-inset ring-ocean shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]' : '',
    isToday ? 'outline outline-1 outline-ocean/60' : '',
    target && onSelectItem ? 'cursor-pointer hover:brightness-110' : '',
  ].filter(Boolean).join(' ');

  if (target && onSelectItem) {
    return (
      <button
        type="button"
        onClick={() => onSelectItem(target)}
        className={className}
        aria-label={label}
        title={label}
      />
    );
  }

  return <span className={className} aria-label={label} title={label} />;
}
