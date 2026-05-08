import 'server-only';
import { sql } from '@db/client';
import type { InvitationStatus } from '@db/enums';
import type { Paginated } from './searchParams';

// ============================================================================
// Invitations are admin-issued bookings priced manually (typically friends &
// family). One row in `bookings` (status='invite') paired with one row in
// `booking_invitations` (status invited|accepted|declined). The booking
// carries the snapshotted custom fees in agreed_property_cents +
// agreed_cleaning_cents — same columns regular bookings use, just populated
// from admin input instead of `computeQuote`.
//
// docs/invitations.md describes the full lifecycle.
// ============================================================================

export type InvitationRow = {
  invitation_id: string;
  invitation_status: InvitationStatus;
  invited_at: string;
  responded_at: string | null;
  email: string;

  /** The accompanying booking. */
  booking_id: string;
  booking_status: string;
  property_slug: string;
  property_title: string;
  date_check_in: string;
  date_check_out: string;

  /** Custom snapshot — what admin charged. */
  agreed_property_cents: number;
  agreed_cleaning_cents: number;
  agreed_total_cents: number;

  /**
   * "Would-be" default fees pulled from the booking.invited audit event.
   * Null on invitations created before this telemetry was added (or if
   * computeQuote returned no eligible rate at creation time).
   */
  default_property_cents: number | null;
  default_cleaning_cents: number | null;

  /** Linked user (existing on creation, or accepted invitee). null if neither. */
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
};

export type ListInvitationsArgs = {
  status?: InvitationStatus[];
  property?: string[];
  /** YYYY-MM-DD; filters `b.date_check_in >= from`. */
  from?: string;
  /** YYYY-MM-DD; filters `b.date_check_in <= to`. */
  to?: string;
  /** ILIKE on invitation email + linked user name + linked user email. */
  search?: string;
  limit?: number;
  offset?: number;
};

// Lateral subquery picks the most recent booking.invited event so we get the
// snapshotted "default" fees for the diff. Most invitations have exactly one;
// the ORDER BY ... LIMIT 1 handles the edge case of an admin re-running.
const INVITATION_SELECT = `
  bi.id::text                            AS invitation_id,
  bi.status::text                        AS invitation_status,
  bi.invited_at::text                    AS invited_at,
  bi.responded_at::text                  AS responded_at,
  bi.email                               AS email,
  b.id::text                             AS booking_id,
  b.status::text                         AS booking_status,
  p.slug                                 AS property_slug,
  p.title                                AS property_title,
  b.date_check_in::text                  AS date_check_in,
  b.date_check_out::text                 AS date_check_out,
  b.agreed_property_cents::int           AS agreed_property_cents,
  b.agreed_cleaning_cents::int           AS agreed_cleaning_cents,
  (b.agreed_property_cents + b.agreed_cleaning_cents)::int AS agreed_total_cents,
  NULLIF(be.payload->>'default_property_cents', '')::int   AS default_property_cents,
  NULLIF(be.payload->>'default_cleaning_cents', '')::int   AS default_cleaning_cents,
  b.user_id::text                        AS user_id,
  u.name                                 AS user_name,
  u.email                                AS user_email
`;

const INVITATION_FROM = `
  FROM booking_invitations bi
  JOIN bookings b           ON b.id = bi.booking_id
  JOIN properties p         ON p.id = b.property_id
  LEFT JOIN users u         ON u.id = b.user_id
  LEFT JOIN LATERAL (
    SELECT payload
      FROM booking_events
     WHERE booking_id = b.id AND event_type = 'booking.invited'
     ORDER BY created_at DESC LIMIT 1
  ) be ON true
`;

export async function listInvitations(args: ListInvitationsArgs = {}): Promise<Paginated<InvitationRow>> {
  const where: string[] = [];
  const params: unknown[] = [];
  let p = 0;

  if (args.status && args.status.length > 0) {
    params.push(args.status);
    where.push(`bi.status::text = ANY($${++p}::text[])`);
  }
  if (args.property && args.property.length > 0) {
    params.push(args.property);
    where.push(`p.slug = ANY($${++p}::text[])`);
  }
  if (args.from) {
    params.push(args.from);
    where.push(`b.date_check_in >= $${++p}::date`);
  }
  if (args.to) {
    params.push(args.to);
    where.push(`b.date_check_in <= $${++p}::date`);
  }
  if (args.search) {
    params.push(`%${args.search}%`);
    where.push(`(bi.email ILIKE $${++p} OR u.email ILIKE $${p} OR u.name ILIKE $${p})`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = args.limit ?? 25;
  const offset = args.offset ?? 0;
  params.push(limit);
  const limitParam = `$${++p}`;
  params.push(offset);
  const offsetParam = `$${++p}`;

  const rows = await sql<InvitationRow & { _total: number }>(
    `
    SELECT ${INVITATION_SELECT},
      COUNT(*) OVER ()::int AS _total
    ${INVITATION_FROM}
    ${whereClause}
    ORDER BY
      CASE bi.status WHEN 'invited' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END,
      bi.invited_at DESC
    LIMIT ${limitParam} OFFSET ${offsetParam}
    `,
    params as never[],
  );

  const total = rows[0]?._total ?? 0;
  const cleaned: InvitationRow[] = rows.map(({ _total, ...rest }) => rest);
  return { rows: cleaned, total };
}

export async function getInvitationById(id: string): Promise<InvitationRow | null> {
  const rows = await sql<InvitationRow>(
    `SELECT ${INVITATION_SELECT}
     ${INVITATION_FROM}
     WHERE bi.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// ----------------------------------------------------------------------------
// invitationStats — distribution counts for the dashboard / debug panel.
// ----------------------------------------------------------------------------

export type InvitationStats = {
  invited: number;
  accepted: number;
  declined: number;
  total: number;
};

export async function invitationStats(): Promise<InvitationStats> {
  const rows = await sql<{ status: string; n: number }>(
    `SELECT status::text AS status, COUNT(*)::int AS n
       FROM booking_invitations
      GROUP BY status`,
  );
  const out: InvitationStats = { invited: 0, accepted: 0, declined: 0, total: 0 };
  for (const r of rows) {
    if (r.status === 'invited' || r.status === 'accepted' || r.status === 'declined') {
      out[r.status] = r.n;
    }
    out.total += r.n;
  }
  return out;
}
