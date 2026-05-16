import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listProperties } from '@/lib/properties';
import { getCalendarItems, windowFor } from '@/lib/calendar';
import { getActivePaymentPolicy } from '@/lib/systemSettings';
import { PROPERTY_LABELS, type PropertySlug } from '@/lib/colors';
import { absoluteUrl, propertyImageUrl } from '@/lib/site';
import { FincaLead, accentedTitle } from '@/components/finca/FincaLead';
import { PropertyNavigationGallery } from '@/components/finca/PropertyNavigationGallery';
import { PropertyStickers } from '@/components/finca/PropertyStickers';
import { PropertyPhotosWireframe } from '@/components/finca/PropertyPhotosWireframe';
import { PropertySectionTabs } from '@/components/finca/PropertySectionTabs';
import { PropertyPrices } from '@/components/finca/PropertyPrices';
import { PropertyJsonLd } from '@/components/finca/PropertyJsonLd';
import fincaData from '@config/finca.json';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const properties = await listProperties({ publicOnly: true });
  const property = properties.find((p) => p.slug === slug);
  if (!property) return {};

  const label = PROPERTY_LABELS[property.slug as PropertySlug] ?? property.slug;
  // Lead the title and description with the Punta Paloma hook so this page
  // ranks for "<property> Punta Paloma" queries as well as estate-level
  // ones. The root template ("· Finca San Mateo") fills in the suffix.
  const title = `${label} · ${property.title} · 300 m from Punta Paloma`;
  const description = `${property.title} — ${property.max_guests}-guest holiday rental 300 metres from Punta Paloma Beach, ${fincaData.subtitle}. ${property.description}`;
  const canonical = absoluteUrl(`/finca/${slug}`);
  const image = propertyImageUrl(slug);
  const keywords = [
    `${label} Punta Paloma`,
    `${label} ${fincaData.subtitle}`,
    `Punta Paloma rental ${property.max_guests} guests`,
    ...property.features.slice(0, 3).map((f) => `${f} ${fincaData.subtitle}`),
  ];

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      title: `${title} · Finca ${fincaData.name}`,
      description,
      url: canonical,
      images: [{ url: image, width: 1200, height: 630, alt: `${label} — ${property.title}, Finca ${fincaData.name}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · Finca ${fincaData.name}`,
      description,
      images: [image],
    },
  };
}

// /finca/[slug] — server thin shell.
//
// Fetches: properties (for the navigation gallery), the public calendar
// window for this slug (6 months forward), and the estate-wide active
// payment policy (for the Prices tab). All three run in parallel.
//
// The slug page composes:
//   FincaLead (title + stickers + description)
//   PropertyNavigationGallery (hero photo + sibling switcher)
//   PropertySectionTabs (client switcher) wrapping three RSC children:
//     - property      → PropertyPhotosWireframe (Cloudinary stub)
//     - availability  → public Calendar with held bookings + blocks
//     - prices        → PropertyPrices (rate table + cleaning + policy)
//
// No loading.tsx — the skeleton flash on every URL switch felt worse than
// a momentary stall.
export default async function PropertyDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const properties = await listProperties({ publicOnly: true });
  const selected = properties.find((p) => p.slug === slug);
  if (!selected) notFound();

  const { from, to } = windowFor(new Date(), 6);
  const [items, activePolicy] = await Promise.all([
    getCalendarItems({ propertyId: selected.id, from, to, mode: 'public' }),
    getActivePaymentPolicy(),
  ]);

  return (
    <>
      <PropertyJsonLd property={selected} />
      {/* FincaLead wraps the nav-gallery as children so its sticky title
          + stickers stay anchored to the top while the description and
          the gallery scroll past. The pin releases when PropertySectionTabs
          (the next sibling, outside the lead) comes into view. */}
      <FincaLead
        heading={accentedTitle(selected.title)}
        description={selected.description}
        meta={<PropertyStickers property={selected} size="md" kind="both" />}
        sticky
      >
        <div className="mt-8">
          <PropertyNavigationGallery properties={properties} currentSlug={slug} />
        </div>
      </FincaLead>

      <PropertySectionTabs
        slug={selected.slug}
        calendarItems={items}
        property={<PropertyPhotosWireframe property={selected} />}
        prices={<PropertyPrices property={selected} activePolicy={activePolicy.policy} />}
      />
    </>
  );
}
