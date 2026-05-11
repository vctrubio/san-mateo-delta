import type { BookingAlertKind } from '@/lib/bookingState';

// ============================================================================
// Display metadata for admin alerts. Pure strings + Tailwind class names —
// no React imports, no `'use client'`, no `'server-only'`. Safe to import
// from any context (client component, server component, email-render).
//
// Icon components live in AlertRow.tsx where lucide-react belongs; this
// module stays runtime-agnostic so a future email-digest template can
// import it without dragging React in.
// ============================================================================

export type AlertSeverity = 'urgent' | 'warning';

export const ALERT_SEVERITY: Record<BookingAlertKind, AlertSeverity> = {
  checked_in_unpaid: 'urgent',
  overdue_checkin:   'urgent',
  check_in_today:    'warning',
  request_awaiting:  'warning',
};

// Short labels — icon + chip filter already convey the kind, the row
// only needs a concise label. Keep these short enough to fit a table
// column on a phone-width modal.
export const ALERT_TITLES: Record<BookingAlertKind, string> = {
  checked_in_unpaid: 'Unpaid',
  check_in_today:    'Check-in',
  overdue_checkin:   'Overdue',
  request_awaiting:  'Request',
};

export const ALERT_TONE: Record<AlertSeverity, { bg: string; ring: string; text: string }> = {
  urgent:  { bg: 'bg-rose-50',  ring: 'ring-rose-200',  text: 'text-rose-800'  },
  warning: { bg: 'bg-amber-50', ring: 'ring-amber-200', text: 'text-amber-800' },
};

