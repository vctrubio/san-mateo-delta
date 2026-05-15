import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

// Public robots.txt. Crawlers may index everything except admin / debug /
// forms / api / checkout / per-user dashboards — those are either
// authenticated, observability-only, or transactional. The sitemap pointer
// nudges Google straight to the customer-facing index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/api/',
          '/checkout/',
          '/debug',
          '/forms',
          '/user',
          '/user/',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
