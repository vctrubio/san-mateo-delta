import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

// Master table for /admin/* list views. ONE component used by properties,
// bookings, invitations, payments, users.
//
// Visual model — "header + stack of cards":
//   * The header row is transparent (matches the page background) so it reads
//     like floating column labels, not table chrome.
//   * Each row is its own rounded white card with a soft border + tiny shadow.
//   * `space-y-2` between rows breathes — gives depth and lets hover lift the
//     individual row instead of changing a shared container.
//
// Built as CSS grid (not <table>) so an entire row can be a single Link
// without fighting <a>-can't-wrap-<tr> semantics. Stretched-link pattern: the
// Link sits `absolute inset-0` *after* the cells in DOM order so it paints on
// top and captures clicks anywhere on the row. Cell-internal clickable
// elements opt back to top with `relative z-10`.

export type AdminTableColumn<T> = {
  /** Stable react key for the column. */
  key: string;
  /** Header text — kept as a plain string so headers stay monochromatic. */
  header: string;
  /** Defaults to left. */
  align?: 'left' | 'right';
  /** Grid-template-column unit. Default: `minmax(0,1fr)`. Examples: `'80px'`, `'2fr'`. */
  width?: string;
  render: (row: T) => React.ReactNode;
};

export type AdminTableProps<T> = {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /** Makes each row a link to a detail route. Adds a chevron column at the end. */
  rowHref?: (row: T) => string;
  emptyMessage?: string;
};

function template<T>(columns: AdminTableColumn<T>[], hasHref: boolean) {
  const cols = columns.map((c) => c.width ?? 'minmax(0,1fr)').join(' ');
  return hasHref ? `${cols} 24px` : cols;
}

export default function AdminTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  emptyMessage = 'Nothing here yet.',
}: AdminTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200/80 p-10 text-center text-sm text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {emptyMessage}
      </div>
    );
  }

  const grid = template(columns, !!rowHref);

  return (
    <div>
      {/* Floating column labels — transparent, reads as part of the page bg */}
      <div
        className="grid gap-x-6 px-6 pb-3 text-xs font-mono uppercase tracking-[0.22em] text-slate-400"
        style={{ gridTemplateColumns: grid }}
      >
        {columns.map((c) => (
          <div key={c.key} className={c.align === 'right' ? 'text-right' : ''}>
            {c.header}
          </div>
        ))}
        {rowHref && <div />}
      </div>

      {/* Stack of cards — each row is its own surface */}
      <div className="space-y-2">
        {rows.map((row) => {
          const href = rowHref?.(row);
          return (
            <div
              key={rowKey(row)}
              className="group relative grid gap-x-6 px-6 py-5 items-center rounded-2xl bg-white border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300/90 hover:shadow-[0_4px_16px_-4px_rgba(15,23,42,0.10)] hover:-translate-y-px transition-all duration-150"
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
              {href && (
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
              )}
              {href && (
                <Link href={href} className="absolute inset-0 rounded-2xl" aria-label="Open">
                  <span className="sr-only">Open detail</span>
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
