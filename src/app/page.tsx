import HeroLanding from '@/components/landing/HeroLanding';
import PropertyShowcase from '@/components/landing/PropertyShowcase';
import AboutSection from '@/components/landing/AboutSection';
import Footer from '@/components/landing/Footer';
import { lodgingBusinessJsonLd } from '@/lib/site';
import { listProperties } from '@/lib/properties';
import { MONTHS } from '@db/enums';

function derivePriceRange(properties: { rates: Record<number, number> }[]): string | undefined {
  let lo = Infinity;
  let hi = 0;
  for (const p of properties) {
    for (const m of MONTHS) {
      const r = p.rates[m];
      if (r > 0) {
        if (r < lo) lo = r;
        if (r > hi) hi = r;
      }
    }
  }
  if (lo === Infinity || hi === 0) return undefined;
  return `€${Math.round(lo / 100)}–€${Math.round(hi / 100)}`;
}

export default async function Home() {
  // schema.org JSON-LD — inlined as a server-rendered <script> so crawlers
  // see it in the initial HTML (client JS isn't executed reliably). The
  // priceRange comes from the property rates so it stays in sync.
  const properties = await listProperties({ publicOnly: true });
  const jsonLd = lodgingBusinessJsonLd({ priceRange: derivePriceRange(properties) });
  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HeroLanding />
      <PropertyShowcase />
      <AboutSection />
      <Footer />
    </main>
  );
}
