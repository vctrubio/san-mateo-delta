'use client';

import type { CalendarItem } from '@/lib/calendar';
import DayCell from './DayCell';
import {
  WEEKDAY_LABELS_SHORT,
  daysInMonth,
  monthLabel,
  parseYmd,
  isWithinHalfOpen,
} from './dateUtils';

// ============================================================================
// One month, 7-column grid. Renders a fixed 6-row layout (42 cells) so months
// of different lengths align visually when stacked.
// ============================================================================

export type MonthGridProps = {
  month: Date;
  items: CalendarItem[];
  admin: boolean;
  today: Date;
  selectionStart: Date | null;
  selectionEnd: Date | null;
  hoverEnd: Date | null;
  onDayClick: (day: Date, owning: CalendarItem[]) => void;
  onDayHover?: (day: Date | null) => void;
};

export default function MonthGrid({
  month,
  items,
  admin,
  today,
  selectionStart,
  selectionEnd,
  hoverEnd,
  onDayClick,
  onDayHover,
}: MonthGridProps) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = firstOfMonth.getDay();
  const totalDays = daysInMonth(firstOfMonth);
  const cells: { day: Date; outOfMonth: boolean }[] = [];

  // Leading filler from previous month
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({
      day: new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), -i),
      outOfMonth: true,
    });
  }
  // Days in this month
  for (let i = 1; i <= totalDays; i++) {
    cells.push({
      day: new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), i),
      outOfMonth: false,
    });
  }
  // Trailing filler so we always render 6 rows × 7 cols = 42 cells
  while (cells.length < 42) {
    const last = cells[cells.length - 1].day;
    cells.push({
      day: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      outOfMonth: true,
    });
  }

  // Pre-filter items to those overlapping this month (cheap optimisation).
  const monthStart = firstOfMonth;
  const monthEnd = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() + 1, 1);
  const monthItems = items.filter((it) => {
    const s = parseYmd(it.start);
    const e = parseYmd(it.end);
    return s.getTime() < monthEnd.getTime() && e.getTime() > monthStart.getTime();
  });

  return (
    <div className="flex-1 min-w-0">
      <h4 className="text-[11px] font-mono uppercase tracking-[0.3em] text-slate-500 mb-3 text-center">
        {monthLabel(month)}
      </h4>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS_SHORT.map((d) => (
          <div
            key={d}
            className="text-[9px] font-mono text-slate-300 text-center py-1.5 uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
        {cells.map(({ day, outOfMonth }, idx) => {
          const owning = monthItems.filter((it) =>
            isWithinHalfOpen(day, parseYmd(it.start), parseYmd(it.end)),
          );
          return (
            <DayCell
              key={idx}
              day={day}
              items={owning}
              admin={admin}
              isPast={day.getTime() < today.getTime()}
              isOutOfMonth={outOfMonth}
              selectionStart={selectionStart}
              selectionEnd={selectionEnd}
              hoverEnd={hoverEnd}
              onClick={onDayClick}
              onHover={onDayHover}
            />
          );
        })}
      </div>
    </div>
  );
}
