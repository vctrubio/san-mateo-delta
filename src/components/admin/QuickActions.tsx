import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const ACTIONS = [
  { href: '/admin/bookings', label: 'View all bookings', sub: 'inline status transitions' },
  { href: '/admin/users',    label: 'Manage users',      sub: 'list + create' },
  { href: '/admin/payments', label: 'Payments ledger',   sub: 'collected + refunds' },
  { href: '/finca',          label: 'Public collection', sub: 'guest-facing pages' },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="group flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-slate-100 hover:border-ocean transition-colors"
        >
          <div>
            <div className="text-[13px] font-bold text-slate-900">{a.label}</div>
            <div className="text-[11px] text-slate-400">{a.sub}</div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-ocean group-hover:translate-x-1 transition-all" />
        </Link>
      ))}
    </div>
  );
}
