import Link from 'next/link';
import {
  Check, Lock, CreditCard, ArrowRight, ArrowDown, AlertTriangle,
  Mail, Calendar, ImageIcon, Star, BarChart3,
} from 'lucide-react';
import { sql } from '@db/client';
import { BOOKING_STATUSES, type BookingStatus } from '@db/enums';

// ─────────────────────────────────────────────────────────────────────────────

type StatusCount = { status: BookingStatus; count: number };

async function fetchCounts(): Promise<{
  byStatus: Record<BookingStatus, number>;
  totalEvents: number;
  totalPayments: number;
  totalUsers: number;
}> {
  const [statusRows, evtRows, payRows, userRows] = await Promise.all([
    sql<StatusCount>(`SELECT status::text AS status, count(*)::int AS count FROM bookings GROUP BY status`),
    sql<{ n: number }>(`SELECT count(*)::int AS n FROM booking_events`),
    sql<{ n: number }>(`SELECT count(*)::int AS n FROM booking_payments`),
    sql<{ n: number }>(`SELECT count(*)::int AS n FROM users`),
  ]);

  const byStatus = Object.fromEntries(
    BOOKING_STATUSES.map((s) => [s, 0]),
  ) as Record<BookingStatus, number>;
  for (const r of statusRows) byStatus[r.status] = r.count;

  return {
    byStatus,
    totalEvents: evtRows[0]?.n ?? 0,
    totalPayments: payRows[0]?.n ?? 0,
    totalUsers: userRows[0]?.n ?? 0,
  };
}

// Status palette is centralised in src/lib/colors.ts so the calendar, status
// badge, and this panel share one source of truth.
import { BOOKING_STATUS_STYLES } from '@/lib/colors';

// ─────────────────────────────────────────────────────────────────────────────
// State machine diagram

function StateNode({
  status,
  count,
}: {
  status: BookingStatus;
  count: number;
}) {
  const s = BOOKING_STATUS_STYLES[status];
  return (
    <div className={`rounded-2xl ${s.chip} px-4 py-3 min-w-[120px] text-center`}>
      <div className="text-[10px] font-mono uppercase tracking-widest opacity-70">{status}</div>
      <div className="text-2xl font-bold tabular-nums mt-0.5">{count}</div>
    </div>
  );
}

function Arrow({ direction = 'right' }: { direction?: 'right' | 'down' }) {
  const Icon = direction === 'right' ? ArrowRight : ArrowDown;
  return (
    <div className="flex items-center justify-center text-slate-300 shrink-0">
      <Icon className="w-5 h-5" />
    </div>
  );
}

function StateMachineDiagram({ counts }: { counts: Record<BookingStatus, number> }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-6">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-5">
        Booking state machine · live counts
      </h3>

      {/* main happy path */}
      <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
        <StateNode status="request"     count={counts.request} />
        <Arrow />
        <StateNode status="confirmed"   count={counts.confirmed} />
        <Arrow />
        <StateNode status="checked_in"  count={counts.checked_in} />
        <Arrow />
        <StateNode status="checked_out" count={counts.checked_out} />
      </div>

      {/* invite + cancelled side branches */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 justify-center">
          <StateNode status="invite" count={counts.invite} />
          <Arrow />
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-widest">→ confirmed</span>
        </div>
        <div className="flex items-center gap-3 justify-center">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-widest">any non-terminal →</span>
          <Arrow />
          <StateNode status="cancelled" count={counts.cancelled} />
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-center mt-5 max-w-xl mx-auto">
        Each transition is one Server Action (<code className="font-mono px-1 rounded bg-slate-50">transitionStatus</code>),
        guarded server-side. Every transition writes a row to{' '}
        <code className="font-mono px-1 rounded bg-slate-50">booking_events</code>.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// What's wired (checklist)

const WIRED: Array<{ title: string; sub: string; href?: string }> = [
  { title: 'Schema + seed (10 tables, 7 enums, 2 exclusion constraints)', sub: 'db/schema.sql · db/seed.ts · property_blocks added',         href: '/debug' },
  { title: 'Pricing model with seasonal rates',                          sub: 'docs/rates.md · 8 rate rows · selection in lib/bookings#computeQuote' },
  { title: 'Estate config in JSON (no DB row)',                          sub: '/finca.json amenities — change without a migration' },
  { title: 'Public landing + /finca + /finca/[slug] reading from DB',    sub: 'PropertyShowcase via listProperties()',                       href: '/finca' },
  { title: 'BookNowForm — guest creates user + booking in one submit',   sub: 'requestBooking action: upsert user, compute quote, insert booking + event, redirect to /user/[id]', href: '/finca/levante' },
  { title: 'Admin estate dashboard (upcoming-only)',                     sub: 'EstateOverview · GanttStrip · PerPropertyFutureStrip · per-property Calendar · /admin', href: '/admin' },
  { title: 'Admin one-click status transitions',                          sub: '/admin/bookings → filterable + paginated · inline buttons per row', href: '/admin/bookings' },
  { title: 'Guest dashboard with grouped bookings',                       sub: 'pending / upcoming / past / cancelled · Pay buttons appear once confirmed', href: '/user' },
  { title: 'Pay deposit / Pay full / Pay balance',                        sub: 'recordPayment action: amount computed server-side from booking + prior payments' },
  { title: 'Audit log on every transition + payment',                     sub: 'booking_events table: created, confirmed, checked_in, checked_out, cancelled, payment.recorded' },
  { title: 'Double-booking blocked at DB level',                          sub: 'no_overlap_when_held EXCLUDE constraint on (property_id, daterange) — surfaced as user-facing error' },
];

function WiredList() {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-6">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-4">
        ✓ Wired and working
      </h3>
      <ul className="space-y-2">
        {WIRED.map((w) => (
          <li key={w.title} className="flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-3 h-3 text-emerald-700" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-slate-900">
                {w.href ? (
                  <Link href={w.href} className="hover:text-ocean">{w.title}</Link>
                ) : (
                  w.title
                )}
              </div>
              <div className="text-[11px] text-slate-400 leading-snug">{w.sub}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// What's stubbed (auth + Stripe)

function StubbedPanel() {
  return (
    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-amber-800 mb-4 flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5" />
        Stubbed — needs real implementation
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Auth */}
        <div className="rounded-xl bg-white border border-amber-100 p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h4 className="text-[12px] font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              Authentication
            </h4>
            <span className="text-[10px] font-mono text-amber-700 uppercase tracking-widest">deferred</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
            Anyone can hit any <code className="font-mono px-1 rounded bg-slate-50">/admin/*</code> URL and act as
            any user via <code className="font-mono px-1 rounded bg-slate-50">/user/[id]</code>. Sign-up is just an
            <code className="font-mono px-1 rounded bg-slate-50">INSERT INTO users</code>. Fine for demo, not for prod.
          </p>
          <div className="space-y-1.5">
            <Suggestion title="Better Auth + Neon Postgres" body="What beta used. Self-hosted, all data in your DB. Easy to wire to existing users table." />
            <Suggestion title="Stack Auth (Neon Auth)" body="Neon-native, branch-aware. Adds a third-party SaaS but trivial to set up." />
            <Suggestion title="Auth.js / NextAuth v5" body="Most popular. Magic links via Resend = no password to store." />
          </div>
        </div>

        {/* Stripe */}
        <div className="rounded-xl bg-white border border-amber-100 p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h4 className="text-[12px] font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-amber-700" />
              Payments
            </h4>
            <span className="text-[10px] font-mono text-amber-700 uppercase tracking-widest">cash + stripe</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
            <code className="font-mono px-1 rounded bg-slate-50">booking_payments</code> rows now carry
            <code className="font-mono px-1 rounded bg-slate-50">method</code> (cash | stripe) and
            <code className="font-mono px-1 rounded bg-slate-50">status</code> (pending | succeeded | failed).
            See the <strong>DebugStripe</strong> panel below for the full Stripe story.
          </p>
        </div>
      </div>
    </div>
  );
}

function Suggestion({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-[11px]">
      <div className="font-bold text-slate-700">{title}</div>
      <div className="text-slate-500 leading-snug">{body}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Other suggestions

const NEXT: Array<{ icon: typeof Mail; title: string; body: string; tier: 'T2' | 'T3' }> = [
  { icon: Mail,        title: 'Email notifications',     body: 'Send the guest a request-received receipt and the host a "new request" email. Resend + React Email plays well with Server Actions.', tier: 'T2' },
  { icon: Calendar,    title: 'Availability calendar',   body: 'A 12-month grid on /finca/[slug] showing booked/blocked dates from the same exclusion constraint logic. Read-only, no auth needed.', tier: 'T2' },
  { icon: BarChart3,   title: 'Cancellation flow',       body: 'cancelBooking(reason) action + button on /admin and /user. Auto-trigger refund if a payment was already made.', tier: 'T2' },
  { icon: BarChart3,   title: 'Filters + search on tables', body: 'status / property / date-range on /admin/bookings; type filter on /admin/payments; name+email search on /admin/users.', tier: 'T2' },
  { icon: ImageIcon,   title: 'Property photos in DB',   body: 'Move /public/images to a property_photos table + Cloudinary or R2 storage. Per-property gallery in /finca/[slug].', tier: 'T3' },
  { icon: Star,        title: 'Reviews after check-out', body: 'Email the guest a /booking/[token]/review link. Insert into a reviews table; surface average rating on /finca and /finca/[slug].', tier: 'T3' },
];

function NextStepsPanel() {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-6">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-4">
        Suggestions · next features worth picking up
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {NEXT.map(({ icon: Icon, title, body, tier }) => (
          <div key={title} className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-ocean" />
                <span className="text-[13px] font-bold text-slate-900">{title}</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">{tier}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Try the flow

function TryItPanel() {
  const STEPS = [
    { n: 1, label: 'As a guest, request a booking',     href: '/finca/levante',      desc: 'Fill BookNowForm at the bottom of /finca/levante. Picks a rate, creates the user, redirects to /user/[id].' },
    { n: 2, label: 'See the request as the guest',      href: '/user',                desc: 'Find the user you just signed up. Their dashboard shows the request as "pending host approval".' },
    { n: 3, label: 'Confirm it as the admin',           href: '/admin/bookings',      desc: 'New request is at the top. Click "Confirm". This revalidates both views.' },
    { n: 4, label: 'Pay deposit as the guest',          href: '/user',                desc: 'Reload the user dashboard. "Pay deposit" / "Pay full" buttons now appear under the booking.' },
    { n: 5, label: 'Watch payments roll in',            href: '/admin/payments',      desc: 'Every payment shows up here with refund column.' },
    { n: 6, label: 'Run the stay (admin one-click)',    href: '/admin/bookings',      desc: 'Check-in stamps time_check_in. Check-out stamps time_check_out.' },
    { n: 7, label: 'Inspect the audit trail',           href: '/admin/bookings',      desc: 'Open any booking detail — booking_events lists every state transition + payment with the JSON payload.' },
  ];
  return (
    <div className="rounded-2xl bg-slate-900 text-white p-6">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-white/40 mb-4">
        Try the full flow · click through these in order
      </h3>
      <ol className="space-y-2">
        {STEPS.map((s) => (
          <li key={s.n}>
            <Link
              href={s.href}
              className="flex items-start gap-3 px-4 py-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <span className="w-6 h-6 rounded-full bg-ocean/20 ring-1 ring-ocean/40 text-ocean text-[11px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                {s.n}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold">{s.label}</div>
                <div className="text-[11px] text-white/50 leading-snug">{s.desc}</div>
                <div className="text-[10px] font-mono text-ocean mt-0.5">{s.href}</div>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function DebugE2EPanel() {
  const { byStatus, totalEvents, totalPayments, totalUsers } = await fetchCounts();
  const totalBookings = Object.values(byStatus).reduce((a, b) => a + b, 0);

  return (
    <section className="p-8 bg-white border-t border-slate-200">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-sm font-mono uppercase tracking-widest text-slate-400 mb-1">
          Debug E2E
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          End-to-end recap of what the <code className="font-mono">admin</code> branch wires up.
          Live snapshot: <span className="font-mono text-slate-700">{totalUsers} users</span> ·{' '}
          <span className="font-mono text-slate-700">{totalBookings} bookings</span> ·{' '}
          <span className="font-mono text-slate-700">{totalPayments} payments</span> ·{' '}
          <span className="font-mono text-slate-700">{totalEvents} events</span>.
        </p>

        <div className="space-y-4">
          <StateMachineDiagram counts={byStatus} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WiredList />
            <TryItPanel />
          </div>
          <StubbedPanel />
          <NextStepsPanel />
        </div>
      </div>
    </section>
  );
}
