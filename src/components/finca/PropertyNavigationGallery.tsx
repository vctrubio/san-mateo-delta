import Image from 'next/image';
import Link from 'next/link';
import type { Property } from '@/lib/properties';

// ============================================================================
// PropertyNavigationGallery — the slug page's photo + sibling-property
// switcher, side-by-side. Server component, no state, no animation.
//
// Layout:
//   ┌──────────────────────────┬──────────┐
//   │                          │  Levante │
//   │                          ├──────────┤
//   │     <hero photo>         │  Estrecho│
//   │                          ├──────────┤
//   │                          │  Marea   │
//   │                          ├──────────┤
//   │                          │  Cala    │
//   └──────────────────────────┴──────────┘
//
// On mobile the right column collapses to a horizontal scroll strip below
// the hero. The active property gets a slate-900 ring; siblings dim.
//
// Each thumbnail is a Next `<Link>` to `/finca/{slug}` — switching is a
// real navigation. Next prefetches on hover, so the swap is fast and the
// server can re-fetch any per-property state cleanly (no client state to
// reconcile).
// ============================================================================

function displayName(slug: string) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function PropertyNavigationGallery({
  properties,
  currentSlug,
}: {
  properties: readonly Property[];
  currentSlug: string;
}) {
  const current =
    properties.find((p) => p.slug === currentSlug) ?? properties[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
      <Hero property={current} />
      <Strip properties={properties} currentSlug={current.slug} />
    </div>
  );
}

// Hero — full-bleed photo of the active property. No animation; with URL
// navigation each property load is a fresh page render, so an in-place
// cross-fade is no longer the right semantic.
function Hero({ property }: { property: Property }) {
  return (
    <div className="relative h-[42vh] min-h-[280px] lg:h-auto lg:min-h-0 lg:aspect-auto rounded-3xl overflow-hidden bg-slate-100">
      <Image
        src={`/images/${property.slug}.png`}
        alt={displayName(property.slug)}
        fill
        priority
        className="object-cover"
        sizes="(max-width: 1024px) 100vw, 60vw"
      />
    </div>
  );
}

// Strip — vertical thumbnail column on desktop, horizontal scroll on
// mobile. Each tile is a Link to the matching slug. Active one ringed,
// siblings dimmed until hover.
function Strip({
  properties,
  currentSlug,
}: {
  properties: readonly Property[];
  currentSlug: string;
}) {
  return (
    <div
      className="
        flex flex-row lg:flex-col gap-2 lg:gap-3
        overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto
        lg:max-h-[calc(42vh+0px)]
        snap-x snap-mandatory lg:snap-none
        -mx-1 px-1
      "
    >
      {properties.map((p) => {
        const isActive = p.slug === currentSlug;
        return (
          <Link
            key={p.slug}
            href={`/finca/${p.slug}`}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'relative shrink-0 snap-start',
              'w-40 lg:w-full',
              'h-24 lg:h-[calc(((42vh-32px)/4))]',
              'lg:min-h-[88px]',
              'rounded-2xl overflow-hidden group',
              'transition-all duration-300',
              isActive
                ? 'ring-2 ring-slate-900 shadow-md'
                : 'opacity-65 hover:opacity-100 ring-1 ring-slate-200',
            ].join(' ')}
          >
            <Image
              src={`/images/${p.slug}.png`}
              alt={displayName(p.slug)}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 160px, 240px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-2 left-3 right-3 text-white text-left">
              <p className="text-[8px] font-mono uppercase tracking-widest text-white/70 truncate">
                {p.title}
              </p>
              <p className="text-sm font-bold uppercase tracking-tight leading-tight">
                {displayName(p.slug)}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// Skeleton — same dimensions as the live gallery so the layout doesn't
// shift when navigation lands. Used by `src/app/finca/[slug]/loading.tsx`
// during the route transition.
export function PropertyNavigationGallerySkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
      <div className="relative h-[42vh] min-h-[280px] lg:h-auto lg:min-h-0 lg:aspect-auto rounded-3xl overflow-hidden bg-slate-200 animate-pulse" />
      <div className="flex flex-row lg:flex-col gap-2 lg:gap-3 -mx-1 px-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-40 lg:w-full h-24 lg:h-[calc(((42vh-32px)/4))] lg:min-h-[88px] rounded-2xl bg-slate-200 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
