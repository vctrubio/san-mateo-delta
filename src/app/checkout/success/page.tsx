import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { sql } from '@db/client';

// Success page is rendered after Stripe redirects back. The webhook does the
// actual DB writes, so we may briefly see status='pending' while the webhook
// is in flight (especially in dev where `stripe listen` forwards events).
export const dynamic = 'force-dynamic';

type Row = {
  status: string;
  amount_cents: number;
  booking_id: string;
  user_id: string | null;
  property_title: string;
  property_slug: string;
  check_in: string;
  check_out: string;
};

export default async function SuccessPage(props: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await props.searchParams;

  if (!session_id) {
    return <Shell tone="error" title="Missing session id" body="No session_id in URL — open this page from the Stripe redirect." />;
  }

  const rows = await sql<Row>(
    `SELECT bp.status::text                AS status,
            bp.amount_cents::int           AS amount_cents,
            bp.booking_id::text            AS booking_id,
            b.user_id::text                AS user_id,
            p.title                        AS property_title,
            p.slug                         AS property_slug,
            b.date_check_in::text          AS check_in,
            b.date_check_out::text         AS check_out
       FROM booking_payments bp
       JOIN bookings b   ON b.id = bp.booking_id
       JOIN properties p ON p.id = b.property_id
      WHERE bp.stripe_session_id = $1`,
    [session_id],
  );
  const row = rows[0];

  if (!row) {
    return (
      <Shell tone="error" title="Couldn’t find your payment" body={`No booking is linked to session ${session_id}. Please contact the host.`} />
    );
  }

  if (row.status === 'succeeded') {
    return (
      <Shell
        tone="success"
        title="Payment received"
        body={
          <>
            <p className="mb-1">
              Thanks — your payment of <strong>{eur(row.amount_cents)}</strong> for{' '}
              <strong>{row.property_title}</strong> ({row.check_in} → {row.check_out}) is confirmed.
            </p>
            <p className="text-slate-500 text-[12px]">Booking #{row.booking_id}</p>
          </>
        }
        primary={row.user_id ? { href: `/user/${row.user_id}`, label: 'Open my dashboard' } : { href: '/', label: 'Home' }}
      />
    );
  }

  if (row.status === 'failed') {
    return (
      <Shell
        tone="error"
        title="Payment failed"
        body="Stripe rejected the charge. The booking is still saved — try again from your dashboard."
        primary={row.user_id ? { href: `/user/${row.user_id}`, label: 'Back to my dashboard' } : { href: '/', label: 'Home' }}
      />
    );
  }

  // status === 'pending' — webhook hasn't fired yet. In dev, this means
  // `stripe listen` may not be running. We show a soft "processing" state and
  // auto-refresh every 3s so the page resolves itself.
  return (
    <Shell
      tone="pending"
      title="Processing your payment…"
      body={
        <>
          <p>Stripe accepted the card. We’re waiting on the webhook to land — usually a second or two.</p>
          <p className="text-[11px] text-slate-400 font-mono mt-2">
            Dev tip: run <code>stripe listen --forward-to localhost:3000/api/webhooks/stripe</code> in another terminal.
          </p>
        </>
      }
      autoRefreshSec={3}
    />
  );
}

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

function Shell({
  tone,
  title,
  body,
  primary,
  autoRefreshSec,
}: {
  tone: 'success' | 'error' | 'pending';
  title: string;
  body: React.ReactNode;
  primary?: { href: string; label: string };
  autoRefreshSec?: number;
}) {
  const palette =
    tone === 'success'
      ? { ring: 'border-emerald-200', dot: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="w-6 h-6" /> }
      : tone === 'error'
        ? { ring: 'border-rose-200', dot: 'bg-rose-100 text-rose-700', icon: <XCircle className="w-6 h-6" /> }
        : { ring: 'border-amber-200', dot: 'bg-amber-100 text-amber-700', icon: <Loader2 className="w-6 h-6 animate-spin" /> };

  return (
    <main className="min-h-screen bg-slate-50 grid place-items-center px-4">
      {autoRefreshSec ? <meta httpEquiv="refresh" content={String(autoRefreshSec)} /> : null}
      <div className={`max-w-lg w-full bg-white rounded-3xl border ${palette.ring} p-8`}>
        <div className="flex items-start gap-4">
          <span className={`shrink-0 grid place-items-center w-12 h-12 rounded-2xl ${palette.dot}`}>{palette.icon}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-2">{title}</h1>
            <div className="text-sm text-slate-700 leading-relaxed">{body}</div>
            {primary && (
              <Link href={primary.href} className="inline-flex mt-5 items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-ocean text-white text-xs font-bold uppercase tracking-[0.2em] transition">
                {primary.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
