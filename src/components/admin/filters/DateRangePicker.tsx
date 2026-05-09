'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Calendar as CalendarIcon, X, ChevronDown } from 'lucide-react';
import Calendar from '@/components/calendar/Calendar';
import { ymd, parseYmd } from '@/components/calendar/dateUtils';
import { fmtDate, fmtDateRange } from '@/lib/dates';

// ============================================================================
// URL-driven date range filter, opens the brand Calendar in a popover. Two
// clicks on the grid select the range and write both `fromKey` + `toKey`
// query params. Items list is empty — this is purely a date picker, not a
// booking overview, so no held bookings or blocks are surfaced.
//
// Replaces the old native <input type=date> pair so every calendar surface
// in the app uses the same component family.
// ============================================================================

export default function DateRangePicker({
  fromKey = 'from',
  toKey = 'to',
  label = 'Dates',
}: {
  fromKey?: string;
  toKey?: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const fromStr = searchParams.get(fromKey) ?? '';
  const toStr = searchParams.get(toKey) ?? '';

  const fromDate = fromStr ? parseYmd(fromStr) : null;
  const toDate = toStr ? parseYmd(toStr) : null;
  const selectedRange = fromDate && toDate ? { start: fromDate, end: toDate } : undefined;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function writeRange(start: Date | null, end: Date | null) {
    const u = new URLSearchParams(searchParams.toString());
    if (start) u.set(fromKey, ymd(start)); else u.delete(fromKey);
    if (end)   u.set(toKey,   ymd(end));   else u.delete(toKey);
    u.delete('page');
    const qs = u.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function onSelectRange(start: Date, end: Date) {
    writeRange(start, end);
    setOpen(false);
  }

  function onClear(e: React.MouseEvent) {
    e.stopPropagation();
    writeRange(null, null);
  }

  // Display: collapsed shows current range or placeholder.
  const display = fromDate && toDate
    ? fmtDateRange(fromDate, toDate)
    : fromDate
      ? `from ${fmtDate(fromDate)}`
      : toDate
        ? `until ${fmtDate(toDate)}`
        : 'Any dates';
  const hasValue = Boolean(fromDate || toDate);

  return (
    <div className="flex items-center gap-2 relative" ref={wrapRef}>
      <span className="text-xs font-mono uppercase tracking-widest text-slate-400 shrink-0">{label}</span>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className={[
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ring-1 text-xs transition-colors bg-white',
          hasValue
            ? 'ring-ocean/30 text-slate-900 hover:ring-ocean/50'
            : 'ring-slate-200 text-slate-500 hover:ring-slate-300',
          isPending ? 'opacity-70' : '',
          open ? 'ring-2 ring-ocean/30' : '',
        ].join(' ')}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
        <span className="tabular-nums">{display}</span>
        {hasValue ? (
          <span
            role="button"
            tabIndex={0}
            onClick={onClear}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClear(e as unknown as React.MouseEvent); }}
            className="text-slate-300 hover:text-rose-500 transition-colors"
            aria-label="Clear dates"
          >
            <X className="w-3 h-3" />
          </span>
        ) : (
          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div className="absolute z-30 top-full left-0 mt-2 w-[28rem] max-w-[92vw] rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400">Pick a range</h4>
            <span className="text-xs font-mono text-slate-300">click 2 days</span>
          </div>
          <Calendar
            mode="public"
            items={[]}
            monthsDefault={2}
            selectedRange={selectedRange}
            onSelectRange={onSelectRange}
            onClearRange={() => writeRange(null, null)}
          />
        </div>
      )}
    </div>
  );
}
