'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  CalendarRange,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import AdminActions from './AdminActions';
import type { AdminAlert } from '@/lib/adminAlerts';
import type { BookingChipSource } from '@/lib/bookingAdapters';

// ============================================================================
// Admin shell navigation. Replaces the old left sidebar.
//
// Layout breakpoints:
//   < md       brand + actions on row 1, full pill nav on row 2 (scrolls
//              horizontally if needed). Mobile-friendly stacking.
//   md → lg    inline 3-col grid: brand · pill nav · actions. Pills are
//              icon-only here so 6 routes fit alongside brand + actions on
//              a tablet without crowding.
//   ≥ lg       same inline layout but pills show icon + label.
//
// Action buttons (Add / Notifications) live in `AdminActions` — same client
// component opens both modals, so state stays local and there's no parallel
// route slot to wire.
// ============================================================================

type Route = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV: Route[] = [
  { href: '/admin',            label: 'Finca',       icon: LayoutDashboard },
  // { href: '/admin/properties', label: 'Properties',  icon: Building2 },
  { href: '/admin/bookings',   label: 'Bookings',    icon: CalendarRange },
  { href: '/admin/payments',   label: 'Payments',    icon: Wallet },
  { href: '/admin/users',      label: 'Users',       icon: Users },
];

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}

export default function AdminNavigation({
  alerts,
  allBookings,
}: {
  alerts: AdminAlert[];
  allBookings: BookingChipSource[];
}) {
  const pathname = usePathname() ?? '/admin';

  return (
    <header className="sticky top-0 z-30 bg-slate-50/80 backdrop-blur-md">
      <div className="px-4 sm:px-6 pt-4 pb-2">
        {/* ≥ md: brand · nav · actions */}
        <div className="hidden md:grid grid-cols-[auto_1fr_auto] items-center gap-4">
          <Brand />
          <div className="flex justify-center">
            <Pills pathname={pathname} hideLabelsBelowLg />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AdminActions alerts={alerts} allBookings={allBookings} />
          </div>
        </div>

        {/* < md: brand + actions on top, nav scrolls horizontally below */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-3">
            <Brand />
            <div className="flex items-center gap-2 shrink-0">
              <AdminActions alerts={alerts} allBookings={allBookings} />
            </div>
          </div>
          <div className="overflow-x-auto -mx-4 px-4 pb-1">
            <Pills pathname={pathname} />
          </div>
        </div>
      </div>
    </header>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5 shrink-0">
      <div className="w-9 h-9 rounded-full bg-slate-900 grid place-items-center font-bold text-white text-xs tracking-tight">
        SM
      </div>
      <div className="text-sm font-bold text-slate-900">San Mateo</div>
    </Link>
  );
}

function Pills({
  pathname,
  hideLabelsBelowLg,
}: {
  pathname: string;
  /** When true, labels are hidden below `lg`; pills become icon-only on md. */
  hideLabelsBelowLg?: boolean;
}) {
  return (
    <nav className="inline-flex items-center gap-0.5 p-1 rounded-full bg-white/60 backdrop-blur-md border border-slate-900/10 shadow-sm">
      {NAV.map((r) => {
        const active = isActive(pathname, r.href);
        return (
          <Link
            key={r.href}
            href={r.href}
            aria-label={r.label}
            title={r.label}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-full text-sm transition-colors ${
              active
                ? 'bg-white text-slate-900 font-semibold shadow-sm ring-1 ring-slate-900/5'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <r.icon className="w-3.5 h-3.5 shrink-0" />
            <span className={hideLabelsBelowLg ? 'hidden lg:inline' : ''}>{r.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
