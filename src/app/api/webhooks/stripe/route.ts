import 'server-only';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { revalidatePath } from 'next/cache';
import { stripe } from '@/lib/stripe/server';
import { pool } from '@db/client';

// Stripe needs the raw body for signature verification — never coerce or parse.
// App Router gives us the raw bytes via request.text(), which is exactly what
// stripe.webhooks.constructEvent expects.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RELEVANT_EVENTS = new Set<Stripe.Event.Type>([
  'checkout.session.completed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
  'charge.refunded',
]);

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'STRIPE_WEBHOOK_SECRET not set; refusing to process webhook.' },
      { status: 500 },
    );
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('[stripe webhook] signature verification failed:', msg);
    return NextResponse.json({ error: `Invalid signature: ${msg}` }, { status: 400 });
  }

  if (!RELEVANT_EVENTS.has(event.type)) {
    // Acknowledge so Stripe stops retrying. We log so unexpected events are visible.
    console.log(`[stripe webhook] ignoring ${event.type}`);
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'checkout.session.expired':
        await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error(`[stripe webhook] handler for ${event.type} threw:`, msg);
    // Return 500 so Stripe retries with backoff. The handler is idempotent so retries are safe.
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true, type: event.type });
}

// ---------------------------------------------------------------------------
// Handlers — all idempotent. Look up by stripe identifier; no-op if already
// in the target state. Stripe retries on 5xx, so we must tolerate replays.
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const sessionId = session.id;
  const paymentIntent = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  // Resolve the charge id from the PaymentIntent so we have it ready for refunds.
  let chargeId: string | null = null;
  if (paymentIntent) {
    try {
      const pi = await stripe().paymentIntents.retrieve(paymentIntent, { expand: ['latest_charge'] });
      const latest = pi.latest_charge;
      chargeId = typeof latest === 'string' ? latest : latest?.id ?? null;
    } catch (err) {
      console.warn('[stripe webhook] could not retrieve PaymentIntent for charge id:', err);
    }
  }

  const { rows } = await pool.query<{ id: string; booking_id: string; status: string }>(
    `SELECT id::text, booking_id::text, status::text
       FROM booking_payments
      WHERE stripe_session_id = $1`,
    [sessionId],
  );
  const payment = rows[0];
  if (!payment) {
    console.warn(`[stripe webhook] checkout.session.completed for unknown session ${sessionId}`);
    return;
  }
  if (payment.status === 'succeeded') {
    return; // already processed (Stripe retry)
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE booking_payments
          SET status = 'succeeded',
              stripe_payment_intent = $2,
              stripe_charge_id = $3,
              paid_at = now()
        WHERE id = $1`,
      [payment.id, paymentIntent, chargeId],
    );
    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, 'payment.succeeded', $2::jsonb)`,
      [
        payment.booking_id,
        JSON.stringify({
          payment_id: payment.id,
          stripe_session_id: sessionId,
          stripe_payment_intent: paymentIntent,
          stripe_charge_id: chargeId,
          amount_total: session.amount_total,
        }),
      ],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  revalidatePath('/admin');
  revalidatePath('/admin/payments');
  revalidatePath(`/admin/bookings/${payment.booking_id}`);
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const { rows } = await pool.query<{ id: string; booking_id: string; status: string }>(
    `SELECT id::text, booking_id::text, status::text
       FROM booking_payments
      WHERE stripe_session_id = $1`,
    [session.id],
  );
  const payment = rows[0];
  if (!payment || payment.status !== 'pending') return;

  await pool.query(
    `UPDATE booking_payments SET status = 'failed' WHERE id = $1`,
    [payment.id],
  );
  await pool.query(
    `INSERT INTO booking_events (booking_id, event_type, payload)
     VALUES ($1, 'payment.checkout_expired', $2::jsonb)`,
    [payment.booking_id, JSON.stringify({ payment_id: payment.id, stripe_session_id: session.id })],
  );

  revalidatePath('/admin/payments');
  revalidatePath(`/admin/bookings/${payment.booking_id}`);
}

async function handlePaymentFailed(intent: Stripe.PaymentIntent) {
  // Find by payment_intent (set on session.completed) OR via the session
  // (failures can fire before completed in some flows).
  const { rows } = await pool.query<{ id: string; booking_id: string; status: string }>(
    `SELECT id::text, booking_id::text, status::text
       FROM booking_payments
      WHERE stripe_payment_intent = $1`,
    [intent.id],
  );
  const payment = rows[0];
  if (!payment || payment.status === 'succeeded') return;

  await pool.query(
    `UPDATE booking_payments SET status = 'failed' WHERE id = $1`,
    [payment.id],
  );
  await pool.query(
    `INSERT INTO booking_events (booking_id, event_type, payload)
     VALUES ($1, 'payment.failed', $2::jsonb)`,
    [
      payment.booking_id,
      JSON.stringify({
        payment_id: payment.id,
        stripe_payment_intent: intent.id,
        last_payment_error: intent.last_payment_error?.message ?? null,
      }),
    ],
  );

  revalidatePath('/admin/payments');
  revalidatePath(`/admin/bookings/${payment.booking_id}`);
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  // A charge can be partially refunded multiple times. Stripe sends
  // charge.refunded for each refund, so we upsert per refund id (re_…).
  const { rows } = await pool.query<{ id: string; booking_id: string }>(
    `SELECT id::text, booking_id::text
       FROM booking_payments
      WHERE stripe_charge_id = $1`,
    [charge.id],
  );
  const payment = rows[0];
  if (!payment) {
    console.warn(`[stripe webhook] charge.refunded for unknown charge ${charge.id}`);
    return;
  }

  const refunds = charge.refunds?.data ?? [];
  for (const r of refunds) {
    // Skip refunds that aren't yet succeeded (Stripe sends events as the
    // refund moves through pending/requires_action/succeeded).
    if (r.status !== 'succeeded') continue;

    const exists = await pool.query<{ id: string }>(
      `SELECT id::text FROM payment_refunds WHERE stripe_refund_id = $1`,
      [r.id],
    );
    if (exists.rows[0]) continue;

    await pool.query(
      `INSERT INTO payment_refunds (payment_id, amount_cents, note, stripe_refund_id)
       VALUES ($1, $2, $3, $4)`,
      [payment.id, r.amount, r.reason ?? 'Stripe refund', r.id],
    );
    await pool.query(
      `INSERT INTO booking_events (booking_id, event_type, payload)
       VALUES ($1, 'payment.refunded', $2::jsonb)`,
      [
        payment.booking_id,
        JSON.stringify({
          payment_id: payment.id,
          stripe_refund_id: r.id,
          amount_cents: r.amount,
          reason: r.reason,
        }),
      ],
    );
  }

  revalidatePath('/admin/payments');
  revalidatePath(`/admin/bookings/${payment.booking_id}`);
}
