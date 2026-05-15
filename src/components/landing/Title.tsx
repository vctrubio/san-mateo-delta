import fincaData from '@config/finca.json';

// ============================================================================
// Title — the iconic "SAN MATEO / ── FINCA ── / TARIFA" typographic stamp.
// Used at full-blast on the homepage HeroLanding, and at a smaller scale
// inside the /finca banner so both surfaces share the same brand language.
//
// `size`:
//   'hero'   — full-screen landing (text-6xl → text-9xl)
//   'banner' — compact for the persistent /finca header (text-3xl → text-6xl)
// ============================================================================

export function Title({ size = 'hero' }: { size?: 'hero' | 'banner' }) {
  const isHero = size === 'hero';

  const titleClass = isHero
    ? 'text-6xl md:text-9xl'
    : 'text-3xl sm:text-4xl md:text-5xl';

  const subtitleClass = isHero
    ? 'text-6xl md:text-9xl'
    : 'text-3xl sm:text-4xl md:text-5xl';

  const dividerMargin = isHero ? 'my-4 md:my-6' : 'my-2 md:my-3';
  const dividerTextClass = isHero
    ? 'text-[10px] md:text-xs'
    : 'text-[9px] md:text-[10px]';

  return (
    <div className="relative z-10 inline-flex flex-col items-center">
      <h1 className={`${titleClass} font-bold tracking-tighter text-slate-900 leading-[0.8] uppercase`}>
        {fincaData.name}
      </h1>

      <div className={`w-full flex items-center justify-between gap-4 ${dividerMargin}`}>
        <div className="h-px bg-slate-300 grow" />
        <span className={`${dividerTextClass} font-mono tracking-[1em] text-slate-400 uppercase pl-[1em]`}>
          FINCA
        </span>
        <div className="h-px bg-slate-300 grow" />
      </div>

      <h2 className={`${subtitleClass} font-bold tracking-[0.28em] text-slate-900 leading-[0.8] uppercase ml-[0.28em]`}>
        {fincaData.subtitle}
      </h2>
    </div>
  );
}
