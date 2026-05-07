import 'server-only';
import { sql } from '@db/client';

export type User = {
  id: string;
  name: string;
  email: string;
  tif: string | null;
  nationality: string | null;
  dob: string | null;
  created_at: string;
};

export type UserWithStats = User & {
  total_bookings: number;
  lifetime_spend_cents: number;
};

export async function listUsers(): Promise<UserWithStats[]> {
  return sql<UserWithStats>(`
    SELECT
      u.id::text                        AS id,
      u.name                            AS name,
      u.email                           AS email,
      u.tif                             AS tif,
      u.nationality                     AS nationality,
      u.dob::text                       AS dob,
      u.created_at::text                AS created_at,
      COUNT(DISTINCT b.id)::int         AS total_bookings,
      COALESCE(
        SUM(bp.amount_cents) - COALESCE((
          SELECT SUM(pr.amount_cents)
          FROM payment_refunds pr
          WHERE pr.payment_id IN (SELECT id FROM booking_payments WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = u.id))
        ), 0),
        0
      )::int                            AS lifetime_spend_cents
    FROM users u
    LEFT JOIN bookings b               ON b.user_id = u.id
    LEFT JOIN booking_payments bp      ON bp.booking_id = b.id
    GROUP BY u.id
    ORDER BY u.created_at ASC
  `);
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await sql<User>(
    `SELECT id::text, name, email, tif, nationality, dob::text, created_at::text
     FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
