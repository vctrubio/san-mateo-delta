// Shared site/metadata helpers — single source of truth for the canonical
// URL, the default `<title>` template, the default Open Graph card, and
// the LodgingBusiness JSON-LD shape.
//
// Every route's `generateMetadata` should compose from `defaultMetadata()`
// rather than build its own from scratch — otherwise the OG image, locale,
// and `metadataBase` drift across routes.

import type { Metadata } from 'next';
import finca from '@config/finca.json';

const FALLBACK_URL = 'http://localhost:3000';

/** Canonical, scheme-included site URL. Reads `NEXT_PUBLIC_APP_URL`. */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? FALLBACK_URL;
}

/** Join a path onto the site URL. Tolerates leading slash or not. */
export function absoluteUrl(path: string): string {
  const base = siteUrl().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/** Property-image URL by slug, suitable for OG cards. */
export function propertyImageUrl(slug: string): string {
  return absoluteUrl(`/images/${slug}.png`);
}

/** Estate-wide default OG image — the villa shot until a real OG asset lands. */
export function defaultOgImageUrl(): string {
  return propertyImageUrl('levante');
}

/**
 * Base metadata applied at the root layout. Per-route `generateMetadata`
 * picks this up via Next's metadata merging — we only need to set the
 * overriding fields (title, description, image, canonical).
 */
export function baseMetadata(): Metadata {
  const url = siteUrl();
  const name = `Finca ${finca.name}`;
  const description =
    finca.description ??
    `${name} — a coastal estate in ${finca.subtitle}, ${finca.location.country}.`;
  return {
    metadataBase: new URL(url),
    title: {
      default: `${name} · ${finca.subtitle}`,
      template: `%s · ${name}`,
    },
    description,
    applicationName: name,
    openGraph: {
      type: 'website',
      siteName: name,
      title: `${name} · ${finca.subtitle}`,
      description,
      url,
      locale: 'en_US',
      images: [
        {
          url: defaultOgImageUrl(),
          width: 1200,
          height: 1200,
          alt: `${name} — ${finca.subtitle}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} · ${finca.subtitle}`,
      description,
      images: [defaultOgImageUrl()],
    },
    robots: { index: true, follow: true },
  };
}

/**
 * schema.org `LodgingBusiness` JSON-LD for the homepage.
 *
 * Only fields with confirmed values land here — `geo` is deliberately
 * omitted until we have real coordinates. Better to ship less structured
 * data than to ship wrong structured data; Google penalises the latter.
 */
export function lodgingBusinessJsonLd(): Record<string, unknown> {
  const name = `Finca ${finca.name}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name,
    description: finca.description,
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
    checkinTime: finca.check_in_time,
    checkoutTime: finca.check_out_time,
    petsAllowed: finca.amenities.includes('Pets Allowed'),
    amenityFeature: finca.amenities.map((name) => ({
      '@type': 'LocationFeatureSpecification',
      name,
    })),
  };
}
