// End-to-end smoke test of the booking lifecycle, mirrored as SQL.
// Run ad-hoc with:
//   bun --env-file=.env.local run db/e2e_smoke.ts
// Does NOT import from src/lib (those have server-only guards).
import { pool } from './client';
import { HIGH_SEASON_MONTHS } from './enums';

async function main() {
  const TEST_EMAIL = `smoke-${Date.now()}@test.com`;

  console.log('1. Compute quote (mirrors lib/bookings#computeQuote)');
  const propRows = await pool.query<{
    id: string;
    max_guests: number;
    cleaning_fee_cents: number;
    rates: Record<string, number>;
  }>(
    `SELECT id::text, max_guests::int, cleaning_fee_cents::int, rates
       FROM properties WHERE slug = 'levante'`,
  );
  const property = propRows.rows[0];
  const checkIn = '2026-09-10';
  const checkOut = '2026-09-17';
  const monthIn = Number(checkIn.slice(5, 7));
  const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000);

  const nightRateCents = property.rates[String(monthIn)];
  if (typeof nightRateCents !== 'number') throw new Error(`no rate configured for month ${monthIn}`);

  const cleaningCents = property.cleaning_fee_cents;
  const agreedCents = nights * nightRateCents + cleaningCents;
  const isHighSeason = HIGH_SEASON_MONTHS.includes(monthIn as 6 | 7 | 8);
  console.log(`   month=${monthIn}${isHighSeason ? ' (high)' : ''}: ${nights}n × €${nightRateCents / 100} + €${cleaningCents / 100} cleaning = €${agreedCents / 100}`);

  console.log('2. requestBooking (insert user + booking + event in a tx)');
  const client = await pool.connect();
  let userId: string;
  let bookingId: string;
  try {
    await client.query('BEGIN');
    const userRows = await client.query<{ id: string }>(
      `INSERT INTO users (name, email, nationality)
       VALUES ('Alice Smoke', $1, 'GB')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id::text`,
      [TEST_EMAIL],
    );
    userId = userRows.rows[0].id;

    const bRows = await client.query<{ id: string }>(
      `INSERT INTO bookings (property_id, user_id, date_check_in, date_check_out, agreed_property_cents, agreed_cleaning_cents, status, guests)
       VALUES ($1, $2, $3::date, $4::date, $5, $6, 'request', '{"adults":4,"children":0,"infants":0,"pets":0}'::jsonb)
       RETURNING id::text`,
      [property.id, userId, checkIn, checkOut, nights * nightRateCents, cleaningCents],
    );
    bookingId = bRows.rows[0].id;
    await client.query(
      `INSERT INTO booking_events (booking_id, event_type, payload) VALUES ($1, 'booking.created', '{}'::jsonb)`,
      [bookingId],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  console.log(`   user #${userId}, booking #${bookingId}, status=request`);

  console.log('3. transitionStatus(request → confirmed)');
  await pool.query(`UPDATE bookings SET status = 'confirmed' WHERE id = $1`, [bookingId]);
  await pool.query(
    `INSERT INTO booking_events (booking_id, event_type, payload) VALUES ($1, 'booking.confirmed', '{"from":"request","to":"confirmed"}'::jsonb)`,
    [bookingId],
  );

  console.log('4. recordPayment(deposit) — 30%');
  const depositCents = Math.round(agreedCents * 0.3);
  const payRows = await pool.query<{ id: string }>(
    `INSERT INTO booking_payments (booking_id, type, amount_cents, cash) VALUES ($1, 'deposit', $2, true) RETURNING id::text`,
    [bookingId, depositCents],
  );
  await pool.query(
    `INSERT INTO booking_events (booking_id, event_type, payload) VALUES ($1, 'payment.recorded', $2::jsonb)`,
    [bookingId, JSON.stringify({ payment_id: payRows.rows[0].id, type: 'deposit', amount_cents: depositCents })],
  );
  console.log(`   deposit recorded: €${depositCents / 100}`);

  console.log('5. transitionStatus(confirmed → checked_in)');
  const now = new Date().toISOString();
  await pool.query(`UPDATE bookings SET status = 'checked_in', time_check_in = $2 WHERE id = $1`, [bookingId, now]);
  await pool.query(
    `INSERT INTO booking_events (booking_id, event_type, payload) VALUES ($1, 'booking.checked_in', '{}'::jsonb)`,
    [bookingId],
  );

  console.log('6. transitionStatus(checked_in → checked_out)');
  await pool.query(`UPDATE bookings SET status = 'checked_out', time_check_out = $2 WHERE id = $1`, [bookingId, now]);
  await pool.query(
    `INSERT INTO booking_events (booking_id, event_type, payload) VALUES ($1, 'booking.checked_out', '{}'::jsonb)`,
    [bookingId],
  );

  console.log('\nFinal state:');
  const finalRows = await pool.query<{
    status: string;
    checked_in_stamped: boolean;
    checked_out_stamped: boolean;
    event_count: number;
    payment_count: number;
    paid_cents: number;
  }>(
    `SELECT b.status::text, b.time_check_in IS NOT NULL AS checked_in_stamped,
            b.time_check_out IS NOT NULL AS checked_out_stamped,
            (SELECT COUNT(*)::int FROM booking_events WHERE booking_id = b.id) AS event_count,
            (SELECT COUNT(*)::int FROM booking_payments WHERE booking_id = b.id) AS payment_count,
            (SELECT SUM(amount_cents)::int FROM booking_payments WHERE booking_id = b.id) AS paid_cents
     FROM bookings b WHERE id = $1`,
    [bookingId],
  );
  const f = finalRows.rows[0];
  console.log(' ', f);

  const pass =
    f.status === 'checked_out' &&
    f.checked_in_stamped &&
    f.checked_out_stamped &&
    f.event_count >= 5 &&
    f.payment_count === 1;

  if (!pass) {
    console.error('✗ smoke test FAILED');
    process.exit(1);
  }
  console.log('\n✓ end-to-end booking lifecycle smoke passed');

  console.log('\n7. Constraint test: try to insert overlapping confirmed booking on Levante 2026-09-12 → 09-15');
  try {
    await pool.query(
      `INSERT INTO bookings (property_id, date_check_in, date_check_out, agreed_property_cents, agreed_cleaning_cents, status)
       VALUES ($1, '2026-09-12'::date, '2026-09-15'::date, 10000, 0, 'confirmed')`,
      [property.id],
    );
    console.error('✗ overlap NOT blocked');
    process.exit(1);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('no_overlap_when_held')) {
      console.log('  ✓ overlap blocked by no_overlap_when_held');
    } else {
      console.error('✗ unexpected error:', msg);
      process.exit(1);
    }
  }

  console.log('\nCleanup');
  await pool.query(`DELETE FROM bookings WHERE id = $1`, [bookingId]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  console.log('  done');
}

main()
  .catch((err) => {
    console.error('✗ smoke test crashed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
