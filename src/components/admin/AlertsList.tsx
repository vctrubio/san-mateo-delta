'use client';

import { useState } from 'react';
import type { BookingAlertKind } from '@/lib/bookingState';
import type { AdminAlert } from '@/lib/adminAlerts';
import { AlertRow } from './AlertRow';
import { AlertsFilterChips } from './AlertsFilterChips';

// Reusable alert list. Owns its own filter state (the chip toggles at the
// top) so consumers just pass the array. Chips do the categorization
// (Urgent kinds are coloured rose, Warning kinds amber); the table below
// stays a single flat list regardless of selection.

export function AlertsList({ alerts }: { alerts: AdminAlert[] }) {
  const [selected, setSelected] = useState<BookingAlertKind | null>(null);

  if (alerts.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic">You&apos;re all caught up.</p>
    );
  }

  const visible = selected === null ? alerts : alerts.filter((a) => a.kind === selected);

  return (
    <>
      <AlertsFilterChips alerts={alerts} selected={selected} onSelect={setSelected} />
      {visible.length === 0 ? (
        <p className="text-sm text-slate-400 italic">Nothing matches this filter.</p>
      ) : (
        <TableCard rows={visible} />
      )}
    </>
  );
}

// Table card — slate-50 header bar above divided rows. Mirrors AdminTable's
// shell so the bell modal reads as the same family of UI. Header is only
// rendered on desktop; on mobile rows stack their own subline via
// AlertRow's responsive grid.
function TableCard({ rows }: { rows: AdminAlert[] }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <div
        className="hidden sm:grid gap-x-3 px-3 py-2 bg-slate-50/70 border-b border-slate-200 text-[10px] font-mono uppercase tracking-[0.22em] text-slate-400"
        style={{ gridTemplateColumns: '20px 90px minmax(0,1fr) minmax(0,1.1fr) auto' }}
      >
        <div />
        <div>Property</div>
        <div>Guest</div>
        <div>Check-in</div>
        <div className="sr-only">Actions</div>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((a) => (
          <li key={`${a.kind}:${a.booking_id}`}>
            <AlertRow alert={a} />
          </li>
        ))}
      </ul>
    </div>
  );
}
