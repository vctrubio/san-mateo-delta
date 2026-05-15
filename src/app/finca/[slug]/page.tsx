import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listProperties } from '@/lib/properties';
import { getCalendarItems, windowFor } from '@/lib/calendar';
import type { CalendarItem } from '@/lib/calendar';
import PropertyView from '@/components/finca/PropertyView';
import { getActivePaymentPolicy } from '@/lib/systemSettings';
import { PROPERTY_LABELS, type PropertySlug } from '@/lib/colors';
import { absoluteUrl, propertyImageUrl } from '@/lib/site';
import fincaData from '@config/finca.json';

export const dynamic = 'force-dynamic';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const properties = await listProperties();
  const property = properties.find((p) => p.slug === slug);
  if (!property) return {};

  const label = PROPERTY_LABELS[property.slug as PropertySlug] ?? property.slug;
  const title = `${label} · ${property.title}`;
  const description = property.description;
  const canonical = absoluteUrl(`/finca/${slug}`);
  const image = propertyImageUrl(slug);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} · Finca ${fincaData.name}`,
      description,
      url: canonical,
      images: [{ url: image, alt: `${label} — Finca ${fincaData.name}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · Finca ${fincaData.name}`,
      description,
      images: [image],
    },
  };
}

// /finca/[slug] — server thin shell. Fetches all four properties + their
// availability windows in parallel; the client `PropertyView` owns the
// "selected" state so the carousel can switch in-place with animation
// without hitting the network. The URL slug only seeds the initial pick.
//
// `activePolicy` is the estate-wide payment policy in effect right now —
// the booking receipt resolves it against the guest's selected dates
// (collapsing 50/14 to 100% upfront when check-in is too close, etc.) and
// the submit path adapts (no Stripe call on cash policies, full charge
// when collapsed).
export default async function PropertyDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const properties = await listProperties();
  const selected = properties.find((p) => p.slug === slug);
  if (!selected) notFound();

  const { from, to } = windowFor(new Date(), 6);
  const [itemsEntries, activePolicy] = await Promise.all([
    Promise.all(
      properties.map(async (p): Promise<[string, CalendarItem[]]> => [
        p.slug,
        await getCalendarItems({ propertyId: p.id, from, to, mode: 'public' }),
      ]),
    ),
    getActivePaymentPolicy(),
  ]);
  const itemsBySlug = Object.fromEntries(itemsEntries);

  return (
    <PropertyView
      properties={properties}
      initialSlug={slug}
      itemsBySlug={itemsBySlug}
      activePolicy={activePolicy.policy}
    />
  );
}
