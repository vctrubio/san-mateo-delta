import Link from 'next/link';
import UserSignUpForm from '@/components/shared/UserSignUpForm';
import { listUsers } from '@/lib/users';
import { MoveRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function UserIndexPage() {
  const users = await listUsers();
  return (
    <main className="min-h-screen px-6 py-16 md:py-24">
      <div className="max-w-3xl mx-auto">
        <span className="text-xs font-mono text-ocean uppercase tracking-[0.4em]">Demo · no auth yet</span>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tighter mt-2 mb-3">
          Sign in as anyone
        </h1>
        <p className="text-slate-500 mb-10">
          No login wired yet. Pick a user below to view their bookings, or sign up a new one — the form creates the user
          and redirects you to their dashboard.
        </p>

        <div className="mb-10">
          <UserSignUpForm variant="card" />
        </div>

        <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">
          Existing users · {users.length}
        </h2>
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id}>
              <Link
                href={`/user/${u.id}`}
                className="group flex items-center justify-between px-5 py-4 rounded-2xl border border-slate-100 bg-white hover:border-ocean hover:shadow-lg hover:shadow-ocean/5 transition-all"
              >
                <div>
                  <div className="font-bold text-slate-900">{u.name}</div>
                  <div className="text-[11px] font-mono text-slate-400">{u.email}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-[11px] text-slate-500">
                    <div>{u.total_bookings} bookings</div>
                    <div className="text-slate-400">{eur(u.lifetime_spend_cents)} spent</div>
                  </div>
                  <MoveRight className="w-4 h-4 text-slate-300 group-hover:text-ocean group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
