import Image from 'next/image';
import Link from 'next/link';
import { Title } from '@/components/landing/Title';
import finca from '@config/finca.json';

// ============================================================================
// /finca layout — persistent banner + finca title that stays mounted across
// the index (`/finca`) and the property pages (`/finca/[slug]`). Both child
// routes get this header for free; navigation between them doesn't repaint
// the banner.
//
// Banner = the FincaBanner photo as a full-bleed, SHARP backdrop. The only
// thing that's blurry is a small frosted-glass panel directly behind the
// Title — a `backdrop-blur` cell so the dark Title text stays readable
// without washing out the rest of the photograph.
//
// The Title itself is the navigation control: clicking it takes the user
// back to /finca (the collection). On /finca that's a no-op refresh; on
// /finca/[slug] it returns to the index. The frosted panel grows + warms
// on hover so the affordance is unmistakable.
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
    <header className="relative h-[34vh] min-h-[260px] w-full overflow-hidden border-b border-stone-200">
      {/* Estate photo — full-bleed, SHARP. No blur on the image itself; the
          only blur in the banner is the frosted panel behind the title. */}
      <Image
        src="/finca/banners/FincaBanner.jpg"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      <div className="absolute inset-0 flex items-center justify-center px-6">
        <Link
          href="/finca"
          aria-label={`Finca ${finca.name} — back to all properties`}
          className="group relative inline-flex items-center justify-center px-10 py-6 rounded-3xl backdrop-blur-md bg-white/40 ring-1 ring-white/40 shadow-lg shadow-slate-900/10 transition-all duration-300 hover:bg-white/60 hover:ring-white/70 hover:scale-[1.02] hover:shadow-xl"
        >
          <Title size="banner" />
        </Link>
      </div>
    </header>
  );
}
