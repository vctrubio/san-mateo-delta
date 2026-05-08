// Smoke test the Stripe keys by creating a real Checkout Session against
// a real booking from the seed. Confirms keys + session creation work
// before we hook this into the booking form.
//
//   bun db:smoke-stripe
//
// Run-once after dropping in test keys. Safe — test mode only, no money moves.

import Stripe from 'stripe';
import { pool } from './client';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error('STRIPE_SECRET_KEY not set in .env.local');

const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });

const { rows } = await pool.query<{
  id: string;
  property_title: string;
  check_in: string;
  check_out: string;
  total_cents: number;
}>(
  `SELECT b.id::text                              AS id,
          p.title                                 AS property_title,
          b.date_check_in::text                   AS check_in,
          b.date_check_out::text                  AS check_out,
          (b.agreed_property_cents + b.agreed_cleaning_cents)::int AS total_cents
     FROM bookings b
     JOIN properties p ON p.id = b.property_id
    WHERE b.status = 'request'
    ORDER BY b.id ASC
    LIMIT 1`,
);

const booking = rows[0];
if (!booking) {
  console.log('ℹ no request bookings to test against; run `bun db:fullseason` first');
  process.exit(0);
}

console.log(`→ creating test Checkout Session for booking #${booking.id} (${booking.property_title}, ${booking.check_in}→${booking.check_out})`);
console.log(`  amount: €${(booking.total_cents / 100).toFixed(2)}`);

const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['card'],
  line_items: [
    {
      price_data: {
        currency: 'eur',
        unit_amount: booking.total_cents,
        product_data: { name: `${booking.property_title} · smoke test` },
      },
      quantity: 1,
    },
  ],
  client_reference_id: booking.id,
  metadata: { smoke_test: 'true', booking_id: booking.id },
  success_url: 'http://localhost:3000/checkout/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'http://localhost:3000/checkout/cancel',
});

console.log(`✓ session created: ${session.id}`);
console.log(`  url: ${session.url}`);
console.log(`  status: ${session.status}, payment_status: ${session.payment_status}`);
console.log('');
console.log('Open the URL above to test-pay with card 4242 4242 4242 4242.');
console.log('Expiry: any future date. CVC: any 3 digits. ZIP: any 5 digits.');

await pool.end();
