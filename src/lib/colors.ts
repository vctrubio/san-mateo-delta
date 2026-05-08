import type { BookingStatus } from '@db/enums';

// ============================================================================
// Single source of truth for booking-status colors and the "blocked" treatment.
// Imported by StatusBadge, BookingsTable, the Calendar component, the schema
// debug panel, and any future surface that visualises booking state.
//
// Each style entry exposes the SAME shape for every status so callers can pick
// whichever facet they need (`dot` for legend bullets, `chip` for pills,
// `cell` for full-day calendar squares, `ring` for cards).
//
// Tailwind classes are concrete strings (no template interpolation) so the
// JIT compiler can see them.
// ============================================================================

export type StatusStyle = {
  /** Human-readable label for legends and toolbars. */
  label: string;
  /** Solid bg class for a small dot or marker. */
  dot: string;
  /** Pill / badge: bg + text classes. */
  chip: string;
  /** Full-day calendar cell background (subtler than `chip` since it tiles). */
  cell: string;
  /** Card or row ring color. */
  ring: string;
  /** Stronger text class for inline references (e.g. "confirmed by …"). */
  text: string;
};

export const BOOKING_STATUS_STYLES: Record<BookingStatus, StatusStyle> = {
  request: {
    label: 'Request',
    dot:   'bg-amber-400',
    chip:  'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
    cell:  'bg-amber-100/80 text-amber-900',
    ring:  'ring-amber-200',
    text:  'text-amber-700',
  },
  invite: {
    label: 'Invite',
    dot:   'bg-violet-400',
    chip:  'bg-violet-50 text-violet-800 ring-1 ring-violet-200',
    cell:  'bg-violet-100/80 text-violet-900',
    ring:  'ring-violet-200',
    text:  'text-violet-700',
  },
  confirmed: {
    label: 'Confirmed',
    dot:   'bg-ocean',
    chip:  'bg-ocean/10 text-ocean ring-1 ring-ocean/30',
    cell:  'bg-ocean/25 text-ocean',
    ring:  'ring-ocean/30',
    text:  'text-ocean',
  },
  checked_in: {
    label: 'Checked-in',
    dot:   'bg-emerald-500',
    chip:  'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
    cell:  'bg-emerald-200/80 text-emerald-900',
    ring:  'ring-emerald-300',
    text:  'text-emerald-700',
  },
  checked_out: {
    label: 'Checked-out',
    dot:   'bg-slate-300',
    chip:  'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    cell:  'bg-slate-200/80 text-slate-700',
    ring:  'ring-slate-200',
    text:  'text-slate-500',
  },
  cancelled: {
    label: 'Cancelled',
    dot:   'bg-rose-400',
    chip:  'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    cell:  'bg-rose-100/80 text-rose-800',
    ring:  'ring-rose-200',
    text:  'text-rose-700',
  },
};

// "Blocked" is not a booking status — it's a property_blocks row. Same shape so
// the calendar code can treat it uniformly.
export const PROPERTY_BLOCK_STYLE: StatusStyle = {
  label: 'Blocked',
  dot:   'bg-slate-800',
  chip:  'bg-slate-900 text-white ring-1 ring-slate-700',
  // Diagonal hatch pattern so blocks read as "host-imposed" not "booking".
  cell:  'bg-slate-700 text-white [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.18)_4px,rgba(255,255,255,0.18)_8px)]',
  ring:  'ring-slate-300',
  text:  'text-slate-700',
};

// The "held" set: which booking statuses the SQL exclusion constraint
// (`no_overlap_when_held`) treats as exclusive holds, and therefore which
// statuses the public calendar must mark as unavailable. Anything NOT in this
// set (request, invite, cancelled) is invisible/available on the public side.
//
// Mirror this list with schema.sql `no_overlap_when_held`. If you change the
// SQL, change this constant and re-run `bun db:init`.
export const BLOCKING_BOOKING_STATUSES: readonly BookingStatus[] = [
  'confirmed',
  'checked_in',
  'checked_out',
] as const;

export function isBlockingStatus(s: BookingStatus): boolean {
  return BLOCKING_BOOKING_STATUSES.includes(s);
}

// ============================================================================
// Property identity. The 4 estate properties are fixed — this is the canonical
// list. Chart components reference colors directly via CSS variables defined
// in src/app/globals.css (e.g. `fill="var(--color-property-levante)"`), so
// changing the palette is one file to edit.
// ============================================================================

export const PROPERTY_SLUGS = ['levante', 'estrecho', 'marea', 'cala'] as const;
export type PropertySlug = (typeof PROPERTY_SLUGS)[number];

export const PROPERTY_LABELS: Record<PropertySlug, string> = {
  levante:  'Levante',
  estrecho: 'Estrecho',
  marea:    'Marea',
  cala:     'Cala',
};
