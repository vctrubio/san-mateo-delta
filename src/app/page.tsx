import HeroLanding from '@/components/landing/HeroLanding';
import PropertyShowcase from '@/components/landing/PropertyShowcase';
import AboutSection from '@/components/landing/AboutSection';
import Footer from '@/components/landing/Footer';

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroLanding />
      <PropertyShowcase />
      <AboutSection />
      <Footer />
    </main>
  );
}
