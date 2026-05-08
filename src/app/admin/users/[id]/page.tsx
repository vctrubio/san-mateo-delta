import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import StatusBadge from '@/components/admin/StatusBadge';
import { getUserById } from '@/lib/users';
import { listBookingsForUser } from '@/lib/bookings';
import { fmtDate, fmtDateRange } from '@/lib/dates';

export const dynamic = 'force-dynamic';

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();
  const bookings = await listBookingsForUser(id);

  const lifetimeSpend = bookings.reduce((sum, b) => sum + b.paid_cents, 0);

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/admin/users" className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-slate-400 hover:text-ocean mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> back
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{user.name}</h1>
        <p className="text-sm text-slate-500 mt-1 font-mono">{user.email}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
        <Card label="Bookings">{bookings.length}</Card>
        <Card label="Lifetime spend">{eur(lifetimeSpend)}</Card>
        <Card label="Joined">{fmtDate(user.created_at)}</Card>
        {user.tif         && <Card label="TIF">{user.tif}</Card>}
        {user.nationality && <Card label="Nationality">{user.nationality}</Card>}
        {user.dob         && <Card label="DOB">{fmtDate(user.dob)}</Card>}
      </div>

      <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">Their bookings</h2>
      {bookings.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-6 text-sm text-slate-400">No bookings.</div>
      ) : (
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li key={b.id} className="rounded-2xl bg-white border border-slate-100 px-5 py-3 flex items-center justify-between hover:border-ocean transition-colors">
              <Link href={`/admin/bookings/${b.id}`} className="flex items-center gap-3 flex-1">
                <span className="font-mono text-[11px] text-slate-400">#{b.id}</span>
                <StatusBadge status={b.status} />
                <span className="text-slate-700 font-bold uppercase">{b.property_slug}</span>
                <span className="text-[12px] text-slate-500">{fmtDateRange(b.date_check_in, b.date_check_out)}</span>
              </Link>
              <div className="font-mono tabular-nums text-sm">
                <span className="text-slate-900">{eur(b.agreed_total_cents)}</span>
                <span className="text-slate-400 text-[11px] ml-2">paid {eur(b.paid_cents)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-4">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">{label}</h3>
      <div className="text-lg font-bold text-slate-900">{children}</div>
    </div>
  );
}
