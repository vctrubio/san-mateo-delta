import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listProperties } from '@/lib/properties';
import { PROPERTY_LABELS, type PropertySlug } from '@/lib/colors';
import { absoluteUrl, propertyImageUrl } from '@/lib/site';
import { FincaLead, accentedTitle } from '@/components/finca/FincaLead';
import { PropertyNavigationGallery } from '@/components/finca/PropertyNavigationGallery';
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

// /finca/[slug] — server thin shell. Fetches the property list and renders
// the lead + the navigation gallery. Booking flow, calendar, pricing,
// availability windows, etc. previously lived here via PropertyView; the
// page is being rebuilt from scratch — see `plan/` for the next pass.
//
// `loading.tsx` next to this page renders a `<PropertyNavigationGallerySkeleton>`
// so the route transition doesn't flash.
export default async function PropertyDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const properties = await listProperties();
  const selected = properties.find((p) => p.slug === slug);
  if (!selected) notFound();

  return (
    <>
      <FincaLead
        heading={accentedTitle(selected.title)}
        description={selected.description}
      />

      <PropertyNavigationGallery properties={properties} currentSlug={slug} />
    </>
  );
}
