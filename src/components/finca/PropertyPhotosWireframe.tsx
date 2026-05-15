import type { Property } from '@/lib/properties';

// ============================================================================
// PropertyPhotosWireframe — editorial photo spread for /finca/[slug].
//
// No tabs, no chips, no active-state machinery. Every category renders as
// its own section in a single vertical scroll, separated by the same
// "── label ──" divider used by `<Title>` for the FINCA stamp. Scrolling
// IS the navigation — there's nothing extra to read, no chrome competing
// with the imagery.
//
// Server component (no state needed). Once Cloudinary lands, each tile
// becomes a `<CldImage>` pointing at `san-mateo/finca/{slug}/{category}/{n}`
// (see `docs/cloudinary.md`). Section order = display order — change
// `deriveSections` to reshape the spread.
//
// Category derivation reads from the property's `bedrooms` / `bathrooms`
// / `m2_terrace`, so adding a bedroom in the admin auto-grows the spread
// and the expected Cloudinary folder set.
// ============================================================================

type PhotoSection = {
  /** Cloudinary path segment under `san-mateo/finca/{slug}/`. */
  id: string;
  /** Section eyebrow label. */
  label: string;
  /** Placeholder count. Will become the real listing length post-Cloudinary. */
  count: number;
};

function deriveSections(property: Property): PhotoSection[] {
  const out: PhotoSection[] = [
    { id: 'interior', label: 'Interior', count: 4 },
    { id: 'exterior', label: 'Exterior', count: 4 },
  ];
  for (let i = 1; i <= property.bedrooms; i++) {
    out.push({ id: `bedroom/${i}`, label: `Bedroom ${i}`, count: 4 });
  }
  for (let i = 1; i <= property.bathrooms; i++) {
    out.push({ id: `bathroom/${i}`, label: `Bathroom ${i}`, count: 3 });
  }
  if (property.m2_terrace > 0) {
    out.push({ id: 'terrace', label: 'Terrace', count: 4 });
  }
  return out;
}

export function PropertyPhotosWireframe({ property }: { property: Property }) {
  const sections = deriveSections(property);

  return (
    <div className="space-y-12">
      {sections.map((s) => (
        <PhotoSectionView key={s.id} section={s} />
      ))}
    </div>
  );
}

function PhotoSectionView({ section }: { section: PhotoSection }) {
  return (
    <section>
      {/* FINCA-style divider: thin line · eyebrow · thin line.
          Same composition Title.tsx uses for the "── FINCA ──" stamp; the
          brand voice carries here so the spread reads as one piece with
          the rest of the page. */}
      <div className="flex items-center gap-4 mb-5">
        <div className="h-px bg-slate-200 grow" />
        <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400 whitespace-nowrap">
          {section.label}
        </span>
        <div className="h-px bg-slate-200 grow" />
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: section.count }).map((_, i) => (
          <li
            key={`${section.id}-${i}`}
            className="aspect-[4/3] rounded-2xl bg-slate-100 border border-slate-200"
          />
        ))}
      </ul>
    </section>
  );
}
