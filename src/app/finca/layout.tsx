import { FincaBackPill } from '@/components/finca/FincaBackPill';
import { Title } from '@/components/landing/Title';

// ============================================================================
// /finca layout — persistent banner + finca title that stays mounted across
// the index (`/finca`) and the property pages (`/finca/[slug]`). Both child
// routes get this header for free; navigation between them doesn't repaint
// the banner.
//
// Banner reuses the `<Title>` component from `/components/landing/Title`
// so the brand stamp on the homepage hero and the finca header speak the
// same language — just at a smaller scale (`size="banner"`). Cream
// background contrasts (warm vs cool) with the `slate-50` page body.
// ============================================================================

export default function FincaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Banner />
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-16">{children}</div>
    </div>
  );
}

function Banner() {
  return (
    <header className="relative h-[34vh] min-h-[260px] w-full bg-[#F5F2ED] border-b border-stone-200 overflow-hidden">
      {/* Soft sand-toned blobs — give the cream surface a hint of depth
          without competing with the typographic stamp. */}
      <div aria-hidden className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-amber-200/30 blur-3xl pointer-events-none" />
      <div aria-hidden className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-sky-200/40 blur-3xl pointer-events-none" />

      <FincaBackPill />

      <div className="absolute inset-0 flex items-center justify-center px-6">
        <Title size="banner" />
      </div>
    </header>
  );
}
