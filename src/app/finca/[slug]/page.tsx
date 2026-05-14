import { notFound } from 'next/navigation';
import { listProperties } from '@/lib/properties';
import { getCalendarItems, windowFor } from '@/lib/calendar';
import type { CalendarItem } from '@/lib/calendar';
import PropertyView from '@/components/finca/PropertyView';

export const dynamic = 'force-dynamic';

// /finca/[slug] — server thin shell. Fetches all four properties + their
// availability windows in parallel; the client `PropertyView` owns the
// "selected" state so the carousel can switch in-place with animation
// without hitting the network. The URL slug only seeds the initial pick.
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
  const itemsEntries = await Promise.all(
    properties.map(async (p): Promise<[string, CalendarItem[]]> => [
      p.slug,
      await getCalendarItems({ propertyId: p.id, from, to, mode: 'public' }),
    ]),
  );
  const itemsBySlug = Object.fromEntries(itemsEntries);

  return (
    <PropertyView
      properties={properties}
      initialSlug={slug}
      itemsBySlug={itemsBySlug}
    />
  );
}
