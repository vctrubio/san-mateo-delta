import { type ReactNode } from 'react';

// ============================================================================
// StatsCard + SplitBar + Split — shared visual language for the
// EstateOverview-style cards used across /admin (estate dashboard, booking
// detail). One outer rounded card, eyebrow + icon top-left, optional
// "corner" slot top-right, big number, then content.
//
//   ┌──────────────────────────────┐
//   │ ◉ TITLE                CORNER │  ← icon + tracking-[0.4em] eyebrow
//   │ 43.910 €                      │  ← big total (text-2xl/3xl)
//   │ ━━━━━━━━━━━━━━━━━━━━━━━━━━   │  ← SplitBar
//   │ ● PAID  ● UNPAID  ● CLEAN    │  ← Splits below
//   └──────────────────────────────┘
//
// `total` is optional — pages that want a fully custom big-stat slot
// (status chip + relative time pair, etc.) pass null and render their own
// inside `children`.
// ============================================================================

export function StatsCard({
  title, total, icon, corner, children,
}: {
  title: string;
  total?: string;
  icon: ReactNode;
  /** Top-right slot. EstateOverview uses "upcoming"; the booking detail
   *  uses "fully paid" / "X owed". Renders nothing when omitted. */
  corner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400">
          {icon} {title}
        </div>
        {corner && (
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-300">
            {corner}
          </span>
        )}
      </div>
      {total != null && (
        <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums leading-none mb-3">
          {total}
        </p>
      )}
      {children}
    </div>
  );
}

// ─── SplitBar ───────────────────────────────────────────────────────────────
//
// flex-grow weighting (rather than literal width %) lets the bar stay full
// even when segments overlap (e.g. payments paid+unpaid+cleaning > 100).
// Each segment's rendered width = pct / sum(pct) of the bar's width.

export function SplitBar({
  segments,
}: {
  segments: Array<{ pct: number; color: string }>;
}) {
  return (
    <div className="h-2 w-full rounded-full overflow-hidden bg-slate-100 flex">
      {segments.map((s, i) => (
        <div
          key={i}
          className="h-full transition-all"
          style={{ flexGrow: s.pct, backgroundColor: s.color }}
        />
      ))}
    </div>
  );
}

// ─── Split ─────────────────────────────────────────────────────────────────
//
// One legend cell — coloured dot + uppercase eyebrow + bold value.
// Optional `pct` appends "· N%" to the eyebrow (used in EstateOverview).
// Optional `sub` adds a small slate-400 line under the value (used in the
// booking detail's BOOKING card to show "in 5 days" / "stamped 14:30").

export function Split({
  label, value, sub, pct, dot,
}: {
  label: string;
  value: string;
  sub?: string;
  pct?: number;
  dot: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
          {label}
          {pct != null && <> · {pct}%</>}
        </span>
      </div>
      <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5 truncate">{value}</p>
      {sub && (
        <p className="text-xs text-slate-400 tabular-nums truncate">{sub}</p>
      )}
    </div>
  );
}
