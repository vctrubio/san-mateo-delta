// Native Date helpers used across the Calendar components. Kept here so the
// component files don't repeat themselves and so we don't need date-fns.

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseYmd(s: string): Date {
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, m - 1, day);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

/** End-exclusive: returns true iff `day` is in `[start, end)`. */
export function isWithinHalfOpen(day: Date, start: Date, end: Date): boolean {
  return day.getTime() >= start.getTime() && day.getTime() < end.getTime();
}

/** End-inclusive: returns true iff `day` is in `[start, end]`. */
export function isWithinClosed(day: Date, start: Date, end: Date): boolean {
  return day.getTime() >= start.getTime() && day.getTime() <= end.getTime();
}

export function differenceInDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export const MONTH_LABELS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
] as const;

export const WEEKDAY_LABELS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'] as const;

export function monthLabel(d: Date): string {
  return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}
