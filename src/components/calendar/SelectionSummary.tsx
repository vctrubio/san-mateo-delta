'use client';

import { CalendarRange, Plane, Bed } from 'lucide-react';
import { fmtDate, fmtDateRange, nightsBetween } from '@/lib/dates';
import { startOfDay } from './dateUtils';

// ============================================================================
// Compact summary of the admin's current selection. Shows two ranges:
//   1. Lead-in: today → check-in
//   2. Stay:    check-in → check-out
//
// Renders an empty placeholder when nothing is selected so the row doesn't
// shift on first click. Used in the admin all-properties calendar shell.
// ============================================================================

export type SelectionSummaryProps = {
  selection: { start: Date; end: Date | null } | null;
  /** Optional property tag — shows which calendar the selection belongs to. */
  propertyLabel?: string;
};

export default function SelectionSummary({ selection, propertyLabel }: SelectionSummaryProps) {
  const today = startOfDay(new Date());

  if (!selection) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-4 text-[12px] text-slate-400">
        Pick two days on a calendar below to see lead-in + stay ranges.
      </div>
    );
  }

  const leadInNights = Math.max(0, nightsBetween(today, selection.start));
  const stayNights = selection.end ? nightsBetween(selection.start, selection.end) : 0;

  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-ocean shrink-0" />
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400">
            Selection
          </p>
        </div>
        {propertyLabel && (
          <span className="text-[10px] font-mono uppercase tracking-widest text-ocean">
            {propertyLabel}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        <RangeBlock
          icon={<Plane className="w-3.5 h-3.5" />}
          label="Lead-in"
          tone="amber"
          range={fmtDateRange(today, selection.start)}
          nights={leadInNights}
          empty={leadInNights === 0}
        />
        <RangeBlock
          icon={<Bed className="w-3.5 h-3.5" />}
          label="Stay"
          tone="ocean"
          range={selection.end ? fmtDateRange(selection.start, selection.end) : `from ${fmtDate(selection.start)}`}
          nights={stayNights}
          empty={!selection.end}
          emptyHint="pick check-out"
        />
      </div>
    </div>
  );
}

function RangeBlock({
  icon, label, tone, range, nights, empty, emptyHint,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'amber' | 'ocean';
  range: string;
  nights: number;
  empty: boolean;
  emptyHint?: string;
}) {
  const accent = tone === 'amber' ? 'text-amber-700' : 'text-ocean';
  return (
    <div className="px-5 py-4">
      <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.3em] mb-1 ${accent}`}>
        {icon} {label}
      </div>
      <p className="text-sm font-bold text-slate-900 tabular-nums">{range}</p>
      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
        {empty
          ? (emptyHint ?? 'today')
          : `${nights} night${nights === 1 ? '' : 's'}`}
      </p>
    </div>
  );
}
