// Shared site/metadata helpers — single source of truth for the canonical
// URL, the default <title> template, the default Open Graph card, and the
// LodgingBusiness JSON-LD shape.
//
// Every route's generateMetadata composes from baseMetadata() rather than
// building its own; otherwise the OG image, locale, and metadataBase drift
// across routes.

import type { Metadata } from 'next';
import finca from '@config/finca.json';
import socials from '@config/socials.json';

const FALLBACK_URL = 'http://localhost:3000';

// Punta Paloma sits ~300 m from the estate. This is our primary SEO hook
// and shows up in title, meta description, and JSON-LD. Long-tail, low
// competition — by far the highest-leverage phrase we can rank on.
const PUNTA_PALOMA_HOOK = '300 m from Punta Paloma';

const SEO_DESCRIPTION =
  `Finca ${finca.name} — a privately-hosted coastal estate 300 metres from Punta Paloma Beach in ${finca.subtitle}. Wind, surf, and quiet luxury at Europe's southernmost point.`;

const SEO_KEYWORDS = [
  'Punta Paloma',
  'Punta Paloma villa',
  'Valdevaqueros',
  'Valdevaqueros villa',
  'Valdevaqueros kitesurf',
  'Los Lances Tarifa',
  'Tarifa vacation rental',
  'villa Tarifa',
  'kitesurf accommodation Tarifa',
  'Strait of Gibraltar vacation rental',
  'Cádiz holiday home',
  'Cape Spartel view',
  `Finca ${finca.name}`,
];

// Surrounding landmarks the map calls out. Each entry becomes a
// TouristAttraction in the LodgingBusiness JSON-LD, with geocoordinates
// so Google's vacation-rental rich result can place the estate in
// context. Lat/lon are approximate but accurate enough for "things to
// do nearby" reasoning. Keep the order roughly by relevance — Punta
// Paloma first because it's the brand hook.
const NEARBY_ATTRACTIONS = [
  {
    name: 'Punta Paloma Beach',
    description:
      '300 metres from the estate — wide white-sand cove with the famous Punta Paloma dune.',
    lat: 36.0716,
    lon: -5.7236,
  },
  {
    name: 'Valdevaqueros',
    description:
      'Legendary kitesurf and windsurf bay just east of the estate; "the playground" for the Tarifa wind scene.',
    lat: 36.0735,
    lon: -5.6975,
  },
  {
    name: 'Los Lances Beach',
    description:
      'Tarifa\'s 7-km town beach — flat-water mornings, kite-friendly afternoons, sunset views to Morocco.',
    lat: 36.0307,
    lon: -5.6072,
  },
  {
    name: 'Tarifa',
    description:
      "The southernmost town on the European mainland — old Moorish quarter, ferry port to Tangier, sunset over the Atlantic.",
    lat: 36.0143,
    lon: -5.6044,
  },
  {
    name: 'Strait of Gibraltar',
    description: 'The 13-km channel between Europe and Africa — whale and dolphin migration corridor.',
    lat: 36.0,
    lon: -5.6,
  },
  {
    name: 'Cape Spartel',
    description:
      "Morocco's northwest tip across the strait — Moorish lighthouse marking where the Atlantic meets the Mediterranean.",
    lat: 35.7884,
    lon: -5.9201,
  },
] as const;

function ensureScheme(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

/**
 * Canonical, scheme-included site URL.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_APP_URL — explicit override (recommended in production)
 *   2. https://VERCEL_PROJECT_PRODUCTION_URL — Vercel auto-injects the
 *      canonical production domain on every build (scheme-less)
 *   3. https://VERCEL_URL — preview deployments (scheme-less)
 *   4. http://localhost:3000 — dev fallback
 *
 * Whatever it resolves to is normalised: a missing scheme gets `https://`
 * prepended, trailing slashes are stripped, and `new URL()` is wrapped in
 * try/catch so a malformed env value falls back to localhost instead of
 * crashing the entire build (which was the failure mode behind the red
 * Vercel deploy at 3c5ee81).
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    FALLBACK_URL;
  const normalised = trimTrailingSlash(ensureScheme(raw));
  try {
    new URL(normalised);
    return normalised;
  } catch {
    console.warn(
      `[site] Invalid resolved siteUrl "${normalised}" — falling back to ${FALLBACK_URL}`,
    );
    return FALLBACK_URL;
  }
}

/** Join a path onto the site URL. Tolerates leading slash or not. */
export function absoluteUrl(path: string): string {
  const base = siteUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Per-property OG card. Cards are generated locally via
 * `bun og:generate` and committed to public/og/{slug}.jpg at 1200×630.
 * Source format is normalised to .jpg so we don't have to track which
 * properties are .png vs .jpg.
 */
export function propertyImageUrl(slug: string): string {
  return absoluteUrl(`/og/${slug}.jpg`);
}

/** Estate-wide default OG image — cropped from FincaBanner. */
export function defaultOgImageUrl(): string {
  return absoluteUrl('/og/finca.jpg');
}

/**
 * External profile URLs used for the LodgingBusiness `sameAs` field.
 * Drops `kind: 'action'` entries (e.g. the share button) since those
 * aren't crawlable profiles.
 */
export function socialProfileUrls(): string[] {
  return socials.links
    .filter((l): l is typeof l & { url: string } => l.kind === 'link')
    .map((l) => l.url);
}

/**
 * Base metadata applied at the root layout. Per-route `generateMetadata`
 * picks this up via Next's metadata merging — only override the fields
 * you actually need to change.
 */
export function baseMetadata(): Metadata {
  const url = siteUrl();
  const name = `Finca ${finca.name}`;
  const title = `${name} · Vacation rental ${PUNTA_PALOMA_HOOK}, ${finca.subtitle}`;
  return {
    metadataBase: new URL(url),
    title: {
      default: title,
      template: `%s · ${name}`,
    },
    description: SEO_DESCRIPTION,
    keywords: SEO_KEYWORDS,
    applicationName: name,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: name,
      title,
      description: SEO_DESCRIPTION,
      url,
      locale: 'en_US',
      images: [
        {
          url: defaultOgImageUrl(),
          width: 1200,
          height: 630,
          alt: `${name} — ${PUNTA_PALOMA_HOOK}, ${finca.subtitle}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: SEO_DESCRIPTION,
      images: [defaultOgImageUrl()],
    },
    robots: { index: true, follow: true },
    verification: process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : undefined,
  };
}

/**
 * schema.org `LodgingBusiness` JSON-LD for the homepage.
 *
 * `priceRange` is the only field that needs runtime data; the caller
 * (src/app/page.tsx) computes the cheapest/most-expensive nightly rate
 * from listProperties() and passes it in. The rest is config-driven.
 */
export function lodgingBusinessJsonLd(
  opts: { priceRange?: string } = {},
): Record<string, unknown> {
  const name = `Finca ${finca.name}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name,
    description: SEO_DESCRIPTION,
    url: siteUrl(),
    image: defaultOgImageUrl(),
    telephone: finca.contact.phone,
    email: finca.contact.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: finca.location.city,
      addressRegion: finca.location.region,
      addressCountry: finca.location.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: finca.location.coords.lat,
      longitude: finca.location.coords.lon,
    },
    checkinTime: finca.check_in_time,
    checkoutTime: finca.check_out_time,
    petsAllowed: finca.amenities.some((a) => a.name === 'Pets Allowed'),
    amenityFeature: finca.amenities.map(({ name }) => ({
      '@type': 'LocationFeatureSpecification',
      name,
    })),
    sameAs: socialProfileUrls(),
    nearbyAttraction: NEARBY_ATTRACTIONS.map((a) => ({
      '@type': 'TouristAttraction',
      name: a.name,
      description: a.description,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: a.lat,
        longitude: a.lon,
      },
    })),
    ...(opts.priceRange ? { priceRange: opts.priceRange } : {}),
  };
}
