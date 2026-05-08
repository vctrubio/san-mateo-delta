// Centralised date formatting. Everything user-facing renders dates as
// "8th May 2026" — day with ordinal suffix, full month name, 4-digit year.
// Range collapses to "8th → 11th May 2026" when both dates fall in the same
// month + year. Time uses 24h "HH:mm". Database storage stays ISO/yyyy-mm-dd
// — these helpers are display-only.
//
// Accepts either a JS Date, a Date.parse-able string, or `null`/undefined
// (returns '—' so consumers don't have to guard).

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function ordinal(n: number): string {
  // 11/12/13 are always "th" regardless of last digit.
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function toDate(input: Date | string | null | undefined): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  // Parse YYYY-MM-DD as local-midnight to avoid TZ-shifting check-in dates.
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const t = Date.parse(input);
  return Number.isFinite(t) ? new Date(t) : null;
}

/** "8th May 2026". Returns "—" for null/invalid input. */
export function fmtDate(input: Date | string | null | undefined): string {
  const d = toDate(input);
  if (!d) return '—';
  return `${ordinal(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * "8th May 2026 → 11th May 2026". Collapses to "8th → 11th May 2026" when
 * both dates fall in the same month and year, since the month + year is
 * implied by the right side.
 */
export function fmtDateRange(
  from: Date | string | null | undefined,
  to: Date | string | null | undefined,
): string {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return `${fmtDate(from)} → ${fmtDate(to)}`;
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return `${ordinal(a.getDate())} → ${ordinal(b.getDate())} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }
  return `${fmtDate(a)} → ${fmtDate(b)}`;
}

/** "8th May 2026, 17:30". 24h time, en-GB-ish. */
export function fmtDateTime(input: Date | string | null | undefined): string {
  const d = toDate(input);
  if (!d) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${fmtDate(d)}, ${hh}:${mm}`;
}

/** Number of nights between check-in and check-out (half-open: out − in). */
export function nightsBetween(
  from: Date | string | null | undefined,
  to: Date | string | null | undefined,
): number {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return 0;
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}
