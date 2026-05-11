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

/** Today's local date as YYYY-MM-DD. Centralised so every "is this today?"
 *  comparison uses the same boundary (start of local day). */
export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Add `days` to a YYYY-MM-DD string, returning YYYY-MM-DD. Local-time math. */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
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

// Relative date language used in headers / pill subs. Rules:
//   today < check-in              → "in N days" / "tomorrow" / "check-in today"
//   check-in ≤ today < check-out  → "day X of N"
//   today ≥ check-out             → "ended N days ago" / "ended yesterday" /
//                                   "checked out today"
// Inputs are YYYY-MM-DD strings (or anything `toDate` accepts); comparisons
// are at day granularity in the browser/server's local zone.
export function relativeStayLabel(
  startYmd: string | Date | null | undefined,
  endYmd: string | Date | null | undefined,
): string {
  const today = startOfLocalDay(new Date());
  const start = toDate(startYmd);
  const end   = toDate(endYmd);
  if (!start || !end) return '—';
  const day = 86_400_000;
  const totalNights = Math.round((end.getTime() - start.getTime()) / day);

  if (today.getTime() < start.getTime()) {
    const days = Math.round((start.getTime() - today.getTime()) / day);
    if (days === 0) return 'check-in today';
    if (days === 1) return 'tomorrow';
    return `in ${days} days`;
  }
  if (today.getTime() < end.getTime()) {
    const elapsed = Math.round((today.getTime() - start.getTime()) / day);
    return `day ${elapsed + 1} of ${totalNights}`;
  }
  const days = Math.round((today.getTime() - end.getTime()) / day);
  if (days === 0) return 'checked out today';
  if (days === 1) return 'ended yesterday';
  return `ended ${days} days ago`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// "How far through the stay are we?" — 0..100 percentage. Pre-stay → 0,
// mid-stay → fractional position between check-in and check-out, post-stay
// → 100. Used by the booking detail page's BOOKING card to fill a thin
// progress bar without showing a meaningless "0% empty" or "100% full" bar.
export function computeStayProgress(
  checkInYmd: string | Date | null | undefined,
  checkOutYmd: string | Date | null | undefined,
): number {
  const checkIn  = toDate(checkInYmd);
  const checkOut = toDate(checkOutYmd);
  if (!checkIn || !checkOut) return 0;
  const today = startOfLocalDay(new Date()).getTime();
  const total = checkOut.getTime() - checkIn.getTime();
  if (total <= 0) return 0;
  if (today <= checkIn.getTime())  return 0;
  if (today >= checkOut.getTime()) return 100;
  return Math.round(((today - checkIn.getTime()) / total) * 100);
}

// Single-date relative label — "in 5 days" / "today" / "5 days ago".
// Use this when you have one anchor date and want to express its position
// relative to today (created_at, check-in, check-out, etc.). For a stay
// range with a "day X of N" mid-stay state, use `relativeStayLabel` above.
export function relativeFromToday(input: string | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return '—';
  const day = 86_400_000;
  const t = startOfLocalDay(new Date()).getTime();
  const target = startOfLocalDay(d).getTime();
  const diff = Math.round((target - t) / day);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 0)  return `in ${diff} days`;
  return `${-diff} days ago`;
}
