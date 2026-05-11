'use client';

import { Wallet, CalendarCheck, AlertTriangle, Inbox, LayoutGrid, type LucideIcon } from 'lucide-react';
import type { BookingAlertKind } from '@/lib/bookingState';
import type { AdminAlert } from '@/lib/adminAlerts';
import { ALERT_SEVERITY, ALERT_TITLES, ALERT_TONE } from './alertsDisplay';

// Same icon set as AlertRow so the chips and rows read as siblings.
const ICON: Record<BookingAlertKind, LucideIcon> = {
  checked_in_unpaid: Wallet,
  check_in_today:    CalendarCheck,
  overdue_checkin:   AlertTriangle,
  request_awaiting:  Inbox,
};

// Stable display order — independent of how alerts happen to be sorted in
// the list. Urgent kinds first, then warning kinds. Editing this changes
// the chip order site-wide.
const KIND_ORDER: readonly BookingAlertKind[] = [
  'checked_in_unpaid',
  'overdue_checkin',
  'check_in_today',
  'request_awaiting',
] as const;

// Filter chip row. Renders one chip per kind that has at least one alert,
// plus an "All" chip on the left. Clicking a chip toggles the filter:
// - Click "All" → show everything
// - Click a kind → show only that kind
// - Click the active kind → clear back to All
//
// Chip tone is driven by `ALERT_TONE[severity]` so the chips match the
// AlertRow palette without per-kind duplication.
export function AlertsFilterChips({
  alerts,
  selected,
  onSelect,
}: {
  alerts: AdminAlert[];
  /** `null` means "All" / no filter. */
  selected: BookingAlertKind | null;
  onSelect: (kind: BookingAlertKind | null) => void;
}) {
  // Per-kind counts (skip kinds with zero so the row stays tight).
  const counts = new Map<BookingAlertKind, number>();
  for (const a of alerts) counts.set(a.kind, (counts.get(a.kind) ?? 0) + 1);

  const present = KIND_ORDER.filter((k) => (counts.get(k) ?? 0) > 0);
  if (present.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-5">
      <AllChip total={alerts.length} active={selected === null} onClick={() => onSelect(null)} />
      {present.map((kind) => {
        const Icon = ICON[kind];
        const tone = ALERT_TONE[ALERT_SEVERITY[kind]];
        const isActive = selected === kind;
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onSelect(isActive ? null : kind)}
            aria-pressed={isActive}
            className={[
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
              'text-[11px] font-mono uppercase tracking-widest transition',
              isActive
                ? `${tone.bg} ${tone.text} ring-2 ring-current shadow-sm`
                : `${tone.bg} ${tone.text} ring-1 ${tone.ring} hover:brightness-95`,
            ].join(' ')}
          >
            <Icon className="w-3 h-3" />
            <span className="normal-case tracking-normal font-semibold">{ALERT_TITLES[kind]}</span>
            <span className="opacity-60">·</span>
            <span className="tabular-nums">{counts.get(kind)}</span>
          </button>
        );
      })}
    </div>
  );
}

function AllChip({ total, active, onClick }: { total: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
        'text-[11px] font-mono uppercase tracking-widest transition',
        active
          ? 'bg-slate-900 text-white ring-2 ring-slate-900 shadow-sm'
          : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
      ].join(' ')}
    >
      <LayoutGrid className="w-3 h-3" />
      <span className="normal-case tracking-normal font-semibold">All</span>
      <span className="opacity-60">·</span>
      <span className="tabular-nums">{total}</span>
    </button>
  );
}
