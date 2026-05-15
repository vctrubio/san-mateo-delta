import { PropertyNavigationGallerySkeleton } from '@/components/finca/PropertyNavigationGallery';

// /finca/[slug] loading skeleton — fires during route transitions
// (especially when the user clicks a sibling property in the navigation
// gallery on the live page). Matches the live layout's dimensions so the
// page doesn't shift when it lands.
//
// Skeleton mirrors:
//   - the FincaLead block (h1 + paragraph placeholders)
//   - the PropertyNavigationGallery grid (hero + 4 thumbnail strip)
export default function Loading() {
  return (
    <>
      <div className="mb-8 max-w-2xl space-y-4">
        <div className="h-12 md:h-16 w-3/4 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-5/6 bg-slate-200 rounded animate-pulse" />
      </div>

      <PropertyNavigationGallerySkeleton />
    </>
  );
}
