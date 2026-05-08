// Populates the DB with a year of mock activity so the app shows what a busy
// estate looks like. Run with:
//
//   bun --env-file=.env.local run db/seed_fullseason.ts
//   # or:
//   bun db:fullseason     (resets schema + this seeder)
//
// Window: today − 270d → today + 90d. Each property gets a timeline of ~25
// bookings of varying length (3–14 nights) with small gaps. Statuses are
// derived from date position relative to today so the dashboard renders a
// realistic mix of checked_out / cancelled / confirmed / checked_in / request /
// invite. property_blocks are sprinkled in for owner stays + maintenance.
//
// Output is deterministic (seeded PRNG) so re-runs produce the same dataset.

import { pool } from './client';
import {
  HIGH_SEASON_MONTHS,
  type BookingStatus,
  type CancelledBy,
  type Month,
} from './enums';
import { computeRefund } from '../src/lib/refund';

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic PRNG (mulberry32) so the dataset is identical every run.

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xfeed_5a17);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function pickWeighted<T>(items: ReadonlyArray<readonly [T, number]>): T {
  const total = items.reduce((acc, [, w]) => acc + w, 0);
  let r = rand() * total;
  for (const [item, weight] of items) {
    r -= weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1][0];
}

function intBetween(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

// ─────────────────────────────────────────────────────────────────────────────
// Static reference data.

type PropertySeed = {
  slug: 'levante' | 'estrecho' | 'marea' | 'cala';
  title: string;
  description: string;
  features: string[];
  bedrooms: number;
  bathrooms: number;
  m2: number;
  max_guests: number;
  low_cents: number;
  high_cents: number;
  cleaning_cents: number;
};

const PROPERTIES: PropertySeed[] = [
  { slug: 'levante',  title: 'The Villa',     description: 'Our flagship villa. A masterpiece of coastal architecture featuring expansive living spaces and direct access to the estate gardens.', features: ['Fully Equipped Kitchen', 'Master Suite'],           bedrooms: 3, bathrooms: 2, m2: 180, max_guests: 6, low_cents: 35000, high_cents: 48000, cleaning_cents: 12000 },
  { slug: 'estrecho', title: 'The Residence', description: 'Perfect for families or groups. A spacious residence with views across the Strait of Gibraltar.',                                       features: ['Ocean Views', 'Outdoor Dining Area', 'Fireplace', '2 Bedrooms'], bedrooms: 2, bathrooms: 1, m2: 110, max_guests: 4, low_cents: 24000, high_cents: 33000, cleaning_cents: 9000 },
  { slug: 'marea',    title: 'The Retreat',   description: 'An intimate retreat for couples. Minimalist design meets the raw beauty of the Tarifa coast.',                                          features: ['Minimalist Design', 'King Bed', 'Coffee Station', 'Sun Deck'],   bedrooms: 1, bathrooms: 1, m2: 60,  max_guests: 2, low_cents: 16000, high_cents: 22000, cleaning_cents: 6000 },
  { slug: 'cala',     title: 'The Bungalow',  description: 'Cosy and secluded. A charming bungalow perfect for solo travelers or a quiet getaway.',                                                  features: ['Secluded Location', 'Garden Access', 'Compact Kitchen', 'Modern Bath'], bedrooms: 1, bathrooms: 1, m2: 45,  max_guests: 2, low_cents: 14000, high_cents: 19000, cleaning_cents: 5000 },
];

// 30 fictional guests. Mostly European names for the Tarifa context.
const GUESTS: ReadonlyArray<{ name: string; email: string; nationality: string }> = [
  { name: 'David',          email: 'hello@fincasanmateo.com', nationality: 'ES' },
  { name: 'Maria García',   email: 'maria@example.com',       nationality: 'ES' },
  { name: 'Tom Ainsley',    email: 'tom@example.com',         nationality: 'GB' },
  { name: 'Lucia Romano',   email: 'lucia.romano@mail.it',    nationality: 'IT' },
  { name: 'Henrik Sørensen',email: 'henrik.s@dk.example',     nationality: 'DK' },
  { name: 'Sofie Petersen', email: 'sofie@dk.example',        nationality: 'DK' },
  { name: 'Klaus Müller',   email: 'klaus.m@de.example',      nationality: 'DE' },
  { name: 'Anna Schmidt',   email: 'anna.s@de.example',       nationality: 'DE' },
  { name: 'Jean Dupont',    email: 'jean.d@fr.example',       nationality: 'FR' },
  { name: 'Camille Laurent',email: 'camille@fr.example',      nationality: 'FR' },
  { name: 'Olivier Martin', email: 'olivier@fr.example',      nationality: 'FR' },
  { name: 'Isabel Costa',   email: 'isabel@pt.example',       nationality: 'PT' },
  { name: 'João Silva',     email: 'joao@pt.example',         nationality: 'PT' },
  { name: 'Carla Bianchi',  email: 'carla@it.example',        nationality: 'IT' },
  { name: 'Marco Conti',    email: 'marco.c@it.example',      nationality: 'IT' },
  { name: 'Sara Lindqvist', email: 'sara@se.example',         nationality: 'SE' },
  { name: 'Erik Olsson',    email: 'erik.o@se.example',       nationality: 'SE' },
  { name: 'Agnes Berg',     email: 'agnes@se.example',        nationality: 'SE' },
  { name: 'Niamh Byrne',    email: 'niamh@ie.example',        nationality: 'IE' },
  { name: 'Patrick Walsh',  email: 'patrick@ie.example',      nationality: 'IE' },
  { name: 'Sophie Bennett', email: 'sophie@uk.example',       nationality: 'GB' },
  { name: 'James Hartley',  email: 'james@uk.example',        nationality: 'GB' },
  { name: 'Emma Carter',    email: 'emma@uk.example',         nationality: 'GB' },
  { name: 'Pieter de Vries',email: 'pieter@nl.example',       nationality: 'NL' },
  { name: 'Lotte Janssen',  email: 'lotte@nl.example',        nationality: 'NL' },
  { name: 'Jonas Frey',     email: 'jonas@ch.example',        nationality: 'CH' },
  { name: 'Lara Schneider', email: 'lara@ch.example',         nationality: 'CH' },
  { name: 'Pablo Ruiz',     email: 'pablo@es.example',        nationality: 'ES' },
  { name: 'Elena Vega',     email: 'elena@es.example',        nationality: 'ES' },
  { name: 'Diego Torres',   email: 'diego@es.example',        nationality: 'ES' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers — operate on UTC ms timestamps.

const DAY = 1000 * 60 * 60 * 24;
const TODAY = startOfDayUtc(new Date());

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / DAY);
}

function daysBefore(date: string, n: number): string {
  return new Date(Date.parse(date) - n * DAY).toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking generation.

type GeneratedBooking = {
  property: PropertySeed;
  in: string;
  out: string;
  status: BookingStatus;
  guestIdx: number | null;   // null = admin-only booking (owner family / staff)
  adults: number;
  children: number;
  pets: number;
  cancelled_by?: CancelledBy;
  cancellation_reason?: string;
};

type GeneratedBlock = {
  property: PropertySeed;
  in: string;
  out: string;
  reason: string;
};

const WINDOW_START = addDays(TODAY, -270);
const WINDOW_END   = addDays(TODAY, +90);

function statusFor(checkInStr: string, checkOutStr: string): BookingStatus {
  const ci = new Date(checkInStr);
  const co = new Date(checkOutStr);
  const now = TODAY.getTime();

  // Currently in-house: started, hasn't departed
  if (ci.getTime() <= now && co.getTime() > now) {
    return 'checked_in';
  }
  // Past stays
  if (co.getTime() <= now) {
    return pickWeighted<BookingStatus>([
      ['checked_out', 0.86],
      ['cancelled',   0.14],
    ]);
  }
  // Soon (within 30 days from now)
  if (ci.getTime() <= now + 30 * DAY) {
    return pickWeighted<BookingStatus>([
      ['confirmed', 0.65],
      ['request',   0.20],
      ['invite',    0.10],
      ['cancelled', 0.05],
    ]);
  }
  // Further out
  return pickWeighted<BookingStatus>([
    ['confirmed', 0.45],
    ['request',   0.30],
    ['invite',    0.20],
    ['cancelled', 0.05],
  ]);
}

function generateForProperty(prop: PropertySeed): { bookings: GeneratedBooking[]; blocks: GeneratedBlock[] } {
  const bookings: GeneratedBooking[] = [];
  const blocks: GeneratedBlock[] = [];

  // Walk forward day-by-day. At each cursor, randomly: (a) start a booking, (b)
  // start a block, or (c) skip a day. This guarantees no overlap on the
  // property's timeline.
  let cursor = WINDOW_START;
  const blockReasons = [
    'Owner family stay',
    'Maintenance window',
    'Pool resurfacing',
    'Pause listing',
    'Renovation',
    'Roof inspection',
  ];

  while (cursor.getTime() < WINDOW_END.getTime()) {
    const roll = rand();

    if (roll < 0.08 && blocks.length < 3) {
      // Block: 4–8 days
      const len = intBetween(4, 8);
      const start = cursor;
      const end = addDays(start, len);
      if (end.getTime() > WINDOW_END.getTime()) break;
      blocks.push({
        property: prop,
        in: ymd(start),
        out: ymd(end),
        reason: pick(blockReasons),
      });
      cursor = addDays(end, intBetween(0, 4));
      continue;
    }

    if (roll < 0.85) {
      // Booking: 3–14 nights, with seasonal bias toward longer stays in summer
      const month = (cursor.getUTCMonth() + 1) as Month;
      const isHigh = HIGH_SEASON_MONTHS.includes(month);
      const minNights = isHigh ? 5 : 3;
      const maxNights = isHigh ? 14 : 9;
      const nights = intBetween(minNights, maxNights);
      const start = cursor;
      const end = addDays(start, nights);
      if (end.getTime() > WINDOW_END.getTime()) break;
      const status = statusFor(ymd(start), ymd(end));

      const guestIdx = rand() < 0.06 ? null : intBetween(1, GUESTS.length - 1); // skip index 0 (David — admin)
      const adults = Math.min(prop.max_guests, intBetween(1, Math.max(2, prop.max_guests - 1)));
      const children = rand() < 0.3 ? intBetween(0, Math.max(0, prop.max_guests - adults)) : 0;
      const pets = rand() < 0.18 ? intBetween(1, 2) : 0;

      bookings.push({
        property: prop,
        in: ymd(start),
        out: ymd(end),
        status,
        guestIdx,
        adults,
        children,
        pets,
        cancelled_by: status === 'cancelled' ? (rand() < 0.65 ? 'guest' : 'admin') : undefined,
        cancellation_reason:
          status === 'cancelled'
            ? pick([
                'Guest changed plans',
                'Travel restrictions',
                'Family emergency',
                'Couldn\'t arrange flights',
                'Found alternative accommodation',
                'Host cancelled — overbooking',
                'Maintenance conflict',
              ])
            : undefined,
      });
      cursor = addDays(end, intBetween(0, 4));
      continue;
    }

    // Skip a few empty days
    cursor = addDays(cursor, intBetween(1, 3));
  }

  return { bookings, blocks };
}

function rateForCheckIn(p: PropertySeed, checkIn: string): number {
  const month = Number(checkIn.slice(5, 7)) as Month;
  return HIGH_SEASON_MONTHS.includes(month) ? p.high_cents : p.low_cents;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB inserters

async function clearAll() {
  // CASCADE wipes all booking-related child rows.
  await pool.query(`TRUNCATE bookings RESTART IDENTITY CASCADE`);
  await pool.query(`TRUNCATE property_blocks RESTART IDENTITY CASCADE`);
  await pool.query(`TRUNCATE users RESTART IDENTITY CASCADE`);
}

async function seedUsers(): Promise<string[]> {
  const ids: string[] = [];
  for (const u of GUESTS) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (name, email, nationality)
       VALUES ($1, $2, $3)
       RETURNING id::text`,
      [u.name, u.email, u.nationality],
    );
    ids.push(rows[0].id);
  }
  console.log(`✓ ${GUESTS.length} users`);
  return ids;
}

async function seedProperties(): Promise<Record<string, { id: string; seed: PropertySeed }>> {
  const out: Record<string, { id: string; seed: PropertySeed }> = {};
  for (const p of PROPERTIES) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO properties (
         slug, title, description, features,
         bedrooms, bathrooms, m2, max_guests, cleaning_fee_cents
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)
       ON CONFLICT (slug) DO UPDATE
         SET title = EXCLUDED.title,
             description = EXCLUDED.description,
             features = EXCLUDED.features,
             bedrooms = EXCLUDED.bedrooms,
             bathrooms = EXCLUDED.bathrooms,
             m2 = EXCLUDED.m2,
             max_guests = EXCLUDED.max_guests,
             cleaning_fee_cents = EXCLUDED.cleaning_fee_cents
       RETURNING id::text`,
      [p.slug, p.title, p.description, JSON.stringify(p.features),
       p.bedrooms, p.bathrooms, p.m2, p.max_guests, p.cleaning_cents],
    );
    out[p.slug] = { id: rows[0].id, seed: p };

    // Seasonal rates (matches db/seed.ts).
    const seasons: Array<{ name: string; months: number[]; cents: number }> = [
      { name: 'Low Season',  months: [1,2,3,4,5,9,10,11,12], cents: p.low_cents  },
      { name: 'High Season', months: [6,7,8],                cents: p.high_cents },
    ];
    for (const s of seasons) {
      await pool.query(
        `INSERT INTO property_rates (property_id, name, active, public, min_nights, months, night_rate_cents)
         SELECT $1, $2, true, true, 2, $3::int[], $4
         WHERE NOT EXISTS (
           SELECT 1 FROM property_rates WHERE property_id = $1 AND name = $2
         )`,
        [rows[0].id, s.name, s.months, s.cents],
      );
    }
  }
  console.log(`✓ ${PROPERTIES.length} properties (Low + High Season rates)`);
  return out;
}

async function seedBookings(
  propertyIds: Record<string, { id: string; seed: PropertySeed }>,
  userIds: string[],
  bookings: GeneratedBooking[],
) {
  let count = 0;
  for (const b of bookings) {
    const propRow = propertyIds[b.property.slug];
    const userId = b.guestIdx !== null ? userIds[b.guestIdx] : null;
    const nights = nightsBetween(b.in, b.out);
    const nightRate = rateForCheckIn(b.property, b.in);
    const agreedProperty = nights * nightRate;
    const agreedCleaning = b.property.cleaning_cents;
    const agreedTotal = agreedProperty + agreedCleaning;

    const guests = JSON.stringify({
      adults: b.adults,
      children: b.children,
      infants: 0,
      pets: b.pets,
    });

    const createdAt = daysBefore(b.in, intBetween(7, 45));
    const cancelledAt = b.status === 'cancelled' ? daysBefore(b.in, intBetween(1, 30)) : null;
    const timeIn  = b.status === 'checked_in' || b.status === 'checked_out' ? `${b.in}T16:00:00Z`  : null;
    const timeOut = b.status === 'checked_out'                              ? `${b.out}T11:00:00Z` : null;

    let bookingId: string;
    try {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO bookings (
           property_id, user_id, date_check_in, date_check_out,
           agreed_property_cents, agreed_cleaning_cents,
           status, guests, time_check_in, time_check_out,
           created_at, updated_at
         ) VALUES (
           $1, $2, $3::date, $4::date,
           $5, $6,
           $7::booking_status, $8::jsonb, $9, $10,
           $11, $11
         ) RETURNING id::text`,
        [propRow.id, userId, b.in, b.out, agreedProperty, agreedCleaning,
         b.status, guests, timeIn, timeOut, createdAt],
      );
      bookingId = rows[0].id;
    } catch (err) {
      // Defensive: if our walker ever produced an overlap (shouldn't happen
      // since we walk forward), skip and keep going.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('no_overlap_when_held')) {
        continue;
      }
      throw err;
    }

    if (b.status === 'cancelled') {
      const refund = computeRefund({
        agreedPropertyCents: agreedProperty,
        agreedCleaningCents: agreedCleaning,
        checkInDate: b.in,
        cancelledAt: new Date(cancelledAt!),
      });
      await pool.query(
        `INSERT INTO booking_cancellations (
           booking_id, cancelled_by, reason, refund_amount_cents, policy_applied, cancelled_at
         ) VALUES ($1, $2::cancelled_by, $3, $4, $5, $6)`,
        [bookingId, b.cancelled_by ?? 'guest', b.cancellation_reason ?? null,
         refund.refundAmountCents, refund.policyApplied, cancelledAt],
      );
    }

    // Payments — mix of cash and stripe. Deterministic via seeded rand().
    // ~60% of historical payments go via stripe (fake pi_/ch_/cs_ ids that match
    // Stripe's id shapes but never hit Stripe — they're indicators only).
    const usingStripe = () => rand() < 0.6;
    const stripeIds = () => {
      const sid = `cs_test_seed_${bookingId}_${Math.floor(rand() * 1e6)}`;
      const pi  = `pi_test_seed_${bookingId}_${Math.floor(rand() * 1e6)}`;
      const ch  = `ch_test_seed_${bookingId}_${Math.floor(rand() * 1e6)}`;
      return { sid, pi, ch };
    };

    async function insertPayment(args: {
      type: 'reservation' | 'deposit' | 'balance';
      amount: number;
      paid_at: string;
      stripe?: boolean;
      status?: 'pending' | 'succeeded' | 'failed';
    }): Promise<string> {
      const status = args.status ?? 'succeeded';
      if (args.stripe) {
        const { sid, pi, ch } = stripeIds();
        const { rows } = await pool.query<{ id: string }>(
          `INSERT INTO booking_payments (booking_id, type, amount_cents, method, status,
                                         stripe_session_id, stripe_payment_intent, stripe_charge_id,
                                         paid_at, created_at)
           VALUES ($1, $2::payment_type, $3, 'stripe', $4::payment_status, $5, $6, $7, $8, $8)
           RETURNING id::text`,
          [bookingId, args.type, args.amount, status, sid,
           status === 'pending' ? null : pi,
           status === 'pending' ? null : ch,
           args.paid_at],
        );
        return rows[0].id;
      }
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO booking_payments (booking_id, type, amount_cents, method, status, paid_at, created_at)
         VALUES ($1, $2::payment_type, $3, 'cash', $4::payment_status, $5, $5)
         RETURNING id::text`,
        [bookingId, args.type, args.amount, status, args.paid_at],
      );
      return rows[0].id;
    }

    if (b.status === 'checked_in' || b.status === 'checked_out') {
      // Most pay in full at reservation time. Occasionally split deposit + balance.
      const stripe = usingStripe();
      if (rand() < 0.7) {
        await insertPayment({ type: 'reservation', amount: agreedTotal, paid_at: daysBefore(b.in, 14), stripe });
      } else {
        const deposit = Math.round(agreedTotal * 0.3);
        await insertPayment({ type: 'deposit', amount: deposit, paid_at: daysBefore(b.in, 30), stripe });
        await insertPayment({ type: 'balance', amount: agreedTotal - deposit, paid_at: `${b.in}T15:00:00Z`, stripe });
      }
    } else if (b.status === 'confirmed') {
      // Roughly half of confirmed-future bookings have paid a deposit already.
      // The other half: pending cash (still owed) so /admin "Pending cash" tile lights up.
      if (rand() < 0.5) {
        const deposit = Math.round(agreedTotal * 0.3);
        await insertPayment({ type: 'deposit', amount: deposit, paid_at: daysBefore(b.in, intBetween(1, 14)), stripe: usingStripe() });
      } else {
        // "Cash on arrival" intent — pending cash row equal to full agreed total.
        await insertPayment({ type: 'reservation', amount: agreedTotal, paid_at: createdAt, stripe: false, status: 'pending' });
      }
    } else if (b.status === 'request' && rand() < 0.15) {
      // ~15% of request bookings have an abandoned Stripe checkout session
      // (pending stripe row). Helps demo the failed/pending UX in /admin/payments.
      const deposit = Math.round(agreedTotal * 0.3);
      await insertPayment({ type: 'deposit', amount: deposit, paid_at: createdAt, stripe: true, status: 'pending' });
    } else if (b.status === 'cancelled') {
      // Half of cancelled had paid a deposit; refund follows the policy outcome.
      if (rand() < 0.55) {
        const deposit = Math.round(agreedTotal * 0.3);
        const stripe = usingStripe();
        const paymentId = await insertPayment({ type: 'deposit', amount: deposit, paid_at: createdAt, stripe });
        const refund = computeRefund({
          agreedPropertyCents: agreedProperty,
          agreedCleaningCents: agreedCleaning,
          checkInDate: b.in,
          cancelledAt: new Date(cancelledAt!),
        });
        const refunded = Math.min(deposit, refund.refundAmountCents);
        if (refunded > 0) {
          await pool.query(
            `INSERT INTO payment_refunds (payment_id, amount_cents, note, stripe_refund_id, created_at)
             VALUES ($1, $2, 'Cancellation refund', $3, $4)`,
            [paymentId, refunded,
             stripe ? `re_test_seed_${paymentId}_${Math.floor(rand() * 1e6)}` : null,
             cancelledAt],
          );
        }
      }
    }

    // Events
    const events: Array<[string, string]> = [['booking.created', createdAt]];
    if (b.status !== 'request') events.push(['booking.confirmed', daysBefore(b.in, intBetween(2, 12))]);
    if (b.status === 'checked_in' || b.status === 'checked_out') events.push(['booking.checked_in', timeIn!]);
    if (b.status === 'checked_out') events.push(['booking.checked_out', timeOut!]);
    if (b.status === 'cancelled') events.push(['booking.cancelled', cancelledAt!]);

    for (const [type, at] of events) {
      await pool.query(
        `INSERT INTO booking_events (booking_id, event_type, payload, created_at)
         VALUES ($1, $2, '{}'::jsonb, $3)`,
        [bookingId, type, at],
      );
    }
    count++;
  }
  console.log(`✓ ${count} bookings`);
}

async function seedBlocks(
  propertyIds: Record<string, { id: string; seed: PropertySeed }>,
  blocks: GeneratedBlock[],
) {
  let count = 0;
  for (const b of blocks) {
    try {
      await pool.query(
        `INSERT INTO property_blocks (property_id, date_check_in, date_check_out, reason)
         VALUES ($1, $2::date, $3::date, $4)`,
        [propertyIds[b.property.slug].id, b.in, b.out, b.reason],
      );
      count++;
    } catch {
      // Same defensive skip as bookings.
    }
  }
  console.log(`✓ ${count} property_blocks`);
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`→ window: ${ymd(WINDOW_START)} → ${ymd(WINDOW_END)} (today=${ymd(TODAY)})`);

  await clearAll();
  const userIds = await seedUsers();
  const propertyIds = await seedProperties();

  const allBookings: GeneratedBooking[] = [];
  const allBlocks: GeneratedBlock[] = [];
  for (const p of PROPERTIES) {
    const { bookings, blocks } = generateForProperty(p);
    allBookings.push(...bookings);
    allBlocks.push(...blocks);
  }

  await seedBookings(propertyIds, userIds, allBookings);
  await seedBlocks(propertyIds, allBlocks);

  // Status breakdown for the console summary.
  const byStatus = await pool.query<{ status: string; n: number }>(
    `SELECT status::text, COUNT(*)::int AS n FROM bookings GROUP BY status ORDER BY 1`,
  );
  console.log('\nBooking distribution:');
  for (const r of byStatus.rows) {
    console.log(`  ${r.status.padEnd(12)} ${r.n}`);
  }
  console.log('\n✓ full-season seed complete');
}

main()
  .catch((err) => {
    console.error('✗ full-season seed failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
