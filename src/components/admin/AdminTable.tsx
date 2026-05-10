import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

// No 'use client' here — AdminTable is a "shared" component. When a server
// component imports it (e.g. /admin/bookings/[id] passing function-valued
// `columns[].render` and `rowKey`), it stays server-rendered and functions
// stay on the server. When a client component imports it (e.g. the
// BookingsExplorer with `onRowClick`), it joins the client bundle and
// functions live there. Adding `'use client'` here breaks the first case
// because functions can't cross the server→client RSC boundary.

// ============================================================================
// AdminTable — the dense, mobile-aware table used across every /admin/* list.
//
// Visual model — "single bordered card, rows divided":
//   * One outer card with a slate-50 header bar and divide-y rows. Reads as
//     a real table, not a stack of cards.
//   * Desktop: rows render as a CSS grid so cells line up across the table
//     and a chevron auto-renders on the right when the row is interactive.
//   * Mobile (< sm): each row stacks into a labelled grid (column header
//     above each value) so dense numeric rows stay scannable on a phone.
//
// Interactivity — pick one:
//   * `rowHref(row)`     wraps the row in a <Link>. Whole row is the target.
//   * `onRowClick(row)`  makes the row a <button>. Use this for in-page
//                        actions (e.g. opening a modal). Mutually exclusive
//                        with rowHref — if both are passed, rowHref wins.
//   * Neither            non-interactive row, no chevron, no hover lift.
//
// Built as CSS grid (not <table>) on desktop because that keeps the row a
// single Link/button — no `<a>` wrapping `<tr>` semantics fight, and the
// entire row is one tap target.
// ============================================================================

export type AdminTableColumn<T> = {
  /** Stable react key for the column. */
  key: string;
  /** Header text. Empty string is allowed for action columns. */
  header: string;
  /** Defaults to left. */
  align?: 'left' | 'right';
  /** Grid-template-column unit. Default: `minmax(0,1fr)`. Examples: `'80px'`, `'2fr'`. */
  width?: string;
  /** Hide on mobile. Useful for low-priority columns when stacking gets long. */
  hideOnMobile?: boolean;
  render: (row: T) => React.ReactNode;
};

export type AdminTableProps<T> = {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /** Wraps each row in a Link to a detail route. */
  rowHref?: (row: T) => string;
  /** Callback invoked when the row is clicked. Use for in-page actions
   *  (e.g. opening a modal). Ignored if `rowHref` is also set. */
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
};

function templateForGrid<T>(columns: AdminTableColumn<T>[], hasAction: boolean) {
  const cols = columns.map((c) => c.width ?? 'minmax(0,1fr)').join(' ');
  return hasAction ? `${cols} 24px` : cols;
}

export default function AdminTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  onRowClick,
  emptyMessage = 'Nothing here yet.',
}: AdminTableProps<T>) {
  const interactive = Boolean(rowHref || onRowClick);
  const grid = templateForGrid(columns, interactive);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {/* Desktop header — slate-50 bar above the rows. Hidden on mobile
          since each cell carries its own header in the stacked layout. */}
      <div
        className="hidden sm:grid gap-x-4 px-4 py-2.5 bg-slate-50/70 border-b border-slate-200 text-xs font-mono uppercase tracking-[0.22em] text-slate-400"
        style={{ gridTemplateColumns: grid }}
      >
        {columns.map((c) => (
          <div key={c.key} className={c.align === 'right' ? 'text-right' : ''}>
            {c.header}
          </div>
        ))}
        {interactive && <div className="sr-only">Action</div>}
      </div>

      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <AdminTableRow
            key={rowKey(row)}
            row={row}
            columns={columns}
            grid={grid}
            href={rowHref?.(row)}
            onClick={onRowClick && !rowHref ? () => onRowClick(row) : undefined}
          />
        ))}
      </ul>
    </div>
  );
}

// ─── Row renderer ───────────────────────────────────────────────────────────

function AdminTableRow<T>({
  row, columns, grid, href, onClick,
}: {
  row: T;
  columns: AdminTableColumn<T>[];
  grid: string;
  href?: string;
  onClick?: () => void;
}) {
  const interactive = Boolean(href || onClick);

  // Body — same content for desktop and mobile. CSS handles the layout
  // switch via grid (≥ sm) vs stacked dl (< sm).
  const inner = (
    <>
      {/* Desktop: grid row */}
      <div
        className="hidden sm:grid gap-x-4 items-center px-4 py-2.5 group"
        style={{ gridTemplateColumns: grid }}
      >
        {columns.map((c) => (
          <div
            key={c.key}
            className={`min-w-0 ${c.align === 'right' ? 'text-right' : ''}`}
          >
            {c.render(row)}
          </div>
        ))}
        {interactive && (
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
        )}
      </div>

      {/* Mobile: labelled stack. Each column becomes a row in a 2-col
          dl-style layout, with the column header as the eyebrow on the
          left and the rendered value on the right. Header-less columns
          (e.g. action cells) skip the eyebrow. */}
      <dl
        className="sm:hidden grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 px-4 py-3"
      >
        {columns.filter((c) => !c.hideOnMobile).map((c) => (
          <div key={c.key} className="contents">
            <dt className="text-xs font-mono uppercase tracking-widest text-slate-400 self-baseline">
              {c.header}
            </dt>
            <dd className="min-w-0 self-baseline">{c.render(row)}</dd>
          </div>
        ))}
      </dl>
    </>
  );

  // Wrap in <Link> or <button> based on caller's intent.
  if (href) {
    return (
      <li>
        <Link
          href={href}
          className="block hover:bg-slate-50/70 transition-colors"
        >
          {inner}
        </Link>
      </li>
    );
  }

  if (onClick) {
    return (
      <li>
        <button
          type="button"
          onClick={onClick}
          className="block w-full text-left hover:bg-slate-50/70 transition-colors"
        >
          {inner}
        </button>
      </li>
    );
  }

  return <li>{inner}</li>;
}
