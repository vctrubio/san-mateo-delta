import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, User, Wallet, XCircle } from 'lucide-react';
import fincaData from '../../../../../finca.json';
import AdminTable, { type AdminTableColumn } from '@/components/admin/AdminTable';
import {
  BookingSummaryCard,
  RegisterCashPayment,
  PaymentRowAction,
  AssignUserPicker,
  EditableTime,
  StripeLink,
  type AssignableUser,
} from '@/components/admin/BookingDetailControls';
import { StatsCard, SplitBar, Split } from '@/components/admin/StatsCard';
import { getBookingById } from '@/lib/bookings';
import { listPaymentsForBooking } from '@/lib/payments';
import { listUsers } from '@/lib/users';
import {
  fmtDate,
  fmtDateTime,
  relativeStayLabel,
  relativeFromToday,
  computeStayProgress,
} from '@/lib/dates';
import { eur, fmtTime } from '@/lib/format';
import { formatGuests } from '@/lib/guests';

export const dynamic = 'force-dynamic';

// Same palette as EstateOverview so the booking detail's PAYMENTS card
// reads as the per-booking version of the estate-wide one. Cash + Stripe
// reuse the existing payment-method chip colours so the segmented bar is
// visually consistent with the chips elsewhere on the page.
const CASH_COLOR     = 'var(--color-status-request)';     // amber-400
const STRIPE_COLOR   = 'var(--color-status-invite)';      // violet-400
const UNPAID_COLOR   = 'var(--color-status-checked_out)'; // slate-300
const CLEANING_COLOR = 'var(--color-status-cancelled)';   // rose-400
const STAY_COLOR     = 'var(--color-ocean)';

type Payment = Awaited<ReturnType<typeof listPaymentsForBooking>>[number];

// ============================================================================
// /admin/bookings/[id] — booking detail.
//
// Layout matches the /admin overview style: 2 EstateOverview-shaped cards on
// top (BOOKING · PAYMENTS), then a full-width Guest card, then a Payments
// transactions table.
//
//   ┌─ BOOKING ───────┐ ┌─ PAYMENTS ─────────┐
//   │ relative stay   │ │ total agreed       │
//   │ stay-progress   │ │ cash·stripe·unpaid │
//   │ created · in ·  │ │ paid · unpaid ·    │
//   │   out splits    │ │   cleaning splits  │
//   └─────────────────┘ └────────────────────┘
//   ┌─ Guest ─────────────────────────────────┐
//   │ name · email · party · property · stay  │
//   │ (cancellation block when applicable)    │
//   └─────────────────────────────────────────┘
//   ┌─ Payments table ────────────────────────┐
//   │ Register cash widget (when balance owed)│
//   │ AdminTable: type · method · status · …  │
//   └─────────────────────────────────────────┘
// ============================================================================

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const booking = await getBookingById(id);
  if (!booking) notFound();

  const [payments, usersResult] = await Promise.all([
    listPaymentsForBooking(id),
    booking.user_id ? Promise.resolve({ rows: [] as AssignableUser[] }) : listUsers({ limit: 250 }),
  ]);
  const assignableUsers: AssignableUser[] = usersResult.rows.map((u) => ({
    id: u.id, name: u.name, email: u.email,
  }));

  // ─ Payment splits ───────────────────────────────────────────────────────
  const succeeded   = payments.filter((p) => p.status === 'succeeded');
  const cashPaid    = succeeded.filter((p) => p.method === 'cash')  .reduce((s, p) => s + p.amount_cents, 0);
  const stripePaid  = succeeded.filter((p) => p.method === 'stripe').reduce((s, p) => s + p.amount_cents, 0);
  const totalPaid   = cashPaid + stripePaid;
  const remaining   = Math.max(0, booking.agreed_total_cents - totalPaid);
  const cleaning    = booking.agreed_cleaning_cents;
  const canRegisterCash = remaining > 0 && booking.status !== 'cancelled';

  const agreed = booking.agreed_total_cents || 1;
  const cashPct     = Math.round((cashPaid    / agreed) * 100);
  const stripePct   = Math.round((stripePaid  / agreed) * 100);
  const unpaidPct   = Math.round((remaining   / agreed) * 100);
  const cleaningPct = Math.round((cleaning    / agreed) * 100);

  // ─ Stay progress ────────────────────────────────────────────────────────
  // Where today sits between check-in and check-out, as a 0..100 percent.
  // Pre-stay → 0, mid-stay → fractional, post-stay → 100.
  const stayProgress = computeStayProgress(booking.date_check_in, booking.date_check_out);

  return (
    <div className="max-w-5xl mx-auto pb-16">
      {/* Back to bookings — labelled with the property slug so admin sees
          "which estate this is" right next to the back arrow. Lives outside
          the cards as a navigation aid, not a card header. */}
      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-ocean mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {booking.property_slug}
      </Link>

      {/* Top row: 2 EstateOverview-shaped cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        {/* BOOKING — interactive status chip */}
        <BookingSummaryCard
          bookingId={booking.id}
          status={booking.status}
          eyebrow={<><CheckCircle2 className="w-3.5 h-3.5" /> Booking</>}
        >
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums leading-none mb-3">
            {relativeStayLabel(booking.date_check_in, booking.date_check_out)}
          </p>
          <SplitBar segments={[{ pct: stayProgress, color: STAY_COLOR }]} />
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Split
              label="Created"
              value={fmtDate(booking.created_at)}
              sub={relativeFromToday(booking.created_at)}
              dot={UNPAID_COLOR}
            />
            <Split
              label="Check-in"
              value={fmtDate(booking.date_check_in)}
              sub={
                booking.time_check_in
                  ? `stamped ${fmtTime(booking.time_check_in)}`
                  : relativeFromToday(booking.date_check_in)
              }
              dot={STAY_COLOR}
            />
            <Split
              label="Check-out"
              value={fmtDate(booking.date_check_out)}
              sub={
                booking.time_check_out
                  ? `stamped ${fmtTime(booking.time_check_out)}`
                  : relativeFromToday(booking.date_check_out)
              }
              dot={UNPAID_COLOR}
            />
          </div>
        </BookingSummaryCard>

        {/* PAYMENTS — static breakdown of the booking's money */}
        <StatsCard
          title="Payments"
          icon={<Wallet className="w-3.5 h-3.5" />}
          total={eur(booking.agreed_total_cents)}
          corner={remaining === 0 ? 'fully paid' : `${eur(remaining)} owed`}
        >
          <SplitBar
            segments={[
              { pct: cashPct,     color: CASH_COLOR     },
              { pct: stripePct,   color: STRIPE_COLOR   },
              { pct: unpaidPct,   color: UNPAID_COLOR   },
              { pct: cleaningPct, color: CLEANING_COLOR },
            ]}
          />
          {/* Hide any split whose amount is zero — no "0 €" noise tiles.
              The grid uses auto-fit so visible tiles redistribute the row
              evenly: 1 tile takes the full row, 2 split it, 4 quarter it. */}
          <div
            className="grid gap-2 mt-3"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}
          >
            {cashPaid   > 0 && <Split label="Cash"     value={eur(cashPaid)}   pct={cashPct}     dot={CASH_COLOR}     />}
            {stripePaid > 0 && <Split label="Stripe"   value={eur(stripePaid)} pct={stripePct}   dot={STRIPE_COLOR}   />}
            {remaining  > 0 && <Split label="Unpaid"   value={eur(remaining)}  pct={unpaidPct}   dot={UNPAID_COLOR}   />}
            {cleaning   > 0 && <Split label="Cleaning" value={eur(cleaning)}   pct={cleaningPct} dot={CLEANING_COLOR} />}
          </div>
        </StatsCard>
      </div>

      {/* Guest card — single full-width card. Surfaces:
          • who: name + email + party + sleeps
          • where: property slug + title + bedrooms/bathrooms/m²
          • when: editable time_check_in / time_check_out (with the estate
            policy from finca.json shown alongside as a hint)
          Status changes still live in the BOOKING card's clickable chip up
          top; this card is "everything else admin needs to read or edit". */}
      <div className="mb-3">
        <StatsCard
          title="Guest"
          icon={<User className="w-3.5 h-3.5" />}
          total={booking.user_name ?? 'No user attached'}
          corner={`${booking.property_slug.toUpperCase()} · ${nightsLabel(booking.date_check_in, booking.date_check_out)}`}
        >
          {booking.user_id ? (
            <Link
              href={`/admin/users/${booking.user_id}`}
              className="block text-xs font-mono text-slate-500 hover:text-ocean truncate"
            >
              {booking.user_email}
            </Link>
          ) : (
            <p className="text-xs text-slate-400 italic">
              admin ghost booking — attach a user below to bind it
            </p>
          )}

          {/* Property + party context — single line, dot-separated. */}
          <p className="text-xs text-slate-500 tabular-nums mt-2">
            {booking.property_title}
            <span className="text-slate-300 mx-1.5">·</span>
            {formatGuests(booking.guests)} · sleeps {booking.property_max_guests}
            <span className="text-slate-300 mx-1.5">·</span>
            {booking.property_bedrooms} bed
            <span className="text-slate-300 mx-1.5">·</span>
            {booking.property_bathrooms} bath
            <span className="text-slate-300 mx-1.5">·</span>
            {booking.property_m2} m²
          </p>

          {/* Editable time stamps. Default check-in / check-out times come
              from finca.json — shown as a muted hint so admin knows the
              estate policy without leaving the page. */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs font-mono uppercase tracking-widest text-slate-400">
                  Check-in time
                </p>
                <p className="text-xs text-slate-300 mt-0.5">
                  policy: after {fincaData.check_in_time}
                </p>
              </div>
              <EditableTime
                bookingId={booking.id}
                field="check_in"
                value={booking.time_check_in}
              />
            </div>
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs font-mono uppercase tracking-widest text-slate-400">
                  Check-out time
                </p>
                <p className="text-xs text-slate-300 mt-0.5">
                  policy: before {fincaData.check_out_time}
                </p>
              </div>
              <EditableTime
                bookingId={booking.id}
                field="check_out"
                value={booking.time_check_out}
              />
            </div>
          </div>

          {!booking.user_id && booking.status !== 'cancelled' && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <AssignUserPicker bookingId={booking.id} users={assignableUsers} />
            </div>
          )}
        </StatsCard>
      </div>

      {/* Cancellation card — only when cancelled. Rose-tinted to flag it
          visually without bleeding into the always-visible cards. Same
          shadow as the rest so the visual weight stays consistent. */}
      {booking.status === 'cancelled' && booking.cancelled_at && (
        <section className="rounded-2xl bg-rose-50/60 border border-rose-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 mb-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.4em] text-rose-700/70">
              <XCircle className="w-3.5 h-3.5" /> Cancellation
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-rose-700/50">
              {booking.policy_applied ?? 'policy'}
            </span>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <CancelKV label="By"          value={<span className="capitalize">{booking.cancelled_by}</span>} />
            <CancelKV label="When"        value={<span className="tabular-nums">{fmtDateTime(booking.cancelled_at)}</span>} />
            <CancelKV label="Refund owed" value={<span className="tabular-nums">{eur(booking.refund_amount_cents ?? 0)}</span>} />
            <CancelKV label="Refunded"    value={<span className="tabular-nums">{eur(booking.refunded_cents)}</span>} />
          </dl>
          {booking.cancellation_reason && (
            <blockquote className="mt-4 rounded-lg bg-white/60 border border-rose-100 px-3 py-2 text-xs italic text-rose-900">
              &ldquo;{booking.cancellation_reason}&rdquo;
            </blockquote>
          )}
        </section>
      )}

      {/* Payments transactions */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400">
            <Wallet className="w-3.5 h-3.5" /> Transactions
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-300">
            {payments.length} {payments.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {canRegisterCash && (
          <div className="mb-5 pb-5 border-b border-slate-100">
            <RegisterCashPayment
              bookingId={booking.id}
              agreedCents={booking.agreed_total_cents}
              paidCents={totalPaid}
              status={booking.status}
            />
          </div>
        )}

        <AdminTable
          columns={PAYMENT_COLUMNS}
          rows={payments}
          rowKey={(p) => p.id}
          emptyMessage="No payments yet."
        />
      </section>
    </div>
  );
}

// ─── Tiny chips + helpers ──────────────────────────────────────────────────

function nightsLabel(checkIn: string, checkOut: string): string {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '';
  const n = Math.max(0, Math.round((b - a) / 86_400_000));
  return `${n}n`;
}

function CancelKV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-mono uppercase tracking-widest text-rose-700/60">
        {label}
      </dt>
      <dd className="text-sm font-bold text-slate-900 mt-0.5 truncate">{value}</dd>
    </div>
  );
}

function PaymentMethodChip({
  method, stripeIntent,
}: {
  method: 'cash' | 'stripe' | string;
  stripeIntent: string | null;
}) {
  if (method === 'stripe' && stripeIntent) {
    return <StripeLink intentId={stripeIntent} />;
  }
  if (method === 'stripe') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-xs bg-violet-50 text-violet-800 ring-1 ring-violet-200">
        stripe
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-xs bg-amber-50 text-amber-800 ring-1 ring-amber-200">
      cash
    </span>
  );
}

function PaymentStatusChip({ status }: { status: string }) {
  const cls =
    status === 'succeeded' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
    status === 'pending'   ? 'bg-amber-50 text-amber-700 ring-amber-200'       :
                             'bg-rose-50 text-rose-700 ring-rose-200';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-xs ring-1 ${cls}`}>
      {status}
    </span>
  );
}

// ─── Payments table columns ────────────────────────────────────────────────

const PAYMENT_COLUMNS: AdminTableColumn<Payment>[] = [
  {
    key: 'type',
    header: 'Type',
    width: 'minmax(0,0.8fr)',
    render: (p) => (
      <span className="font-mono uppercase tracking-widest text-xs text-slate-700">
        {p.type}
      </span>
    ),
  },
  {
    key: 'method',
    header: 'Method',
    width: 'minmax(0,0.7fr)',
    render: (p) => <PaymentMethodChip method={p.method} stripeIntent={p.stripe_payment_intent} />,
  },
  {
    key: 'status',
    header: 'Status',
    width: 'minmax(0,0.7fr)',
    render: (p) => <PaymentStatusChip status={p.status} />,
  },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    width: '100px',
    render: (p) => (
      <span className="font-mono tabular-nums text-sm text-slate-900">
        {eur(p.amount_cents)}
      </span>
    ),
  },
  {
    key: 'refunded',
    header: 'Refunded',
    align: 'right',
    width: '100px',
    render: (p) => p.refunded_cents > 0 ? (
      <span className="font-mono tabular-nums text-sm text-rose-700">
        −{eur(p.refunded_cents)}
      </span>
    ) : (
      <span className="text-slate-300">—</span>
    ),
  },
  {
    key: 'when',
    header: 'When',
    align: 'right',
    width: '170px',
    render: (p) => (
      <span className="text-xs font-mono text-slate-400 tabular-nums">
        {fmtDateTime(p.paid_at)}
      </span>
    ),
  },
  {
    key: 'action',
    header: '',
    align: 'right',
    width: '130px',
    render: (p) => (
      <PaymentRowAction
        paymentId={p.id}
        method={p.method}
        status={p.status}
        amountCents={p.amount_cents}
        refundedCents={p.refunded_cents}
      />
    ),
  },
];
