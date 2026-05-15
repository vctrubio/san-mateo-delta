import Image from 'next/image';
import Link from 'next/link';
import { Title } from '@/components/landing/Title';
import { FincaEyebrow } from '@/components/finca/FincaEyebrow';
import { AmenityRibbon } from '@/components/finca/AmenityRibbon';
import { HostsRow } from '@/components/finca/HostsRow';
import finca from '@config/finca.json';

// ============================================================================
// /finca layout — the persistent shell wrapping /finca and /finca/[slug]:
//
//   [Banner]                       — FincaBanner photo + clickable Title
//   [FincaEyebrow]                 — Punta Paloma line + back-to-/finca link
//                                    (the back link only renders on slug pages,
//                                    via usePathname inside the client widget)
//   {children}                     — the per-route content (FincaLead +
//                                    middle body — list or PropertyView)
//   [AmenityRibbon]                — estate-wide amenities, every page
//   [HostsRow]                     — David + Tano, every page
//
// AmenityRibbon and HostsRow live HERE (not in the pages) because they're
// route-agnostic and should never re-render between /finca and
// /finca/[slug] navigations — the React tree stays mounted across the
// transition.
// ============================================================================

export default function FincaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Banner />
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-16">
        <FincaEyebrow />
        {children}
        <AmenityRibbon />
        <HostsRow />
      </div>
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
