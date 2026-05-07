import { pool } from './client';
import {
  HIGH_SEASON_MONTHS,
  LOW_SEASON_MONTHS,
  type BookingStatus,
  type Month,
} from './enums';

type PropertySeed = {
  slug: string;
  title: string;
  description: string;
  features: string[];
  bedrooms: number;
  bathrooms: number;
  m2: number;
  max_guests: number;
  low_cents: number;   // Low Season night rate (EUR cents)
  high_cents: number;  // High Season night rate (EUR cents)
  cleaning_cents: number;
};

const PROPERTIES: PropertySeed[] = [
  {
    slug: 'levante',
    title: 'The Villa',
    description:
      'Our flagship villa. A masterpiece of coastal architecture featuring expansive living spaces and direct access to the estate gardens.',
    features: ['Fully Equipped Kitchen', 'Master Suite'],
    bedrooms: 3,
    bathrooms: 2,
    m2: 180,
    max_guests: 6,
    low_cents:  35000,
    high_cents: 48000,
    cleaning_cents: 12000,
  },
  {
    slug: 'estrecho',
    title: 'The Residence',
    description:
      'Perfect for families or groups. A spacious residence with views across the Strait of Gibraltar.',
    features: ['Ocean Views', 'Outdoor Dining Area', 'Fireplace', '2 Bedrooms'],
    bedrooms: 2,
    bathrooms: 1,
    m2: 110,
    max_guests: 4,
    low_cents:  24000,
    high_cents: 33000,
    cleaning_cents: 9000,
  },
  {
    slug: 'marea',
    title: 'The Retreat',
    description:
      'An intimate retreat for couples. Minimalist design meets the raw beauty of the Tarifa coast.',
    features: ['Minimalist Design', 'King Bed', 'Coffee Station', 'Sun Deck'],
    bedrooms: 1,
    bathrooms: 1,
    m2: 60,
    max_guests: 2,
    low_cents:  16000,
    high_cents: 22000,
    cleaning_cents: 6000,
  },
  {
    slug: 'cala',
    title: 'The Bungalow',
    description:
      'Cosy and secluded. A charming bungalow perfect for solo travelers or a quiet getaway.',
    features: ['Secluded Location', 'Garden Access', 'Compact Kitchen', 'Modern Bath'],
    bedrooms: 1,
    bathrooms: 1,
    m2: 45,
    max_guests: 2,
    low_cents:  14000,
    high_cents: 19000,
    cleaning_cents: 5000,
  },
];

function rateForCheckIn(p: PropertySeed, checkIn: string): number {
  const month = (Number(checkIn.slice(5, 7)) as Month);
  return HIGH_SEASON_MONTHS.includes(month) ? p.high_cents : p.low_cents;
}

type BookingSeed = {
  property: PropertySeed['slug'];
  guest: 'maria' | 'tom' | null;   // null = admin booking, no user_id (e.g. owner family / maintenance block)
  in: string;                       // YYYY-MM-DD
  out: string;
  status: BookingStatus;
  adults: number;
  children?: number;
  pets?: number;
  cancellation_reason?: string;
  internal_note?: string;           // logged in booking_events
};

// 12 reservations spread across the last 4 months. Held statuses
// (confirmed/checked_in/checked_out) on the same property are
// non-overlapping to satisfy `no_overlap_when_held`.
const BOOKINGS: BookingSeed[] = [
  // Levante (3)
  { property: 'levante',  guest: 'maria', in: '2026-01-05', out: '2026-01-12', status: 'checked_out', adults: 4, children: 2 },
  { property: 'levante',  guest: null,    in: '2026-02-14', out: '2026-02-21', status: 'checked_out', adults: 4, internal_note: 'Owner family stay' },
  { property: 'levante',  guest: 'tom',   in: '2026-04-01', out: '2026-04-08', status: 'checked_out', adults: 6 },

  // Estrecho (3)
  { property: 'estrecho', guest: 'tom',   in: '2026-01-20', out: '2026-01-25', status: 'checked_out', adults: 2 },
  { property: 'estrecho', guest: 'maria', in: '2026-03-05', out: '2026-03-12', status: 'checked_out', adults: 4 },
  { property: 'estrecho', guest: 'tom',   in: '2026-04-18', out: '2026-04-22', status: 'cancelled',   adults: 2, cancellation_reason: 'Guest changed plans' },

  // Marea (3)
  { property: 'marea',    guest: null,    in: '2026-01-28', out: '2026-02-02', status: 'checked_out', adults: 2, internal_note: 'Maintenance window' },
  { property: 'marea',    guest: 'maria', in: '2026-03-14', out: '2026-03-21', status: 'checked_out', adults: 2 },
  { property: 'marea',    guest: 'tom',   in: '2026-04-25', out: '2026-04-30', status: 'request',     adults: 2 },

  // Cala (3)
  { property: 'cala',     guest: 'tom',   in: '2026-02-05', out: '2026-02-10', status: 'checked_out', adults: 2 },
  { property: 'cala',     guest: null,    in: '2026-03-22', out: '2026-03-29', status: 'checked_out', adults: 2, internal_note: 'Owner family stay' },
  { property: 'cala',     guest: 'maria', in: '2026-05-01', out: '2026-05-06', status: 'checked_in',  adults: 2, pets: 1 },
];

const USERS = [
  { key: 'david', name: 'David',  email: 'hello@fincasanmateo.com', nationality: 'ES' },
  { key: 'maria', name: 'Maria',  email: 'maria@example.com',       nationality: 'ES' },
  { key: 'tom',   name: 'Tom',    email: 'tom@example.com',         nationality: 'GB' },
] as const;

type UserKey = (typeof USERS)[number]['key'];

function nightsBetween(checkIn: string, checkOut: string) {
  const ms = Date.parse(checkOut) - Date.parse(checkIn);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function daysBefore(date: string, n: number) {
  return new Date(Date.parse(date) - n * 24 * 60 * 60 * 1000).toISOString();
}

async function clearBookingData() {
  // Cascades to booking_invitations, booking_service_fees, booking_payments,
  // payment_refunds, and booking_events via FK ON DELETE CASCADE.
  await pool.query(`TRUNCATE bookings RESTART IDENTITY CASCADE`);
}

async function seedUsers(): Promise<Record<UserKey, string>> {
  const ids = {} as Record<UserKey, string>;
  for (const u of USERS) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (name, email, nationality)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, nationality = EXCLUDED.nationality
       RETURNING id`,
      [u.name, u.email, u.nationality],
    );
    ids[u.key] = rows[0].id;
  }
  console.log(`✓ seeded ${USERS.length} users`);
  return ids;
}

type SeededProperty = { id: string; cleaning_cents: number; seed: PropertySeed };

async function seedProperties(): Promise<Record<string, SeededProperty>> {
  const ids: Record<string, SeededProperty> = {};
  for (const p of PROPERTIES) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO properties (
         slug, title, description, features,
         bedrooms, bathrooms, m2, max_guests
       )
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
       ON CONFLICT (slug) DO UPDATE
         SET title = EXCLUDED.title,
             description = EXCLUDED.description,
             features = EXCLUDED.features,
             bedrooms = EXCLUDED.bedrooms,
             bathrooms = EXCLUDED.bathrooms,
             m2 = EXCLUDED.m2,
             max_guests = EXCLUDED.max_guests
       RETURNING id`,
      [p.slug, p.title, p.description, JSON.stringify(p.features),
       p.bedrooms, p.bathrooms, p.m2, p.max_guests],
    );
    const propertyId = rows[0].id;
    ids[p.slug] = { id: propertyId, cleaning_cents: p.cleaning_cents, seed: p };

    // Two seasonal rates per property. Low Season = everything except Jun/Jul/Aug;
    // High Season = Jun/Jul/Aug. See db/rates.md for the selection algorithm.
    const seasons = [
      { name: 'Low Season',  months: [...LOW_SEASON_MONTHS],  night_rate_cents: p.low_cents  },
      { name: 'High Season', months: [...HIGH_SEASON_MONTHS], night_rate_cents: p.high_cents },
    ];
    for (const s of seasons) {
      await pool.query(
        `INSERT INTO property_rates (property_id, name, active, public, min_nights, months, night_rate_cents)
         SELECT $1, $2, true, true, 2, $3::int[], $4
         WHERE NOT EXISTS (
           SELECT 1 FROM property_rates WHERE property_id = $1 AND name = $2
         )`,
        [propertyId, s.name, s.months, s.night_rate_cents],
      );
    }

    await pool.query(
      `INSERT INTO property_cleaning_fee (property_id, fee_cents, active)
       SELECT $1, $2, true
       WHERE NOT EXISTS (
         SELECT 1 FROM property_cleaning_fee WHERE property_id = $1 AND active
       )`,
      [propertyId, p.cleaning_cents],
    );
  }
  console.log(`✓ seeded ${PROPERTIES.length} properties (each with Low + High Season rates)`);
  return ids;
}

async function seedBookings(
  propertyIds: Record<string, SeededProperty>,
  userIds: Record<UserKey, string>,
) {
  for (const b of BOOKINGS) {
    const prop = propertyIds[b.property];
    const userId = b.guest ? userIds[b.guest] : null;
    const nights = nightsBetween(b.in, b.out);
    const nightRate = rateForCheckIn(prop.seed, b.in);
    const agreed = nights * nightRate + prop.cleaning_cents;
    const guests = JSON.stringify({
      adults: b.adults,
      children: b.children ?? 0,
      infants: 0,
      pets: b.pets ?? 0,
    });

    // Backdate created_at to "two weeks before check-in" so the timeline reads naturally.
    const createdAt = daysBefore(b.in, 14);
    const cancelledAt = b.status === 'cancelled' ? daysBefore(b.in, 7) : null;
    const timeIn  = b.status === 'checked_in' || b.status === 'checked_out' ? `${b.in}T16:00:00Z`  : null;
    const timeOut = b.status === 'checked_out'                              ? `${b.out}T11:00:00Z` : null;

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO bookings (
         property_id, user_id, date_check_in, date_check_out,
         agreed_price_cents, status, guests,
         time_check_in, time_check_out,
         cancelled_at, cancellation_reason,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3::date, $4::date,
         $5, $6::booking_status, $7::jsonb,
         $8, $9,
         $10, $11,
         $12, $12
       )
       RETURNING id`,
      [
        prop.id,
        userId,
        b.in,
        b.out,
        agreed,
        b.status,
        guests,
        timeIn,
        timeOut,
        cancelledAt,
        b.cancellation_reason ?? null,
        createdAt,
      ],
    );
    const bookingId = rows[0].id;

    // Payments: full reservation for held bookings; deposit + refund for cancelled.
    if (b.status === 'checked_in' || b.status === 'checked_out') {
      await pool.query(
        `INSERT INTO booking_payments (booking_id, type, amount_cents, cash, paid_at, created_at)
         VALUES ($1, 'reservation', $2, true, $3, $3)`,
        [bookingId, agreed, `${b.in}T16:00:00Z`],
      );
    } else if (b.status === 'cancelled') {
      const deposit = Math.round(agreed * 0.3);
      const { rows: payRows } = await pool.query<{ id: string }>(
        `INSERT INTO booking_payments (booking_id, type, amount_cents, cash, paid_at, created_at)
         VALUES ($1, 'deposit', $2, true, $3, $3)
         RETURNING id`,
        [bookingId, deposit, createdAt],
      );
      await pool.query(
        `INSERT INTO payment_refunds (payment_id, amount_cents, note, created_at)
         VALUES ($1, $2, 'Cancellation refund', $3)`,
        [payRows[0].id, deposit, cancelledAt],
      );
    }

    // Booking events — realistic state-transition trail.
    const events: Array<[string, string]> = [['booking.created', createdAt]];
    if (b.status !== 'request') events.push(['booking.confirmed', daysBefore(b.in, 10)]);
    if (b.status === 'checked_in' || b.status === 'checked_out') events.push(['booking.checked_in', timeIn!]);
    if (b.status === 'checked_out') events.push(['booking.checked_out', timeOut!]);
    if (b.status === 'cancelled') events.push(['booking.cancelled', cancelledAt!]);
    if (b.internal_note) {
      events.push(['booking.internal_note', createdAt]);
    }

    for (const [type, at] of events) {
      const payload = type === 'booking.internal_note' && b.internal_note
        ? JSON.stringify({ note: b.internal_note })
        : '{}';
      await pool.query(
        `INSERT INTO booking_events (booking_id, event_type, payload, created_at)
         VALUES ($1, $2, $3::jsonb, $4)`,
        [bookingId, type, payload, at],
      );
    }
  }
  console.log(`✓ seeded ${BOOKINGS.length} bookings`);
}

async function main() {
  await clearBookingData();
  const userIds = await seedUsers();
  const propertyIds = await seedProperties();
  await seedBookings(propertyIds, userIds);
  console.log('✓ seed complete');
}

main()
  .catch((err) => {
    console.error('✗ seed failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
