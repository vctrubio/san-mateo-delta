import Link from 'next/link';
import { ArrowDown } from 'lucide-react';
import { Title } from './Title';

function Wireframe() {
  return (
    <>
      <div className="absolute top-0 right-0 w-64 h-64 bg-sky-100/30 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-sand/30 rounded-full -ml-48 -mb-48 blur-3xl opacity-30" />

      <div className="pointer-events-none absolute inset-0 z-0">
        <svg
          className="h-full w-full"
          viewBox="0 0 1200 800"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="wireframeStroke" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0f172a" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#0369a1" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          <g fill="none" stroke="url(#wireframeStroke)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 294 88 L 344 142 L 370 208 L 388 276 L 438 328 L 510 360 L 600 368 L 690 350 L 756 312 L 810 258 L 834 194 L 850 132" />
            <path d="M 570 370 L 556 412 L 568 456" strokeOpacity="0.62" />

            <path d="M 892 724 L 838 668 L 808 602 L 790 548 L 738 506 L 664 482 L 576 474 L 490 488 L 420 518 L 370 564 L 336 622 L 310 688" />
            <path d="M 636 474 L 646 518 L 636 564" strokeOpacity="0.58" />

            <path d="M 570 458 L 636 564" strokeDasharray="8 8" strokeWidth="1.9" />
            <path d="M 542 472 L 664 550" strokeDasharray="6 10" strokeWidth="1.2" strokeOpacity="0.55" />
          </g>

          <g fill="#0f172a" opacity="0.6" fontFamily="var(--font-mono)" fontSize="16" letterSpacing="0.08em">
            <text x="702" y="126" fontSize="12" opacity="0.75">EUROPE</text>
            <text x="716" y="738" fontSize="12" opacity="0.75">AFRICA</text>
            <text x="620" y="602">TANGIER</text>
            <text x="706" y="630" fontSize="12" opacity="0.7">MOROCCO</text>
            <text x="654" y="500" fontSize="10" opacity="0.6">STRAIT OF GIBRALTAR</text>
            <text x="656" y="526" fontSize="10" opacity="0.65">13 KM</text>
          </g>

          <g fill="#0369a1" opacity="0.6">
            <circle cx="570" cy="458" r="4" />
            <circle cx="636" cy="564" r="4" />
          </g>
        </svg>
      </div>
    </>
  );
}

export default function HeroLanding() {
  return (
    <section className="h-screen flex flex-col items-center justify-center text-center px-4 bg-background relative overflow-hidden">
      <Wireframe />
      <Title size="hero" />
      {/* Hero CTA — orients first-time visitors. The wireframe is decorative;
          without a verb, guests don't know what they can do here. Anchor link
          smooth-scrolls to the property collection just below. */}
      <Link
        href="#homes"
        className="relative z-10 mt-10 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 text-white text-[10px] font-mono uppercase tracking-[0.3em] font-bold hover:bg-ocean hover:shadow-xl hover:shadow-ocean/30 transition-all"
      >
        See the homes
        <ArrowDown className="w-3.5 h-3.5" />
      </Link>
    </section>
  );
}
