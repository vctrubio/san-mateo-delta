import Link from 'next/link';
import StatusBadge from '@/components/admin/StatusBadge';
import PaymentActionButtons from '@/components/admin/PaymentActionButtons';
import type { BookingRow } from '@/lib/bookings';
import type { User } from '@/lib/users';

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

const GROUPS: Array<{
  key: 'pending' | 'upcoming' | 'past' | 'cancelled';
  label: string;
  filter: (b: BookingRow) => boolean;
}> = [
  { key: 'pending',   label: 'Pending host approval', filter: (b) => b.status === 'request' || b.status === 'invite' },
  { key: 'upcoming',  label: 'Confirmed & in progress', filter: (b) => b.status === 'confirmed' || b.status === 'checked_in' },
  { key: 'past',      label: 'Past stays',  filter: (b) => b.status === 'checked_out' },
  { key: 'cancelled', label: 'Cancelled',   filter: (b) => b.status === 'cancelled' },
];

export default function UserDashboard({
  user,
  bookings,
}: {
  user: User;
  bookings: BookingRow[];
}) {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <Link href="/user" className="text-[11px] font-mono uppercase tracking-widest text-slate-400 hover:text-ocean">
          ← all users
        </Link>

        <div className="mt-3 mb-10">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Hi, {user.name.split(' ')[0]}.</h1>
          <p className="text-sm text-slate-500 mt-1 font-mono">{user.email}</p>
        </div>

        <div className="mb-8 rounded-2xl bg-sand p-5 border border-amber-200">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-amber-700 mb-2">Want another stay?</h3>
          <Link
            href="/finca"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 hover:text-ocean"
          >
            Browse the four properties at Finca San Mateo →
          </Link>
        </div>

        {GROUPS.map(({ key, label, filter }) => {
          const items = bookings.filter(filter);
          if (items.length === 0) return null;
          return (
            <section key={key} className="mb-8">
              <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">
                {label} · {items.length}
              </h2>
              <ul className="space-y-2">
                {items.map((b) => (
                  <li key={b.id} className="rounded-2xl bg-white border border-slate-100 p-5">
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <span className="font-bold text-slate-900 uppercase">{b.property_slug}</span>
                          <span className="text-[11px] font-mono text-slate-400">{b.property_title}</span>
                          <StatusBadge status={b.status} />
                        </div>
                        <div className="text-[12px] font-mono text-slate-500">
                          {b.date_check_in} → {b.date_check_out} · {b.guests.adults}A {b.guests.children}C
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums text-lg font-bold text-slate-900">
                          {eur(b.agreed_price_cents)}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          paid {eur(b.paid_cents)}
                          {b.paid_cents < b.agreed_price_cents && (
                            <span className="text-amber-700"> · outstanding {eur(b.agreed_price_cents - b.paid_cents)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {(b.status === 'confirmed' || b.status === 'checked_in') && (
                      <div className="pt-3 border-t border-slate-50">
                        <PaymentActionButtons
                          bookingId={b.id}
                          agreedCents={b.agreed_price_cents}
                          paidCents={b.paid_cents}
                          status={b.status}
                          size="sm"
                        />
                      </div>
                    )}

                    {b.status === 'request' && (
                      <div className="pt-3 border-t border-slate-50 text-[11px] text-slate-400 italic">
                        Waiting for the host to confirm. You&apos;ll be able to pay once it&apos;s approved.
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {bookings.length === 0 && (
          <div className="rounded-2xl bg-white border border-slate-100 p-8 text-center text-slate-400 text-sm">
            No bookings yet. <Link href="/finca" className="text-ocean hover:underline">Browse properties</Link> to start one.
          </div>
        )}
      </div>
    </main>
  );
}
