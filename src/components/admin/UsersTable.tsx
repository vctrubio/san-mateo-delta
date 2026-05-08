import Link from 'next/link';
import { fmtDate } from '@/lib/dates';
import type { UserWithStats } from '@/lib/users';

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default function UsersTable({ users }: { users: UserWithStats[] }) {
  if (users.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-100 p-8 text-center text-slate-400 text-sm">
        No users yet.
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-[10px] font-mono uppercase tracking-widest text-slate-400">
            <th className="text-left px-4 py-3">#</th>
            <th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Email</th>
            <th className="text-left px-4 py-3">Nationality</th>
            <th className="text-right px-4 py-3">Bookings</th>
            <th className="text-right px-4 py-3">Lifetime spend</th>
            <th className="text-right px-4 py-3">Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-slate-50 hover:bg-slate-50/50">
              <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                <Link href={`/admin/users/${u.id}`} className="hover:text-ocean">#{u.id}</Link>
              </td>
              <td className="px-4 py-3 text-slate-900 font-bold">
                <Link href={`/admin/users/${u.id}`} className="hover:text-ocean">{u.name}</Link>
              </td>
              <td className="px-4 py-3 text-slate-700 font-mono text-[12px]">{u.email}</td>
              <td className="px-4 py-3 text-slate-500 text-[12px]">{u.nationality ?? '—'}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{u.total_bookings}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{eur(u.lifetime_spend_cents)}</td>
              <td className="px-4 py-3 text-right text-[11px] text-slate-400">{fmtDate(u.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
