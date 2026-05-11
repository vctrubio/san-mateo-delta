'use client';

import Link from 'next/link';
import { Wallet, CalendarCheck, AlertTriangle, Inbox, ChevronRight, type LucideIcon } from 'lucide-react';
import { transitionStatus } from '@/actions/bookings';
import type { BookingAlertKind } from '@/lib/bookingState';
import type { AdminAlert } from '@/lib/adminAlerts';
import { ALERT_SEVERITY, ALERT_TONE } from './alertsDisplay';
import { relativeFromToday } from '@/lib/dates';
import { eur } from '@/lib/format';

// Icon map matches the chip filter so a row reads as the same "thing" as
// the chip that surfaced it.
const ICON: Record<BookingAlertKind, LucideIcon> = {
  checked_in_unpaid: Wallet,
  check_in_today:    CalendarCheck,
  overdue_checkin:   AlertTriangle,
  request_awaiting:  Inbox,
};

// Primary action per kind. `null` means there's no clean one-click
// resolution — admin needs to open the booking and decide what to do
// (e.g. unpaid: collect cash/stripe; overdue: backdate or cancel).
type PrimaryAction = { label: string; to: 'confirmed' | 'checked_in' } | null;

const PRIMARY: Record<BookingAlertKind, PrimaryAction> = {
  request_awaiting:  { label: 'Confirm',  to: 'confirmed'  },
  check_in_today:    { label: 'Check in', to: 'checked_in' },
  overdue_checkin:   null,  // can't auto-check-in past dates (transitionStatus blocks it)
  checked_in_unpaid: null,  // no inline payment UI yet — open the booking
};

// One alert row. Renders as a data grid (icon · slug · guest · check-in)
// plus an actions column on the right. Two interactions:
//   - Primary action button → server-action form posts `transitionStatus`,
//     which revalidates /admin and the bell self-updates.
//   - Open chevron → Link to the booking detail page. AdminAlertsBell
//     closes the modal on navigation so the booking page is unobstructed.

export function AlertRow({ alert }: { alert: AdminAlert }) {
  const Icon = ICON[alert.kind];
  const tone = ALERT_TONE[ALERT_SEVERITY[alert.kind]];
  const primary = PRIMARY[alert.kind];
  const owed = alert.agreed_total_cents - alert.paid_cents;

  return (
    <div
      className="grid grid-cols-[20px_minmax(0,80px)_minmax(0,1fr)_auto] sm:grid-cols-[20px_90px_minmax(0,1fr)_minmax(0,1.1fr)_auto] gap-x-3 items-center px-3 py-2.5 hover:bg-slate-50/70 transition-colors"
    >
      {/* Icon */}
      <Icon className={`w-4 h-4 ${tone.text}`} />

      {/* Slug */}
      <div className="text-xs font-mono uppercase tracking-widest text-slate-700 truncate">
        {alert.property_slug}
      </div>

      {/* User — collapses with desc on mobile (sm:hidden moves desc into
          this cell as a subline) */}
      <div className="min-w-0">
        <div className="text-sm text-slate-900 truncate">
          {alert.user_name ?? <span className="italic text-slate-400">no user</span>}
        </div>
        <div className="text-xs text-slate-500 tabular-nums sm:hidden truncate">
          {descriptionFor(alert, owed)}
        </div>
      </div>

      {/* Desc (desktop only) */}
      <div className="hidden sm:block text-xs text-slate-500 tabular-nums truncate">
        {descriptionFor(alert, owed)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 justify-end">
        {primary && (
          <form action={transitionStatus}>
            <input type="hidden" name="booking_id" value={alert.booking_id} />
            <input type="hidden" name="to" value={primary.to} />
            <button
              type="submit"
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-widest ${tone.bg} ${tone.text} ring-1 ${tone.ring} hover:brightness-95 transition`}
            >
              {primary.label}
            </button>
          </form>
        )}
        <Link
          href={`/admin/bookings/${alert.booking_id}`}
          aria-label="Open booking"
          className="grid place-items-center w-7 h-7 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

function descriptionFor(alert: AdminAlert, owed: number): string {
  const when = relativeFromToday(alert.date_check_in);
  if (alert.kind === 'checked_in_unpaid' && owed > 0) {
    return `${when} · ${eur(owed)} owed`;
  }
  return when;
}
