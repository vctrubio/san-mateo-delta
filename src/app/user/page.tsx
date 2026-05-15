import Link from 'next/link';
import UserSignUpForm from '@/components/shared/UserSignUpForm';
import { listUsers } from '@/lib/users';
import { MoveRight, EyeOff } from 'lucide-react';
import { eur } from '@/lib/format';

export const dynamic = 'force-dynamic';

// The "Sign in as anyone" list shows every user with their email + lifetime
// spend, which is fine for an internal walkthrough but exposes PII on a
// public URL. Until real auth lands, we gate the list behind ?demo=1 — the
// sign-up form stays visible always since that IS the only path to create
// a user today.
export default async function UserIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  const showList = demo === '1';

  const { rows: users, total } = showList
    ? await listUsers({ limit: 200 })
    : { rows: [], total: 0 };

  return (
    <main className="min-h-screen px-6 py-16 md:py-24">
      <div className="max-w-3xl mx-auto">
        <span className="text-xs font-mono text-ocean uppercase tracking-[0.4em]">
          {showList ? 'Demo · no auth yet' : 'Sign up · no auth yet'}
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tighter mt-2 mb-3">
          {showList ? 'Sign in as anyone' : 'Create your account'}
        </h1>
        <p className="text-slate-500 mb-10">
          {showList
            ? 'No login wired yet. Pick a user below to view their bookings, or sign up a new one — the form creates the user and redirects you to their dashboard.'
            : 'No login wired yet. Sign up below and you’ll land on your dashboard. (Walkthrough mode? Append ?demo=1 to this URL to browse existing demo accounts.)'}
        </p>

        <div className="mb-10">
          <UserSignUpForm variant="card" />
        </div>

        {showList ? (
          <>
            <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">
              Existing users · {total}
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
          </>
        ) : (
          <DemoHint />
        )}
      </div>
    </main>
  );
}

function DemoHint() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 flex items-start gap-3">
      <span className="shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500">
        <EyeOff className="w-4 h-4" />
      </span>
      <div className="text-[12px] text-slate-600 leading-relaxed">
        <p className="font-semibold text-slate-800">Existing demo accounts are hidden.</p>
        <p>
          Until real auth is wired, the public list of demo users is gated behind{' '}
          <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">?demo=1</code>{' '}
          to avoid surfacing emails on a casual visit.
        </p>
      </div>
    </div>
  );
}
