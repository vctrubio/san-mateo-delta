// ============================================================================
// Typed parsers for Next 16 `searchParams: Promise<…>` on server pages. Each
// admin list page resolves the promise then passes it through these helpers
// so the rest of the page is dealing with clean, typed values.
//
// Tolerant of arrays (a key showing up multiple times) — Next 16 hands those
// in as `string[]`. We always read the first occurrence.
// ============================================================================

export type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export function asString(v: string | string[] | undefined): string | undefined {
  const s = first(v);
  if (typeof s !== 'string') return undefined;
  const trimmed = s.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Comma-separated list. Returns `undefined` for empty/missing. */
export function asStringList(v: string | string[] | undefined): string[] | undefined {
  const s = asString(v);
  if (!s) return undefined;
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

export function asInt(v: string | string[] | undefined, fallback: number): number {
  const s = first(v);
  if (typeof s !== 'string') return fallback;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Returns YYYY-MM-DD if the value looks like a date, otherwise undefined. */
export function asDate(v: string | string[] | undefined): string | undefined {
  const s = asString(v);
  if (!s) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

export function asBool(v: string | string[] | undefined): boolean | undefined {
  const s = asString(v);
  if (s === undefined) return undefined;
  if (s === 'true' || s === '1' || s === 'on' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'off' || s === 'no') return false;
  return undefined;
}

// ----------------------------------------------------------------------------
// Pagination

/** Shape returned by every paginated list helper (`listBookings`, `listPayments`, `listUsers`). */
export type Paginated<T> = { rows: T[]; total: number };

export type Pagination = {
  page: number;
  limit: number;
  offset: number;
};

export const DEFAULT_PAGE_LIMIT = 25;

export function paginate(args: { page?: number; limit?: number }): Pagination {
  const limit = Math.max(1, Math.min(200, args.limit ?? DEFAULT_PAGE_LIMIT));
  const page = Math.max(1, args.page ?? 1);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

