import Link from 'next/link';
import { LayoutDashboard, CalendarRange, CreditCard, Users, Building2, ArrowLeft } from 'lucide-react';

const NAV = [
  { href: '/admin',            label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/admin/properties', label: 'Properties', icon: Building2 },
  { href: '/admin/bookings',   label: 'Bookings',   icon: CalendarRange },
  { href: '/admin/payments',   label: 'Payments',   icon: CreditCard },
  { href: '/admin/users',      label: 'Users',      icon: Users },
];

export default function AdminSidebar() {
  return (
    <aside className="w-60 shrink-0 bg-slate-900 text-white flex flex-col h-screen sticky top-0">
      <div className="px-5 py-6 border-b border-white/10">
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/40">Finca</div>
        <div className="text-lg font-bold">San Mateo</div>
        <div className="text-[10px] font-mono text-white/40 mt-1">admin console</div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] hover:bg-white/10 transition-colors"
          >
            <Icon className="w-4 h-4 text-white/60" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          back to public site
        </Link>
      </div>
    </aside>
  );
}
