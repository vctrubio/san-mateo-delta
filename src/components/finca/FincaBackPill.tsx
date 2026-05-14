'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// Context-aware back pill for the /finca banner. The "back" target shifts
// with the current route so the banner is the only navigation control the
// user needs:
//
//   /finca           → Home          (back to /)
//   /finca/[slug]    → All properties (back to /finca)
//
// Living in the layout means it doesn't re-render between /finca and
// /finca/[slug] — `usePathname` just updates the label + href client-side.
//
// Styled for the warm-cream banner surface — white-tinted backdrop with a
// soft stone border so the pill reads as a floating control without
// clashing with the cream background.

export function FincaBackPill() {
  const pathname = usePathname() ?? '/finca';
  const onProperty = pathname.startsWith('/finca/');
  const href = onProperty ? '/finca' : '/';
  const label = onProperty ? 'All properties' : 'Home';

  return (
    <Link
      href={href}
      className="absolute top-4 left-4 sm:top-6 sm:left-6 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/70 backdrop-blur-md border border-stone-200 text-slate-700 text-[10px] font-mono uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-colors"
    >
      <ArrowLeft className="w-3 h-3" />
      {label}
    </Link>
  );
}
