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
  sticky = false,
  children,
}: {
  heading: ReactNode;
  description: ReactNode;
  /**
   * Optional content rendered directly below the heading (PropertyStickers
   * on slug pages). When `sticky` is true, the heading + meta block pins
   * to the top of the viewport on scroll while the description and any
   * `children` stay in the normal flow.
   */
  meta?: ReactNode;
  /**
   * Pin the heading + meta to top:0 as the user scrolls past the banner.
   * The pin holds until the lead's *containing block* (this component's
   * outer wrapper) exits the viewport — so anything you pass via
   * `children` extends the range. On /finca/[slug] the
   * PropertyNavigationGallery is passed as children so the title +
   * stickers stay anchored all the way down to the section tabs.
   */
  sticky?: boolean;
  /**
   * Optional content rendered inside the sticky containing block, below
   * the description. Use this to extend how far the sticky head pins —
   * the head stays in view until the bottom of the outer wrapper passes
   * the top of the viewport.
   */
  children?: ReactNode;
}) {
  // The sticky container needs a backdrop so content scrolling behind it
  // doesn't bleed through. slate-50/95 matches FincaLayout's page bg with
  // a touch of translucency for the blur to add atmosphere. z-30 stays
  // below the lightbox (z-50).
  const headBlock = (
    <div
      className={
        sticky
          ? 'sticky top-0 z-30 -mx-6 px-6 py-4 bg-slate-50/95 backdrop-blur-sm'
          : ''
      }
    >
      <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tighter text-balance max-w-xl">
        {heading}
      </h1>
      {meta && <div className="mt-4">{meta}</div>}
    </div>
  );

  return (
    <div className="mb-8">
      {headBlock}
      <p className="text-slate-500 text-lg leading-relaxed mt-2">
        {description}
      </p>
      {children}
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
