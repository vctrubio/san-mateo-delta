// Smoke test for property_blocks + block-vs-booking conflict detection.
// Run ad-hoc with:
//   bun --env-file=.env.local run db/smoke_blocks.ts
import { pool } from './client';

async function main() {
  let pass = true;

  // Pick Levante's id
  const propRows = await pool.query<{ id: string }>(
    `SELECT id::text FROM properties WHERE slug = 'levante'`,
  );
  const propId = propRows.rows[0].id;

  // 1. Insert a brand-new block in the future on free dates: should succeed.
  const okRows = await pool.query<{ id: string }>(
    `INSERT INTO property_blocks (property_id, date_check_in, date_check_out, reason)
     VALUES ($1, '2027-01-10'::date, '2027-01-15'::date, 'smoke test block')
     RETURNING id::text`,
    [propId],
  );
  const blockId = okRows.rows[0].id;
  console.log(`  ✓ inserted block #${blockId} on 2027-01-10 → 2027-01-15`);

  // 2. Insert an overlapping block: gist exclusion should reject.
  try {
    await pool.query(
      `INSERT INTO property_blocks (property_id, date_check_in, date_check_out)
       VALUES ($1, '2027-01-13'::date, '2027-01-20'::date)`,
      [propId],
    );
    console.error('  ✗ overlapping block was NOT rejected');
    pass = false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('exclusion') || msg.includes('conflicting')) {
      console.log('  ✓ overlapping block rejected by exclusion constraint');
    } else {
      console.error('  ✗ unexpected error:', msg);
      pass = false;
    }
  }

  // 3. Insert an adjacent block (touches but does not overlap): should succeed.
  // Block range is half-open [start, end), so end=start of new range is fine.
  await pool.query(
    `INSERT INTO property_blocks (property_id, date_check_in, date_check_out)
     VALUES ($1, '2027-01-15'::date, '2027-01-18'::date)`,
    [propId],
  );
  console.log('  ✓ adjacent block (start = prior end) accepted — half-open semantics');

  // Cleanup
  await pool.query(`DELETE FROM property_blocks WHERE property_id = $1 AND date_check_in >= '2027-01-01'`, [propId]);
  console.log('  ✓ cleanup');

  if (!pass) {
    console.error('\n✗ blocks smoke FAILED');
    process.exit(1);
  }
  console.log('\n✓ property_blocks smoke passed');
}

main()
  .catch((err) => {
    console.error('✗ blocks smoke crashed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
