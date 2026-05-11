// One-off sanity check: prints the alert distribution the bell should show
// against the DB, so the count in the UI can be verified against this.
// Run after `bun db:fullseason`:
//
//   bun --env-file=.env.local run db/verify_alerts.ts

import { pool } from './client';

const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

async function main() {
  console.log(`today = ${today}\n`);

  const r1 = await pool.query<{ kind: string; n: number }>(
    `
    SELECT
      CASE
        WHEN b.status = 'request'                                            THEN 'request_awaiting'
        WHEN b.status = 'confirmed'  AND b.date_check_in = $1::date          THEN 'check_in_today'
        WHEN b.status = 'confirmed'  AND b.date_check_in < $1::date          THEN 'overdue_checkin'
        WHEN b.status = 'checked_in'                                         THEN 'checked_in_unpaid'
      END AS kind,
      COUNT(*)::int AS n
    FROM bookings b
    CROSS JOIN LATERAL (
      SELECT COALESCE(SUM(amount_cents), 0)::int AS amount
      FROM booking_payments
      WHERE booking_id = b.id AND status = 'succeeded'
    ) paid
    WHERE
      b.status = 'request'
      OR (b.status = 'confirmed'  AND b.date_check_in <= $1::date)
      OR (b.status = 'checked_in' AND (b.agreed_property_cents + b.agreed_cleaning_cents) > paid.amount)
    GROUP BY 1
    ORDER BY 1
    `,
    [today],
  );

  console.log('Alert kind distribution (what the bell should show):');
  let total = 0;
  for (const r of r1.rows) {
    console.log(`  ${r.kind.padEnd(20)} ${r.n}`);
    total += r.n;
  }
  console.log(`  ${'TOTAL'.padEnd(20)} ${total}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => pool.end());
