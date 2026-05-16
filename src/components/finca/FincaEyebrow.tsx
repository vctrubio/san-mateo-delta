'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// FincaEyebrow — small ocean-tracked line that sits between the banner
// and the page content. Owns its own "are we on a slug page?" check so
// the layout can stay a server component while still surfacing a
// contextual back link.
//
//   /finca           → ← Finca · Punta Paloma · 300 m walk
//   /finca/[slug]    → ← All properties · Punta Paloma · 300 m walk
//
// Only one back link at a time: the listing page steps back to the
// homepage; a slug page steps back to the listing. Both use Next
// prefetching — no full page reload. `aria-label` carries the verbose
// form for screen readers.
export function FincaEyebrow() {
  const pathname = usePathname() ?? '/finca';
  const onSlugPage = /^\/finca\/[^/]+/.test(pathname);

  return (
    <div className="mb-8 flex items-center gap-3 text-xs font-mono uppercase tracking-[0.3em] text-ocean">
      {onSlugPage ? (
        <Link
          href="/finca"
          aria-label="Back to all properties"
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-ocean transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All properties</span>
        </Link>
      ) : (
        <Link
          href="/"
          aria-label="Back to the Finca San Mateo homepage"
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-ocean transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Finca</span>
        </Link>
      )}
      <span className="text-slate-300" aria-hidden>·</span>
      <span>Punta Paloma · 300 m walk from the beach</span>
    </div>
  );
}
