'use client';

import { ResponsiveContainer } from 'recharts';
import type { ReactElement, ReactNode } from 'react';

// ============================================================================
// Shadcn-style minimal chart primitives. We don't need the full shadcn
// chart.tsx (it's heavy on context-passing and theme switching we don't use).
// What we DO need:
//   - ChartContainer: a sized ResponsiveContainer wrapper so every chart on
//     the dashboard renders at the same height with a consistent background.
//   - ChartTooltipBody: a styled recharts Tooltip content, matching the rest
//     of the design system (rounded card, mono labels, tabular numbers).
// Colors come from CSS vars defined in src/app/globals.css; charts pass them
// via `fill="var(--color-...)"` directly.
// ============================================================================

export function ChartContainer({
  height = 240,
  children,
  className = '',
}: {
  height?: number;
  children: ReactElement;
  className?: string;
}) {
  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

// ----------------------------------------------------------------------------
// ChartTooltipBody — drop into recharts <Tooltip content={ChartTooltipBody} />.
// Renders a small card with a header (the X-axis label) and a list of
// (color dot, label, value) rows.

// Recharts hands tooltip payload entries with a wide `value` (single OR an
// array tuple for stacked series) and `dataKey` that can be a function.
// We accept the wider shape and coerce in the body so consumers can keep
// treating it as primitives.
export type TooltipPayloadItem = {
  name?: string | number;
  value?: number | string | ReadonlyArray<number | string>;
  color?: string;
  fill?: string;
  dataKey?: string | number | ((obj: unknown) => unknown);
  payload?: Record<string, unknown>;
};

export type TooltipBodyProps = {
  active?: boolean;
  label?: ReactNode;
  /** Recharts hands this in as a readonly tuple; we accept the looser shape. */
  payload?: ReadonlyArray<TooltipPayloadItem>;
  /** Optional value formatter — defaults to identity. */
  format?: (value: number | string, name: string) => string;
  /** Optional label override for each series. */
  nameMap?: Record<string, string>;
};

export function ChartTooltipBody({
  active,
  label,
  payload,
  format = (v) => String(v),
  nameMap,
}: TooltipBodyProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl bg-white border border-slate-100 shadow-lg shadow-slate-200/60 p-3 min-w-[140px]">
      {label !== undefined && label !== '' && (
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1.5">
          {label}
        </p>
      )}
      <ul className="space-y-1">
        {payload.map((p, i) => {
          const dk = typeof p.dataKey === 'function' ? '' : (p.dataKey ?? '');
          const key = String(dk || p.name || i);
          const display = nameMap?.[key] ?? p.name ?? key;
          const color = p.color ?? p.fill ?? 'currentColor';
          // Coerce array values (stacked series tuples) to a single number.
          const raw = p.value;
          const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
          const safeValue = (value ?? 0) as number | string;
          return (
            <li key={i} className="flex items-center justify-between gap-3 text-[12px]">
              <span className="inline-flex items-center gap-2 text-slate-600">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                {display}
              </span>
              <span className="font-mono tabular-nums text-slate-900 font-bold">
                {format(safeValue, key)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
