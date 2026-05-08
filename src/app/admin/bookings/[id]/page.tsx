import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import StatusBadge from '@/components/admin/StatusBadge';
import BookingActionButtons from '@/components/admin/BookingActionButtons';
import PaymentActionButtons from '@/components/admin/PaymentActionButtons';
import CancelBookingForm from '@/components/admin/CancelBookingForm';
import { markCashReceived, refundStripePayment } from '@/actions/payments';
import { getBookingById, listBookingEvents } from '@/lib/bookings';
import { listPaymentsForBooking } from '@/lib/payments';

export const dynamic = 'force-dynamic';

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const booking = await getBookingById(id);
  if (!booking) notFound();
  const [payments, events] = await Promise.all([
    listPaymentsForBooking(id),
    listBookingEvents(id),
  ]);

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/admin/bookings" className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-slate-400 hover:text-ocean mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> back
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Booking #{booking.id}</h1>
            <StatusBadge status={booking.status} />
          </div>
          <p className="text-sm text-slate-500">
            {booking.property_slug} · {booking.property_title} · {booking.date_check_in} → {booking.date_check_out}
          </p>
        </div>
        <BookingActionButtons bookingId={booking.id} currentStatus={booking.status} size="md" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <Card label="Guest">
          {booking.user_id ? (
            <Link href={`/admin/users/${booking.user_id}`} className="block hover:text-ocean">
              <div className="font-bold text-slate-900">{booking.user_name}</div>
              <div className="text-[11px] text-slate-400 font-mono">{booking.user_email}</div>
            </Link>
          ) : (
            <span className="italic text-slate-400">no user (admin booking)</span>
          )}
        </Card>
        <Card label="Guests">
          <div className="font-bold text-slate-900">
            {booking.guests.adults}A · {booking.guests.children}C · {booking.guests.infants}I · {booking.guests.pets}🐾
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">max {booking.property_max_guests} on this property</div>
        </Card>
        <Card label="Pricing">
          <div className="font-bold text-slate-900">{eur(booking.agreed_total_cents)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            <span title="David's revenue">{eur(booking.agreed_property_cents)} property</span>
            {' + '}
            <span title="Tano's pay">{eur(booking.agreed_cleaning_cents)} cleaning</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">paid: {eur(booking.paid_cents)} · outstanding: {eur(Math.max(0, booking.agreed_total_cents - booking.paid_cents))}</div>
        </Card>
      </div>

      {booking.status === 'cancelled' && booking.cancelled_at && (
        <section className="mb-10 rounded-2xl bg-rose-50 border border-rose-200 p-5">
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-rose-800 mb-2">Cancellation</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-rose-700/60">By</div>
              <div className="text-slate-900 font-bold">{booking.cancelled_by}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-rose-700/60">Refund owed</div>
              <div className="text-slate-900 font-bold">
                {eur(booking.refund_amount_cents ?? 0)}{' '}
                <span className="text-rose-700/60 text-[11px]">({booking.policy_applied})</span>
              </div>
              <div className="text-[11px] text-rose-700/60">refunded: {eur(booking.refunded_cents)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-rose-700/60">When</div>
              <div className="text-slate-900 font-bold">{new Date(booking.cancelled_at).toLocaleString('en-GB')}</div>
            </div>
          </div>
          {booking.cancellation_reason && (
            <div className="mt-3 text-[12px] text-rose-900 italic">"{booking.cancellation_reason}"</div>
          )}
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">Record payment (cash · admin)</h2>
        <div className="rounded-2xl bg-white border border-slate-100 p-5">
          <PaymentActionButtons
            bookingId={booking.id}
            agreedCents={booking.agreed_total_cents}
            paidCents={booking.paid_cents}
            status={booking.status}
          />
        </div>
      </section>

      {booking.status !== 'cancelled' && booking.status !== 'checked_out' && (
        <section className="mb-10">
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">
            Cancel (admin)
          </h2>
          <div className="rounded-2xl bg-white border border-slate-100 p-5">
            <CancelBookingForm bookingId={booking.id} status={booking.status} cancelledBy="admin" />
            <p className="text-[11px] text-slate-400 mt-2">
              Refund amount is computed by <code className="font-mono">docs/refund.md</code> policy from agreed total
              and days-before-check-in.
            </p>
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">Payments ({payments.length})</h2>
        <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
          {payments.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">No payments yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Method</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">Amount</th>
                  <th className="text-right px-4 py-2">Refunded</th>
                  <th className="text-right px-4 py-2">When</th>
                  <th className="text-right px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const stripeUrl = p.method === 'stripe' && p.stripe_payment_intent
                    ? `https://dashboard.stripe.com/test/payments/${p.stripe_payment_intent}`
                    : null;
                  return (
                    <tr key={p.id} className="border-t border-slate-50">
                      <td className="px-4 py-2 font-mono text-[12px]">{p.type}</td>
                      <td className="px-4 py-2">
                        {p.method === 'stripe' && stripeUrl ? (
                          <a href={stripeUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] bg-violet-50 text-violet-800 ring-1 ring-violet-200">
                            stripe <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] bg-amber-50 text-amber-800 ring-1 ring-amber-200">cash</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] ring-1 ${
                          p.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : p.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-200'
                          : 'bg-rose-50 text-rose-700 ring-rose-200'
                        }`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums">{eur(p.amount_cents)}</td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-700">{p.refunded_cents > 0 ? `−${eur(p.refunded_cents)}` : '—'}</td>
                      <td className="px-4 py-2 text-right text-[11px] font-mono text-slate-400">{new Date(p.paid_at).toLocaleString('en-GB')}</td>
                      <td className="px-4 py-2 text-right">
                        {p.method === 'cash' && p.status === 'pending' && (
                          <form action={markCashReceived} className="inline-flex">
                            <input type="hidden" name="payment_id" value={p.id} />
                            <button type="submit" className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest rounded bg-emerald-600 text-white hover:bg-emerald-700 transition">
                              Mark received
                            </button>
                          </form>
                        )}
                        {p.method === 'stripe' && p.status === 'succeeded' && p.amount_cents > p.refunded_cents && (
                          <form action={refundStripePayment} className="inline-flex">
                            <input type="hidden" name="payment_id" value={p.id} />
                            <button type="submit" className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest rounded bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 transition">
                              Refund full
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">Audit timeline ({events.length})</h2>
        <ol className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-xl bg-white border border-slate-100 px-5 py-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-ocean">{e.event_type}</div>
                {Object.keys(e.payload).length > 0 && (
                  <pre className="text-[10px] font-mono text-slate-400 mt-1 whitespace-pre-wrap">{JSON.stringify(e.payload, null, 2)}</pre>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-400 shrink-0">{new Date(e.created_at).toLocaleString('en-GB')}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-4">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">{label}</h3>
      {children}
    </div>
  );
}
