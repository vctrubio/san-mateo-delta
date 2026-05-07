import { pool } from './client';

type PropertySeed = {
  slug: string;
  title: string;
  description: string;
  features: string[];
  bedrooms: number;
  bathrooms: number;
  m2: number;
  max_guests: number;
  rate_cents: number;
  cleaning_cents: number;
};

const PROPERTIES: PropertySeed[] = [
  {
    slug: 'levante',
    title: 'Levante — The Villa',
    description:
      'Our flagship villa. A masterpiece of coastal architecture featuring expansive living spaces and direct access to the estate gardens.',
    features: ['Private Terrace', 'Fully Equipped Kitchen', 'Starlink WiFi', 'Master Suite'],
    bedrooms: 3,
    bathrooms: 2,
    m2: 180,
    max_guests: 6,
    rate_cents: 35000,
    cleaning_cents: 12000,
  },
  {
    slug: 'estrecho',
    title: 'Estrecho — The Residence',
    description:
      'Perfect for families or groups. A spacious residence with views across the Strait of Gibraltar.',
    features: ['Ocean Views', 'Outdoor Dining Area', 'Fireplace', '2 Bedrooms'],
    bedrooms: 2,
    bathrooms: 1,
    m2: 110,
    max_guests: 4,
    rate_cents: 24000,
    cleaning_cents: 9000,
  },
  {
    slug: 'marea',
    title: 'Marea — The Retreat',
    description:
      'An intimate retreat for couples. Minimalist design meets the raw beauty of the Tarifa coast.',
    features: ['Minimalist Design', 'King Bed', 'Coffee Station', 'Sun Deck'],
    bedrooms: 1,
    bathrooms: 1,
    m2: 60,
    max_guests: 2,
    rate_cents: 16000,
    cleaning_cents: 6000,
  },
  {
    slug: 'cala',
    title: 'Cala — The Bungalow',
    description:
      'Cosy and secluded. A charming bungalow perfect for solo travelers or a quiet getaway.',
    features: ['Secluded Location', 'Garden Access', 'Compact Kitchen', 'Modern Bath'],
    bedrooms: 1,
    bathrooms: 1,
    m2: 45,
    max_guests: 2,
    rate_cents: 14000,
    cleaning_cents: 5000,
  },
];

async function seedProperties() {
  for (const p of PROPERTIES) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO properties (slug, title, description, features)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (slug) DO UPDATE
         SET title = EXCLUDED.title,
             description = EXCLUDED.description,
             features = EXCLUDED.features
       RETURNING id`,
      [p.slug, p.title, p.description, JSON.stringify(p.features)],
    );
    const propertyId = rows[0].id;

    await pool.query(
      `INSERT INTO property_characteristics (property_id, bedrooms, bathrooms, m2, max_guests)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (property_id) DO UPDATE
         SET bedrooms=EXCLUDED.bedrooms, bathrooms=EXCLUDED.bathrooms,
             m2=EXCLUDED.m2, max_guests=EXCLUDED.max_guests`,
      [propertyId, p.bedrooms, p.bathrooms, p.m2, p.max_guests],
    );

    await pool.query(
      `INSERT INTO property_rates (property_id, name, active, public, min_nights, price_cents)
       VALUES ($1, 'Standard', true, true, 2, $2)`,
      [propertyId, p.rate_cents],
    );

    await pool.query(
      `INSERT INTO property_cleaning_fee (property_id, fee_cents, active)
       VALUES ($1, $2, true)`,
      [propertyId, p.cleaning_cents],
    );
  }
  console.log(`✓ seeded ${PROPERTIES.length} properties`);
}

async function seedUsers() {
  const users = [
    { name: 'David',  email: 'hello@fincasanmateo.com', nationality: 'ES' },
    { name: 'Maria',  email: 'maria@example.com',       nationality: 'ES' },
    { name: 'Tom',    email: 'tom@example.com',         nationality: 'GB' },
  ];
  const ids: Record<string, string> = {};
  for (const u of users) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (name, email, nationality)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [u.name, u.email, u.nationality],
    );
    ids[u.email] = rows[0].id;
  }
  console.log(`✓ seeded ${users.length} users`);
  return ids;
}

async function seedDemoBooking(userIds: Record<string, string>) {
  const { rows: propRows } = await pool.query<{ id: string }>(
    `SELECT id FROM properties WHERE slug = 'levante'`,
  );
  const levanteId = propRows[0].id;

  const { rows } = await pool.query<{ id: string; access_token: string }>(
    `INSERT INTO bookings (
       property_id, user_id, date_check_in, date_check_out,
       agreed_price_cents, status, guests
     ) VALUES (
       $1, $2, DATE '2026-07-10', DATE '2026-07-17',
       $3, 'confirmed', $4::jsonb
     )
     RETURNING id, access_token`,
    [
      levanteId,
      userIds['maria@example.com'],
      35000 * 7 + 12000,
      JSON.stringify({ adults: 4, children: 2, infants: 0, pets: 0 }),
    ],
  );
  const bookingId = rows[0].id;

  await pool.query(
    `INSERT INTO booking_payments (booking_id, type, amount_cents, cash)
     VALUES ($1, 'reservation', $2, true)`,
    [bookingId, 35000 * 7 + 12000],
  );

  await pool.query(
    `INSERT INTO booking_events (booking_id, event_type, payload)
     VALUES ($1, 'booking.created', '{}'::jsonb),
            ($1, 'booking.confirmed', '{}'::jsonb)`,
    [bookingId],
  );
  console.log(`✓ seeded demo booking #${bookingId} (token ${rows[0].access_token})`);
}

async function main() {
  const userIds = await seedUsers();
  await seedProperties();
  await seedDemoBooking(userIds);
  console.log('✓ seed complete');
}

main()
  .catch((err) => {
    console.error('✗ seed failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
