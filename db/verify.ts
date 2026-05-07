// Smoke test — not wired to package.json. Run ad-hoc with:
//   bun --env-file=.env.local run db/verify.ts
import { pool } from './client';

async function main() {
  const props = await pool.query<{ slug: string; title: string }>(
    `SELECT slug, title FROM properties ORDER BY id`,
  );
  console.log('properties:', props.rows);

  const confirmed = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM bookings WHERE status = 'confirmed'`,
  );
  console.log('confirmed bookings:', confirmed.rows[0].count);

  // Try to insert an overlapping confirmed booking on Levante. Must fail.
  try {
    await pool.query(
      `INSERT INTO bookings (property_id, date_check_in, date_check_out, agreed_price_cents, status)
       SELECT id, DATE '2026-07-12', DATE '2026-07-15', 10000, 'confirmed'
         FROM properties WHERE slug = 'levante'`,
    );
    console.log('✗ overlap was NOT blocked (constraint missing)');
    process.exit(1);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('no_overlap_when_held')) {
      console.log('✓ overlap blocked by no_overlap_when_held constraint');
    } else {
      console.log('✗ overlap rejected by unexpected error:', msg);
      process.exit(1);
    }
  }
}

main()
  .catch((err) => {
    console.error('✗ verify failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
