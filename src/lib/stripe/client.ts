'use client';
import { loadStripe, type Stripe } from '@stripe/stripe-js';

/**
 * Client-side Stripe loader (memoised). We only use this when the booking flow
 * needs to redirect to a Checkout Session — Stripe.js itself isn't strictly
 * required for hosted Checkout (the server returns session.url and we
 * window.location to it), but loading it once unlocks Elements later if/when
 * we embed the card form.
 */
let _stripePromise: Promise<Stripe | null> | null = null;

export function getStripeJs(): Promise<Stripe | null> {
  if (!_stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    _stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return _stripePromise;
}
