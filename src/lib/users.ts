import 'server-only';
import { sql } from '@db/client';
import type { Paginated } from './searchParams';

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

export type ListUsersSort = 'recent' | 'bookings' | 'spend';

export type ListUsersArgs = {
  /** ILIKE on name + email. */
  search?: string;
  sort?: ListUsersSort;
  limit?: number;
  offset?: number;
};

export async function listUsers(args: ListUsersArgs = {}): Promise<Paginated<UserWithStats>> {
  const where: string[] = [];
  const params: unknown[] = [];
  let p = 0;

  if (args.search) {
    params.push(`%${args.search}%`);
    where.push(`(u.name ILIKE $${++p} OR u.email ILIKE $${p})`);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const orderBy = (() => {
    switch (args.sort) {
      case 'bookings': return 'total_bookings DESC NULLS LAST, u.created_at ASC';
      case 'spend':    return 'lifetime_spend_cents DESC NULLS LAST, total_bookings DESC';
      case 'recent':
      default:         return 'u.created_at DESC';
    }
  })();

  const limit = args.limit ?? 25;
  const offset = args.offset ?? 0;
  params.push(limit);
  const limitParam = `$${++p}`;
  params.push(offset);
  const offsetParam = `$${++p}`;

  const rows = await sql<UserWithStats & { _total: number }>(
    `
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
      )::int                            AS lifetime_spend_cents,
      COUNT(*) OVER ()::int             AS _total
    FROM users u
    LEFT JOIN bookings b               ON b.user_id = u.id
    LEFT JOIN booking_payments bp      ON bp.booking_id = b.id
    ${whereClause}
    GROUP BY u.id
    ORDER BY ${orderBy}
    LIMIT ${limitParam} OFFSET ${offsetParam}
    `,
    params as never[],
  );

  const total = rows[0]?._total ?? 0;
  const cleaned: UserWithStats[] = rows.map(({ _total, ...rest }) => rest);
  return { rows: cleaned, total };
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await sql<User>(
    `SELECT id::text, name, email, tif, nationality, dob::text, created_at::text
     FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
