// Pure utilities for the bookings.guests shape. No React, no DB, no
// directives — safe to import from server components, client components,
// email-render, tests, anywhere.
//
// The interactive picker lives in `src/components/shared/GuestConfig.tsx`
// (which is `'use client'`). It imports the types + helpers from this file
// so callers don't have to know the difference.

export type GuestCounts = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

export const DEFAULT_GUESTS: GuestCounts = {
  adults: 2,
  children: 0,
  infants: 0,
  pets: 0,
};

/** Sum of human guests. Pets are excluded — they have their own column on the booking. */
export function totalGuests(g: GuestCounts): number {
  return g.adults + g.children + g.infants;
}

/** Compact one-line summary: "4A · 1C · 1🐾". Zero-valued buckets are
 *  omitted so a single-adult booking just reads "1A". Shared by the
 *  bookings table, the admin booking detail, and the user dashboard so
 *  the vocabulary stays in lockstep across surfaces. */
export function formatGuests(g: GuestCounts): string {
  const parts: string[] = [`${g.adults}A`];
  if (g.children) parts.push(`${g.children}C`);
  if (g.infants)  parts.push(`${g.infants}I`);
  if (g.pets)     parts.push(`${g.pets}🐾`);
  return parts.join(' · ');
}
