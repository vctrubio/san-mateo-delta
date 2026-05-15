import Image from 'next/image';
import Link from 'next/link';
import { Title } from '@/components/landing/Title';
import { FincaEyebrow } from '@/components/finca/FincaEyebrow';
import { FincaLocation } from '@/components/finca/FincaLocation';
import { HostsRow } from '@/components/finca/HostsRow';
import Footer from '@/components/landing/Footer';
import finca from '@config/finca.json';

// ============================================================================
// /finca layout — the persistent shell wrapping /finca and /finca/[slug]:
//
//   [Banner]                       — FincaBanner photo + clickable Title
//   [FincaEyebrow]                 — Punta Paloma line + back-to-/finca link
//   {children}                     — the per-route content
//   [Location 2/3 | Hosts 1/3]     — closing strip, two-column on lg+
//   [Footer]                       — the same one used on the homepage
//
// The estate-wide amenities don't render here anymore — they live in the
// per-property PropertyStickers (characteristics) on each slug surface,
// which means the bottom of the page doesn't repeat what's already up
// top. Footer (from `@/components/landing/Footer`) ships the social
// links + wind ticker, keeping the same closing voice as the homepage.
// ============================================================================

export default function FincaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Banner />
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-16">
        <FincaEyebrow />
        {children}

        {/* Closing strip — Hosts (stacked, left) + Location (wider, right).
            `h-full` on FincaLocation lets it match the combined hosts
            height. On narrow widths the grid collapses to single column;
            hosts land on top, then the location card. */}
        <section className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-2">
          <HostsRow />
          <div className="lg:col-span-2">
            <FincaLocation />
          </div>
        </section>
      </div>
      <Footer />
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
