import type { MetadataRoute } from 'next';
import { listProperties } from '@/lib/properties';
import { absoluteUrl } from '@/lib/site';

// Public sitemap. Reads property slugs from the DB so new properties show
// up without code changes. Admin/debug/forms/checkout/api are deliberately
// excluded — only customer-facing surface goes in the index.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const properties = await listProperties();
  const now = new Date();

  return [
    {
      url: absoluteUrl('/'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: absoluteUrl('/finca'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...properties.map((p) => ({
      url: absoluteUrl(`/finca/${p.slug}`),
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
