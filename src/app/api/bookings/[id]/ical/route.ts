import 'server-only';
import type { NextRequest } from 'next/server';
import { sql } from '@db/client';
import { PROPERTY_LABELS, type PropertySlug } from '@/lib/colors';
import finca from '../../../../../../finca.json';

// /api/bookings/[id]/ical
//
// Generates an RFC-5545 .ics file for the booking dates so the guest can
// add the stay to their calendar from the success page (or from the user
// dashboard later). All-day VEVENT — DTSTART is the check-in date, DTEND
// is the check-out date (exclusive per spec for VALUE=DATE).

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  property_slug: string;
  check_in: string;
  check_out: string;
  user_name: string | null;
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const rows = await sql<Row>(
    `SELECT b.id::text                  AS id,
            p.slug                       AS property_slug,
            b.date_check_in::text        AS check_in,
            b.date_check_out::text       AS check_out,
            u.name                       AS user_name
       FROM bookings b
       JOIN properties p ON p.id = b.property_id
       LEFT JOIN users u ON u.id = b.user_id
      WHERE b.id = $1`,
    [id],
  );
  const booking = rows[0];
  if (!booking) {
    return new Response('Booking not found', { status: 404 });
  }

  const propertyLabel = PROPERTY_LABELS[booking.property_slug as PropertySlug] ?? booking.property_slug;
  const summary = `Finca ${finca.name} · ${propertyLabel} stay`;
  const location = [finca.location.city, finca.location.region, finca.location.country].join(', ');
  const descriptionLines = [
    `Booking #${booking.id}`,
    booking.user_name ? `Guest: ${booking.user_name}` : null,
    `Contact: ${finca.contact.email} · ${finca.contact.phone}`,
    finca.contact.website,
  ].filter(Boolean) as string[];

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Finca ${finca.name}//delta//EN`,
    'METHOD:PUBLISH',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:booking-${booking.id}@fincasanmateo.com`,
    `DTSTAMP:${nowStamp()}`,
    `DTSTART;VALUE=DATE:${dateOnly(booking.check_in)}`,
    `DTEND;VALUE=DATE:${dateOnly(booking.check_out)}`,
    `SUMMARY:${escape(summary)}`,
    `LOCATION:${escape(location)}`,
    `DESCRIPTION:${escape(descriptionLines.join('\\n'))}`,
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="finca-san-mateo-booking-${booking.id}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}

// ---------------------------------------------------------------------------

function dateOnly(ymd: string): string {
  // "2026-05-08" → "20260508"
  return ymd.replace(/-/g, '');
}

function nowStamp(): string {
  // RFC-5545 UTC: YYYYMMDDTHHMMSSZ
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

function escape(text: string): string {
  // RFC-5545: escape backslash, semicolon, comma, newline.
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}
