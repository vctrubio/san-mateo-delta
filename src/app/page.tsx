import HeroLanding from '@/components/landing/HeroLanding';
import PropertyShowcase from '@/components/landing/PropertyShowcase';
import AboutSection from '@/components/landing/AboutSection';
import Footer from '@/components/landing/Footer';
import { lodgingBusinessJsonLd } from '@/lib/site';

export default function Home() {
  // schema.org JSON-LD — inlined as a server-rendered <script> so crawlers
  // see it in the initial HTML (client JS isn't executed reliably).
  const jsonLd = lodgingBusinessJsonLd();
  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HeroLanding />
      <PropertyShowcase />
      <AboutSection />
      <Footer tone="white" />
    </main>
  );
}
