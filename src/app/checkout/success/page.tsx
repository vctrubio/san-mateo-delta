import { CheckCircle2, Loader2, XCircle, CalendarPlus, Mail, Phone, Globe2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { sql } from '@db/client';
import { PROPERTY_LABELS, type PropertySlug } from '@/lib/colors';
import { fmtDateRange } from '@/lib/dates';
import finca from '../../../../finca.json';
import { eur } from '@/lib/format';

// Success page is rendered after Stripe redirects back. The webhook does the
// actual DB writes, so we may briefly see status='pending' while the webhook
// is in flight (especially in dev where `stripe listen` forwards events).
export const dynamic = 'force-dynamic';

type Row = {
  status: string;
  amount_cents: number;
  booking_id: string;
  user_id: string | null;
  user_email: string | null;
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
            u.email                        AS user_email,
            p.slug                         AS property_slug,
            b.date_check_in::text          AS check_in,
            b.date_check_out::text         AS check_out
       FROM booking_payments bp
       JOIN bookings b   ON b.id = bp.booking_id
       JOIN properties p ON p.id = b.property_id
       LEFT JOIN users u ON u.id = b.user_id
      WHERE bp.stripe_session_id = $1`,
    [session_id],
  );
  const row = rows[0];

  if (!row) {
    return (
      <Shell tone="error" title="Couldn’t find your payment" body={`No booking is linked to session ${session_id}. Please contact the host.`} />
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

  if (row.status !== 'succeeded') {
    // status === 'pending' — webhook hasn't fired yet. Auto-refresh every 3s.
    return (
      <Shell
        tone="pending"
        title="Processing your payment…"
        body={
          <>
            <p>Stripe accepted the card. We&apos;re waiting on the webhook to land — usually a second or two.</p>
            <p className="text-[11px] text-slate-400 font-mono mt-2">
              Dev tip: run <code>stripe listen --forward-to localhost:3000/api/webhooks/stripe</code> in another terminal.
            </p>
          </>
        }
        autoRefreshSec={3}
      />
    );
  }

  // -------------------------------------------------------------------------
  // Succeeded — the full confirmation experience.
  // -------------------------------------------------------------------------

  const propertyLabel = PROPERTY_LABELS[row.property_slug as PropertySlug] ?? row.property_slug;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Hero — payment received */}
        <div className="bg-white rounded-3xl border border-emerald-200 p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-6 h-6" />
            </span>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Payment received</h1>
              <p className="text-sm text-slate-700 leading-relaxed">
                Thanks — your payment of <strong>{eur(row.amount_cents)}</strong> for{' '}
                <strong>Finca {finca.name} · {propertyLabel}</strong> is confirmed.
              </p>
              <p className="text-sm text-slate-600 mt-1">
                {fmtDateRange(row.check_in, row.check_out)}
              </p>
              <p className="text-[11px] text-slate-400 font-mono uppercase tracking-widest mt-2">
                Booking #{row.booking_id}
              </p>
            </div>
          </div>
        </div>

        {/* Actions — calendar + dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href={`/api/bookings/${row.booking_id}/ical`}
            download={`finca-san-mateo-booking-${row.booking_id}.ics`}
            className="rounded-2xl bg-white border border-slate-200 hover:border-ocean hover:shadow-sm transition p-4 flex items-center gap-3"
          >
            <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-ocean/10 text-ocean">
              <CalendarPlus className="w-5 h-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-slate-900">Add to calendar</span>
              <span className="block text-[11px] text-slate-500">Downloads an .ics for the stay</span>
            </span>
          </a>
          {row.user_id ? (
            <Link
              href={`/user/${row.user_id}`}
              className="rounded-2xl bg-slate-900 hover:bg-ocean text-white transition p-4 flex items-center gap-3"
            >
              <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-white/10">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold">Open my dashboard</span>
                <span className="block text-[11px] text-white/70">View booking + payment history</span>
              </span>
            </Link>
          ) : null}
        </div>

        {/* Email verification — placeholder, no auth wiring yet */}
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
          <div className="flex items-start gap-3">
            <span className="shrink-0 grid place-items-center w-9 h-9 rounded-lg bg-amber-100 text-amber-700">
              <Mail className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-slate-900">Verify your email</h3>
                <span className="text-[9px] font-mono uppercase tracking-widest bg-amber-200/60 text-amber-900 px-1.5 py-0.5 rounded">todo</span>
              </div>
              <p className="text-[12px] text-amber-900 leading-relaxed">
                We&apos;ll send a verification link to{' '}
                <strong>{row.user_email ?? 'your email'}</strong>. You&apos;ll need it to manage your booking later.
                {' '}<span className="italic text-amber-700/80">(Email delivery not yet wired up — pending auth slice.)</span>
              </p>
            </div>
          </div>
        </div>

        {/* Contact information from finca.json */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">Need anything?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
            <ContactRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={finca.contact.email} href={`mailto:${finca.contact.email}`} />
            <ContactRow icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={finca.contact.phone} href={`tel:${finca.contact.phone.replace(/\s+/g, '')}`} />
            <ContactRow icon={<Globe2 className="w-3.5 h-3.5" />} label="Website" value="fincasanmateo.com" href={finca.contact.website} />
          </div>
          <p className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
            Hosted by <strong>{finca.hosts[0]?.name}</strong> ({finca.hosts[0]?.role}). On-site help from{' '}
            <strong>{finca.hosts[1]?.name}</strong> ({finca.hosts[1]?.role}).
          </p>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Helpers + sub-components
// ---------------------------------------------------------------------------

function ContactRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href: string }) {
  return (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer noopener" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition">
      <span className="shrink-0 text-slate-500">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[10px] font-mono uppercase tracking-widest text-slate-400">{label}</span>
        <span className="block text-slate-900 truncate">{value}</span>
      </span>
    </a>
  );
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
