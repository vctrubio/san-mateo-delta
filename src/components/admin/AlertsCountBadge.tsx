// Small numeric pill positioned over a parent (Bell button, etc). Renders
// nothing when count is 0 so callers can drop it in unconditionally.
// Caps at "9+" to keep the badge a fixed visual width.

export function AlertsCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1.5 grid place-items-center rounded-full bg-rose-500 ring-2 ring-slate-50 text-[10px] font-bold text-white tabular-nums">
      {count > 9 ? '9+' : count}
    </span>
  );
}
