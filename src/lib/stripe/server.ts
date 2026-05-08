import 'server-only';
import Stripe from 'stripe';

/**
 * Server-side Stripe singleton. Uses STRIPE_SECRET_KEY from env. Throws clearly
 * if the key is missing so we don't get a cryptic Stripe SDK error at request time.
 *
 * In dev: use sk_test_… (test mode). Test cards: see docs/stripe.md.
 */
function makeStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Copy .env.example → .env.local and fill it in. See docs/stripe.md.',
    );
  }
  return new Stripe(key, {
    // Pin the API version for deterministic behavior; bump deliberately.
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
    appInfo: { name: 'finca-san-mateo', version: '0.1.0' },
  });
}

let _client: Stripe | null = null;

export function stripe(): Stripe {
  if (!_client) _client = makeStripe();
  return _client;
}

/** Whether Stripe is configured. UI can hide Stripe options if false. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Public app URL for building success/cancel URLs. */
export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}
