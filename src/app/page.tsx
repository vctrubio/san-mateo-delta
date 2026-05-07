import HeroLanding from './landing/HeroLanding';
import PropertyShowcase from './landing/PropertyShowcase';
import AboutSection from './landing/AboutSection';
import Footer from './landing/Footer';

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
