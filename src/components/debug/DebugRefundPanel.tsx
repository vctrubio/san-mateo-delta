import Link from 'next/link';
import { Calculator, FileText, AlertTriangle } from 'lucide-react';
import { sql } from '@db/client';
import { DEFAULT_REFUND_POLICY, computeRefund } from '@/lib/refund';

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

type CancellationRow = {
  booking_id: string;
  property_slug: string;
  user_name: string | null;
  date_check_in: string;
  cancelled_at: string;
  cancelled_by: string;
  reason: string | null;
  refund_amount_cents: number;
  policy_applied: string;
  agreed_total_cents: number;
  refunded_cents: number;
};

async function fetchCancellations(): Promise<CancellationRow[]> {
  return sql<CancellationRow>(`
    SELECT
      bc.booking_id::text         AS booking_id,
      p.slug                      AS property_slug,
      u.name                      AS user_name,
      b.date_check_in::text       AS date_check_in,
      bc.cancelled_at::text       AS cancelled_at,
      bc.cancelled_by::text       AS cancelled_by,
      bc.reason                   AS reason,
      bc.refund_amount_cents::int AS refund_amount_cents,
      bc.policy_applied           AS policy_applied,
      (b.agreed_property_cents + b.agreed_cleaning_cents)::int AS agreed_total_cents,
      COALESCE((
        SELECT SUM(pr.amount_cents)::int
        FROM payment_refunds pr
        JOIN booking_payments bp ON bp.id = pr.payment_id
        WHERE bp.booking_id = bc.booking_id
      ), 0)                       AS refunded_cents
    FROM booking_cancellations bc
    JOIN bookings b   ON b.id = bc.booking_id
    JOIN properties p ON p.id = b.property_id
    LEFT JOIN users u ON u.id = b.user_id
    ORDER BY bc.cancelled_at DESC
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// Worked examples — recomputed every render so you can see the policy live.

function workedExamples() {
  const TODAY = new Date('2026-05-08T00:00:00Z'); // matches the demo timeline
  const PROPERTY = 35000 * 7; // 7 nights × €350 (Levante low-season)
  const CLEANING = 12000;     // Levante cleaning fee
  const total = PROPERTY + CLEANING;

  const scenarios = [
    { label: 'Cancel 30 days before',  daysOut: 30 },
    { label: 'Cancel 14 days before',  daysOut: 14 },
    { label: 'Cancel 10 days before',  daysOut: 10 },
    { label: 'Cancel 7 days before',   daysOut: 7 },
    { label: 'Cancel 3 days before',   daysOut: 3 },
    { label: 'Cancel day-of',          daysOut: 0 },
  ];

  return scenarios.map((s) => {
    const checkIn = new Date(TODAY.getTime() + s.daysOut * 86_400_000);
    const result = computeRefund({
      agreedPropertyCents: PROPERTY,
      agreedCleaningCents: CLEANING,
      checkInDate: checkIn.toISOString().slice(0, 10),
      cancelledAt: TODAY,
    });
    return { ...s, total, result };
  });
}

function PolicyTiers() {
  const tiers = [...DEFAULT_REFUND_POLICY].sort((a, b) => b.daysBefore - a.daysBefore);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {tiers.map((t, i) => {
        const next = tiers[i - 1];
        const upper = next ? `< ${next.daysBefore} days` : null;
        const lower = `≥ ${t.daysBefore} days`;
        const tone =
          t.refundPercent >= 100 ? 'emerald' :
          t.refundPercent >= 50  ? 'sky' :
                                   'rose';
        const tones: Record<string, string> = {
          emerald: 'bg-emerald-50 ring-emerald-200 text-emerald-800',
          sky:     'bg-sky-50 ring-sky-200 text-sky-800',
          rose:    'bg-rose-50 ring-rose-200 text-rose-800',
        };
        return (
          <div key={t.daysBefore} className={`rounded-2xl p-5 ring-1 ${tones[tone]}`}>
            <div className="text-[10px] font-mono uppercase tracking-widest opacity-70 mb-1">
              Tier {i + 1}
            </div>
            <div className="text-3xl font-bold tabular-nums">{t.refundPercent}%</div>
            <div className="text-[12px] opacity-80 mt-1">
              {lower}
              {upper && ` and ${upper}`} before check-in
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExamplesTable() {
  const examples = workedExamples();
  return (
    <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-mono text-[12px] uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Calculator className="w-3.5 h-3.5" />
          Worked examples · €350 × 7 nights + €120 cleaning
        </h3>
        <span className="text-[10px] font-mono text-slate-300">recomputed each render</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-[10px] font-mono uppercase tracking-widest text-slate-400">
            <th className="text-left px-5 py-2">Scenario</th>
            <th className="text-right px-5 py-2">Total</th>
            <th className="text-right px-5 py-2">Refund</th>
            <th className="text-left px-5 py-2">Policy applied</th>
          </tr>
        </thead>
        <tbody>
          {examples.map((e) => (
            <tr key={e.label} className="border-t border-slate-50">
              <td className="px-5 py-2 text-slate-700">{e.label}</td>
              <td className="px-5 py-2 text-right font-mono tabular-nums text-slate-500">{eur(e.total)}</td>
              <td className="px-5 py-2 text-right font-mono tabular-nums font-bold text-slate-900">
                {eur(e.result.refundAmountCents)}
              </td>
              <td className="px-5 py-2 text-[11px] font-mono text-slate-500">{e.result.policyApplied}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CancellationsTable({ rows }: { rows: CancellationRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-100 p-6 text-center text-sm text-slate-400">
        No cancellations on file. Cancel a booking from <Link href="/admin/bookings" className="text-ocean hover:underline">/admin/bookings</Link> to see one here.
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-mono text-[12px] uppercase tracking-widest text-slate-400">
          Cancellations on file · {rows.length}
        </h3>
        <span className="text-[10px] font-mono text-slate-300">live · joined</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-[10px] font-mono uppercase tracking-widest text-slate-400">
            <th className="text-left px-5 py-2">Booking</th>
            <th className="text-left px-5 py-2">Property</th>
            <th className="text-left px-5 py-2">Guest</th>
            <th className="text-left px-5 py-2">By</th>
            <th className="text-right px-5 py-2">Total</th>
            <th className="text-right px-5 py-2">Refund owed</th>
            <th className="text-right px-5 py-2">Refunded</th>
            <th className="text-left px-5 py-2">Policy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const stillOwed = r.refund_amount_cents - r.refunded_cents;
            return (
              <tr key={r.booking_id} className="border-t border-slate-50">
                <td className="px-5 py-2 font-mono text-[11px]">
                  <Link href={`/admin/bookings/${r.booking_id}`} className="text-ocean hover:underline">
                    #{r.booking_id}
                  </Link>
                </td>
                <td className="px-5 py-2 text-slate-700 font-mono text-[12px] uppercase">{r.property_slug}</td>
                <td className="px-5 py-2 text-slate-600">{r.user_name ?? <span className="italic text-slate-400">—</span>}</td>
                <td className="px-5 py-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {r.cancelled_by}
                  </span>
                </td>
                <td className="px-5 py-2 text-right font-mono tabular-nums text-slate-500">{eur(r.agreed_total_cents)}</td>
                <td className="px-5 py-2 text-right font-mono tabular-nums font-bold text-slate-900">{eur(r.refund_amount_cents)}</td>
                <td className="px-5 py-2 text-right font-mono tabular-nums">
                  <span className={r.refunded_cents >= r.refund_amount_cents ? 'text-emerald-700' : 'text-amber-700'}>
                    {eur(r.refunded_cents)}
                  </span>
                  {stillOwed > 0 && (
                    <div className="text-[10px] text-amber-600">owed: {eur(stillOwed)}</div>
                  )}
                </td>
                <td className="px-5 py-2 text-[11px] font-mono text-slate-500">{r.policy_applied}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HowItWorks() {
  return (
    <div className="rounded-2xl bg-slate-900 text-white p-6">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
        <FileText className="w-3.5 h-3.5" />
        How it works · snapshot principle
      </h3>
      <ol className="space-y-3 text-[12px]">
        <Step n={1}>
          Guest or admin clicks <span className="font-mono text-ocean">Cancel booking</span> on an active booking.
        </Step>
        <Step n={2}>
          <span className="font-mono text-ocean">cancelBooking</span> action loads the booking&apos;s snapshotted
          {' '}<span className="font-mono">agreed_property_cents</span> and{' '}
          <span className="font-mono">agreed_cleaning_cents</span>.
        </Step>
        <Step n={3}>
          <span className="font-mono text-ocean">computeRefund(...)</span> matches the days-to-check-in against the
          tiers above. Highest-eligible tier wins.
        </Step>
        <Step n={4}>
          A <span className="font-mono">booking_cancellations</span> row is inserted with the refund amount and a
          human-readable <span className="font-mono">policy_applied</span> label. The booking transitions to
          {' '}<span className="font-mono text-rose-300">cancelled</span>.
        </Step>
        <Step n={5}>
          The actual money movement still goes through <span className="font-mono">payment_refunds</span> linked to the
          original <span className="font-mono">booking_payments</span> row. The cancellation row is{' '}
          <em className="text-amber-300">what we owe</em>; the refund rows are <em className="text-emerald-300">what
          we paid back</em>.
        </Step>
      </ol>
      <div className="mt-5 pt-5 border-t border-white/10 flex items-start gap-3 text-[11px]">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <span className="text-white/60">
          Past <span className="font-mono">refund_amount_cents</span> values are <strong className="text-white">snapshots</strong>.
          Edit <span className="font-mono">DEFAULT_REFUND_POLICY</span> in
          {' '}<code className="font-mono px-1 rounded bg-white/10">src/lib/refund.ts</code>; only future
          cancellations use the new numbers. See <code className="font-mono px-1 rounded bg-white/10">docs/refund.md</code>.
        </span>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-5 h-5 rounded-full bg-ocean/20 ring-1 ring-ocean/40 text-ocean text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <div className="flex-1 text-white/80 leading-relaxed">{children}</div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function DebugRefundPanel() {
  const cancellations = await fetchCancellations();

  return (
    <section className="p-8 bg-rose-50/40 border-t border-slate-200">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
          <h2 className="text-sm font-mono uppercase tracking-widest text-slate-400">Debug Refund</h2>
          <span className="text-[10px] font-mono text-slate-400">
            source: <code className="px-1 rounded bg-white border border-slate-200">src/lib/refund.ts</code>
            {' · '}docs: <code className="px-1 rounded bg-white border border-slate-200">docs/refund.md</code>
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-6 max-w-3xl">
          Cancellation policy. Tiers fire by days-before-check-in; the refund amount is snapshotted onto the
          {' '}<code className="font-mono">booking_cancellations</code> row at cancellation time, so policy edits
          never alter past records.
        </p>

        <div className="space-y-4">
          <PolicyTiers />
          <ExamplesTable />
          <CancellationsTable rows={cancellations} />
          <HowItWorks />
        </div>
      </div>
    </section>
  );
}
