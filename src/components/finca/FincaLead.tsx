import type { ReactNode } from 'react';

// ============================================================================
// FincaLead — h1 + description that sits below the layout's eyebrow.
// Server component. Heading is freeform ReactNode so each route can
// compose its own headline (with italic + ocean accent placed where it
// belongs):
//
//   /finca           → "Pick your corner of <San Mateo>."
//   /finca/[slug]    → "The <Villa>"  (property.title with the noun accented)
//
// Layouts in Next App Router can't read child route params, so this lives
// on each page rather than inside `/finca/layout.tsx` — the visual effect
// is identical, the wiring is per-route.
// ============================================================================

export function FincaLead({
  heading,
  description,
  meta,
}: {
  heading: ReactNode;
  description: ReactNode;
  /**
   * Optional content rendered to the right of the heading on md+ screens
   * (wraps below it on mobile). The slug page uses this to surface the
   * PropertyStickers row alongside the property title.
   */
  meta?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-8 mb-6">
        <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tighter text-balance max-w-xl">
          {heading}
        </h1>
        {meta && <div className="md:shrink-0 md:max-w-md md:pt-2">{meta}</div>}
      </div>
      <p className="text-slate-500 text-lg leading-relaxed max-w-2xl">
        {description}
      </p>
    </div>
  );
}

// Splits a property title (e.g. "The Villa") so the article stays plain
// and the noun gets the ocean italic accent treatment. All four current
// titles ("The Villa", "The Residence", "The Retreat", "The Bungalow")
// share the leading article; this helper keeps the brand voice
// consistent without hardcoding the split per property.
export function accentedTitle(title: string): ReactNode {
  const idx = title.indexOf(' ');
  if (idx <= 0) {
    return <span className="italic text-ocean">{title}</span>;
  }
  const article = title.slice(0, idx);
  const noun = title.slice(idx + 1);
  return (
    <>
      {article} <span className="italic text-ocean">{noun}</span>
    </>
  );
}
