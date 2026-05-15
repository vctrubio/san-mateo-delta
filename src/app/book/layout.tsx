import type { Metadata } from 'next';
import Link from 'next/link';
import { Title } from '@/components/landing/Title';
import finca from '@config/finca.json';

export const metadata: Metadata = {
  title: 'Book',
  // Don't index the checkout flow — it's transactional, params-driven.
  robots: { index: false, follow: false },
};

// ============================================================================
// /book layout — minimal shell for the booking flow. Intentionally NOT
// reusing FincaLayout: the property banner + eyebrow + closing strip
// would compete with the checkout focus. /book gets a thin top bar
// (clickable Title back to home, slate-50 page bg) and that's it.
// ============================================================================

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            aria-label={`Finca ${finca.name} — home`}
            className="inline-flex items-center transition-transform hover:scale-[1.02]"
          >
            <Title size="banner" />
          </Link>
          <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400">
            Reservation
          </span>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 lg:py-12">
        {children}
      </main>
    </div>
  );
}
