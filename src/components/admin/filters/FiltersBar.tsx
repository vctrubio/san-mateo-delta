// Server component shell. Doesn't itself drive URL state — that's the
// children's job. This is just the layout: a row that wraps any combination
// of SearchInput, FilterChips, DateRangePicker, SortSelect, ResetButton.

export default function FiltersBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 px-4 py-3 mb-4 flex flex-wrap items-center gap-x-5 gap-y-3">
      {children}
    </div>
  );
}
