import {
  CreditCard, Banknote, KeyRound, Webhook, ShieldCheck, ExternalLink, Database, FileCode2, RefreshCw,
} from 'lucide-react';
import { sql } from '@db/client';
import { fmtDateTime } from '@/lib/dates';
import { eur } from '@/lib/format';

// ============================================================================
// DebugStripe — narrate the Stripe integration with live data. Mirrors the
// philosophy of the other debug panels: tell the story (what changed, what fires what)
// next to the actual numbers from the DB so it stays honest as the system
// evolves. Read it after every Stripe-related change.
// ============================================================================

export const dynamic = 'force-dynamic';

type DistRow = { method: string; status: string; n: number; total: number };
type RecentPaymentRow = {
  id: string;
  booking_id: string;
  type: string;
  method: string;
  status: string;
  amount_cents: number;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  paid_at: string;
};
type RecentEventRow = {
  id: string;
  booking_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export default async function DebugStripePanel() {
  const [dist, payments, events] = await Promise.all([
    sql<DistRow>(
      `SELECT method::text, status::text, COUNT(*)::int AS n, COALESCE(SUM(amount_cents)::int, 0) AS total
         FROM booking_payments
        GROUP BY method, status
        ORDER BY method, status`,
    ),
    sql<RecentPaymentRow>(
      `SELECT id::text, booking_id::text, type::text, method::text, status::text,
              amount_cents::int, stripe_session_id, stripe_payment_intent, paid_at::text
         FROM booking_payments
        ORDER BY paid_at DESC, id DESC
        LIMIT 8`,
    ),
    sql<RecentEventRow>(
      `SELECT id::text, booking_id::text, event_type, payload, created_at::text
         FROM booking_events
        WHERE event_type LIKE 'payment.%'
        ORDER BY created_at DESC, id DESC
        LIMIT 10`,
    ),
  ]);

  const env = {
    secret: Boolean(process.env.STRIPE_SECRET_KEY),
    publishable: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    webhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '(unset)',
  };

  return (
    <section className="px-6 py-10 border-t border-slate-100 bg-gradient-to-b from-violet-50/40 via-white to-white">
      <div className="max-w-5xl mx-auto">
        <Header />
        <Story />
        <EnvCard env={env} />
        <SchemaCard />
        <DistributionCard rows={dist} />
        <RecentPaymentsCard rows={payments} />
        <RecentEventsCard rows={events} />
        <FlowDiagrams />
        <Files />
        <Footer />
      </div>
    </section>
  );
}

// ============================================================================
// Sections
// ============================================================================

function Header() {
  return (
    <div className="mb-6">
      <div className="inline-flex items-center gap-2 mb-2">
        <span className="grid place-items-center w-8 h-8 rounded-xl bg-violet-100 text-violet-700">
          <CreditCard className="w-4 h-4" />
        </span>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">DebugStripe</h2>
        <span className="text-[10px] font-mono text-violet-700 bg-violet-100 ring-1 ring-violet-200 px-1.5 py-0.5 rounded uppercase tracking-widest">
          live
        </span>
      </div>
      <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
        How money moves through delta — the schema additions, the lifecycle, the
        webhook event log, the live distribution. Read this after any Stripe
        change. Long-form spec lives in <code className="font-mono px-1 rounded bg-slate-100">docs/stripe.md</code>.
      </p>
    </div>
  );
}

function Story() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5 text-[13px] text-slate-700 leading-relaxed">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">What changed on the stripe branch</h3>
      <ol className="space-y-1.5 list-decimal pl-4 marker:text-slate-300">
        <li>
          <strong>Schema:</strong> new <code className="font-mono">payment_method</code> and{' '}
          <code className="font-mono">payment_status</code> enums; <code className="font-mono">stripe_session_id</code>,{' '}
          <code className="font-mono">stripe_payment_intent</code>, <code className="font-mono">stripe_charge_id</code>{' '}
          on <code className="font-mono">booking_payments</code>; <code className="font-mono">stripe_refund_id</code>{' '}
          on <code className="font-mono">payment_refunds</code>. CHECK constraint forces stripe rows to carry a session id.
        </li>
        <li>
          <strong>Guest UX:</strong> <code className="font-mono">PropertyView</code>&apos;s inline booking flow on
          <code className="font-mono">/finca/[slug]</code> is card-only — submit creates the booking
          (<code className="font-mono">status=request</code>) and redirects to Stripe Checkout for the 50% deposit.
          Cash is admin-only — recorded from <code className="font-mono">/admin/bookings/[id]</code> after the guest pays in person.
        </li>
        <li>
          <strong>Server actions:</strong> <code className="font-mono">createCheckoutSession(bookingId, kind)</code> creates a
          Stripe session, inserts a pending <code className="font-mono">booking_payments</code> row, returns the redirect URL.
        </li>
        <li>
          <strong>Webhook:</strong> <code className="font-mono">/api/webhooks/stripe</code> verifies signature, handles{' '}
          <code className="font-mono">checkout.session.completed</code>, <code className="font-mono">checkout.session.expired</code>,
          <code className="font-mono"> payment_intent.payment_failed</code>, and <code className="font-mono">charge.refunded</code>.
          All handlers idempotent — Stripe retries on 5xx.
        </li>
        <li>
          <strong>Admin:</strong> booking detail page (<code className="font-mono">/admin/bookings/[id]</code>) shows the full payment history with
          Method + Status chips and per-row <em>Mark cash received</em> / <em>Refund via Stripe</em> actions.
          Dashboard added a 6th tile — <em>Pending cash</em>.
        </li>
      </ol>
    </div>
  );
}

function EnvCard({ env }: { env: { secret: boolean; publishable: boolean; webhook: boolean; appUrl: string } }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <KeyRound className="w-3 h-3" /> Env presence (server runtime)
      </h3>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px]">
        <EnvRow ok={env.secret}      label="STRIPE_SECRET_KEY" />
        <EnvRow ok={env.publishable} label="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" />
        <EnvRow ok={env.webhook}     label="STRIPE_WEBHOOK_SECRET" hint={!env.webhook ? 'set this from `stripe listen`' : undefined} />
        <EnvRow ok                   label={`NEXT_PUBLIC_APP_URL = ${env.appUrl}`} />
      </ul>
    </div>
  );
}

function EnvRow({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <li className={`px-3 py-2 rounded-lg ring-1 flex items-center gap-2 ${
      ok ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      <code className="font-mono text-[11px] flex-1 truncate">{label}</code>
      {hint && <span className="text-[10px] italic">{hint}</span>}
    </li>
  );
}

function SchemaCard() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <Database className="w-3 h-3" /> Schema additions
      </h3>
      <pre className="bg-slate-900 text-slate-100 text-[11px] font-mono p-4 rounded-xl overflow-x-auto leading-relaxed">{
`CREATE TYPE payment_method AS ENUM ('cash', 'stripe');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed');

booking_payments {
  method                 payment_method NOT NULL DEFAULT 'cash',
  status                 payment_status NOT NULL DEFAULT 'succeeded',
  stripe_session_id      TEXT,
  stripe_payment_intent  TEXT,
  stripe_charge_id       TEXT,
  CHECK ((method='cash'   AND stripe_session_id IS NULL) OR
         (method='stripe' AND stripe_session_id IS NOT NULL))
}
+ unique partial index on stripe_session_id, stripe_payment_intent

payment_refunds {
  stripe_refund_id  TEXT
}
+ unique partial index on stripe_refund_id`
      }</pre>
    </div>
  );
}

function DistributionCard({ rows }: { rows: DistRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">
        Live distribution — booking_payments
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] font-mono uppercase tracking-widest text-slate-400 border-b border-slate-100">
            <th className="text-left py-2">Method</th>
            <th className="text-left py-2">Status</th>
            <th className="text-right py-2">Rows</th>
            <th className="text-right py-2">Total amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.method}-${r.status}`} className="border-b border-slate-50 last:border-0">
              <td className="py-2">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] ring-1 ${
                  r.method === 'stripe' ? 'bg-violet-50 text-violet-800 ring-violet-200' : 'bg-amber-50 text-amber-800 ring-amber-200'
                }`}>{r.method}</span>
              </td>
              <td className="py-2">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] ring-1 ${
                  r.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : r.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-200'
                  : 'bg-rose-50 text-rose-700 ring-rose-200'
                }`}>{r.status}</span>
              </td>
              <td className="text-right font-mono tabular-nums py-2">{r.n}</td>
              <td className="text-right font-mono tabular-nums py-2">{eur(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentPaymentsCard({ rows }: { rows: RecentPaymentRow[] }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">
        Recent payments (8 most recent)
      </h3>
      {rows.length === 0 ? (
        <p className="text-[12px] text-slate-400 italic">no payments yet — run <code className="font-mono">bun db:fullseason</code></p>
      ) : (
        <ul className="divide-y divide-slate-100 text-[12px]">
          {rows.map((p) => (
            <li key={p.id} className="py-2 flex items-center gap-3">
              <span className="font-mono text-[10px] text-slate-400 w-10 shrink-0">#{p.id}</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] ring-1 shrink-0 ${
                p.method === 'stripe' ? 'bg-violet-50 text-violet-800 ring-violet-200' : 'bg-amber-50 text-amber-800 ring-amber-200'
              }`}>{p.method}</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] ring-1 shrink-0 ${
                p.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : p.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-200'
                : 'bg-rose-50 text-rose-700 ring-rose-200'
              }`}>{p.status}</span>
              <span className="font-mono text-[11px] text-slate-700 shrink-0">{p.type}</span>
              <span className="text-slate-400 shrink-0">→ booking #{p.booking_id}</span>
              <span className="font-mono tabular-nums text-slate-900 ml-auto shrink-0">{eur(p.amount_cents)}</span>
              {p.stripe_payment_intent && (
                <a
                  href={`https://dashboard.stripe.com/test/payments/${p.stripe_payment_intent}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[10px] font-mono text-violet-700 hover:underline shrink-0 inline-flex items-center gap-0.5"
                >
                  pi <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentEventsCard({ rows }: { rows: RecentEventRow[] }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <Webhook className="w-3 h-3" /> booking_events · payment.* (10 most recent)
      </h3>
      {rows.length === 0 ? (
        <p className="text-[12px] text-slate-400 italic">no payment events yet</p>
      ) : (
        <ul className="space-y-1.5 text-[12px]">
          {rows.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-50 ring-1 ring-slate-100">
              <span className="text-[10px] text-slate-400 shrink-0">{fmtDateTime(e.created_at)}</span>
              <code className="font-mono text-[11px] text-violet-700 shrink-0">{e.event_type}</code>
              <span className="text-slate-400 shrink-0">booking #{e.booking_id}</span>
              <code className="font-mono text-[10px] text-slate-500 truncate ml-auto">{compactJson(e.payload)}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FlowDiagrams() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <RefreshCw className="w-3 h-3" /> Lifecycle flows
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FlowCard title="Stripe checkout (happy path)" icon={<CreditCard className="w-3 h-3" />} accent="violet">
{`guest picks "pay full"
   ↓
requestBooking()        ← booking row created (status='request')
createCheckoutSession() ← booking_payments INSERT
                          (method='stripe', status='pending',
                           stripe_session_id=cs_…)
   ↓
redirect to Stripe
   ↓
guest pays w/ 4242
   ↓
checkout.session.completed
   ↓ webhook (idempotent)
UPDATE booking_payments
   SET status='succeeded',
       stripe_payment_intent=pi_…,
       stripe_charge_id=ch_…`}
        </FlowCard>

        <FlowCard title="Cash · admin-recorded" icon={<Banknote className="w-3 h-3" />} accent="amber">
{`guest pays in person
   ↓
admin opens /admin/bookings/[id]
   ↓
recordPayment() / registerCashPayment()
   ↓
booking_payments INSERT
  (method='cash', status='succeeded',
   amount=cash received)

No "pending cash" state —
admin only logs cash that
has already changed hands.`}
        </FlowCard>

        <FlowCard title="Stripe refund" icon={<RefreshCw className="w-3 h-3" />} accent="rose">
{`admin clicks "Refund full"
on a succeeded stripe row
   ↓
refundStripePayment()
   ↓
stripe.refunds.create(
  payment_intent=pi_…
)
   ↓
charge.refunded webhook
   ↓ (idempotent on re_…)
INSERT payment_refunds
  (payment_id, amount,
   stripe_refund_id=re_…)`}
        </FlowCard>
      </div>
    </div>
  );
}

function FlowCard({ title, icon, accent, children }: {
  title: string;
  icon: React.ReactNode;
  accent: 'violet' | 'amber' | 'rose';
  children: React.ReactNode;
}) {
  const tones = {
    violet: 'border-violet-200 bg-violet-50/40',
    amber: 'border-amber-200 bg-amber-50/40',
    rose: 'border-rose-200 bg-rose-50/40',
  };
  const dots = {
    violet: 'bg-violet-100 text-violet-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
  };
  return (
    <div className={`rounded-xl border ${tones[accent]} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`grid place-items-center w-5 h-5 rounded ${dots[accent]}`}>{icon}</span>
        <h4 className="text-[11px] font-bold text-slate-900 tracking-tight">{title}</h4>
      </div>
      <pre className="text-[10px] font-mono text-slate-700 leading-relaxed whitespace-pre">{children}</pre>
    </div>
  );
}

function Files() {
  const items = [
    ['db/schema.sql', 'payment_method, payment_status enums + stripe columns'],
    ['db/enums.ts', 'PAYMENT_METHODS, PAYMENT_STATUSES TS mirrors'],
    ['src/lib/stripe/server.ts', 'pinned Stripe SDK singleton (server-only)'],
    ['src/lib/stripe/client.ts', 'loadStripe() loader for Elements (unused yet)'],
    ['src/actions/checkout.ts', 'createCheckoutSession server action'],
    ['src/actions/payments.ts', 'recordPayment, registerCashPayment, refundStripePayment'],
    ['src/app/api/webhooks/stripe/route.ts', 'webhook handler (4 events, idempotent)'],
    ['src/app/checkout/success/page.tsx', 'post-Stripe success page (auto-refresh on pending)'],
    ['src/app/checkout/cancel/page.tsx', 'post-Stripe cancel page'],
    ['src/components/finca/PropertyView.tsx', 'inline booking flow (PricingCard → calendar → guests → submit) + Stripe redirect'],
    ['src/components/admin/PaymentsTable.tsx', 'Method/Status badges + Stripe Dashboard link'],
    ['db/seed_fullseason.ts', '60/40 stripe/cash mix with realistic ids'],
    ['docs/stripe.md', 'env vars, webhooks, test cards, idempotency'],
  ];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <FileCode2 className="w-3 h-3" /> Files of interest
      </h3>
      <ul className="space-y-1 text-[12px]">
        {items.map(([path, body]) => (
          <li key={path} className="flex items-start gap-3">
            <code className="font-mono text-[11px] text-violet-700 shrink-0 w-72 truncate">{path}</code>
            <span className="text-slate-600">{body}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer() {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 text-[12px] text-slate-600 leading-relaxed">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
        <ShieldCheck className="w-3 h-3" /> Verifying locally
      </h3>
      <ol className="space-y-1.5 list-decimal pl-4 marker:text-slate-300">
        <li><code className="font-mono">bun dev</code> — terminal 1.</li>
        <li><code className="font-mono">stripe listen --forward-to localhost:3000/api/webhooks/stripe</code> — terminal 2. Paste the <code className="font-mono">whsec_…</code> into <code className="font-mono">.env.local</code>.</li>
        <li><code className="font-mono">bun db:smoke-stripe</code> — generates a real Checkout URL against an existing booking.</li>
        <li>Open the URL, pay with <code className="font-mono">4242 4242 4242 4242</code>. Watch the row in the booking detail&apos;s Payments card flip pending → succeeded.</li>
        <li>From booking detail, click <em>Refund full</em>. Watch the refund land in <code className="font-mono">payment_refunds</code> via the <code className="font-mono">charge.refunded</code> webhook.</li>
      </ol>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function compactJson(value: Record<string, unknown>): string {
  const entries = Object.entries(value);
  if (entries.length === 0) return '{}';
  return entries
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' · ');
}
