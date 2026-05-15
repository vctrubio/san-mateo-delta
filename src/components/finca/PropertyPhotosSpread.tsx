'use client';

import { useState, useEffect, useCallback } from 'react';
import { CldImage } from 'next-cloudinary';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CloudinaryPhoto } from '@/lib/cloudinary';

// ============================================================================
// PropertyPhotosSpread — client renderer for the photo essay below the
// section tabs on /finca/[slug]. Receives the pre-filtered section list
// from `PropertyPhotosWireframe` (server) and owns:
//
//   - The grid render per section (FINCA-style divider + thumbnails)
//   - The lightbox state (active section + photo index)
//   - Keyboard navigation (←/→/Esc), section-pill jumping
//   - Body-scroll lock while the lightbox is open
//
// Lives as a single client component because `<CldImage>` uses hooks
// internally, and we need state + handlers across all sections to drive
// the lightbox's room-to-room navigation.
// ============================================================================

export type PhotoSection = {
  id: string;
  label: string;
  photos: CloudinaryPhoto[];
};

type Active = { sectionIdx: number; photoIdx: number };

export function PropertyPhotosSpread({ sections }: { sections: PhotoSection[] }) {
  const [active, setActive] = useState<Active | null>(null);

  const close = useCallback(() => setActive(null), []);

  // Prev / next wrap within the current section. Crossing into the next
  // section would feel surprising; the section pills at the bottom of
  // the lightbox are the explicit "switch room" affordance.
  const prev = useCallback(() => {
    setActive((a) => {
      if (!a) return a;
      const len = sections[a.sectionIdx].photos.length;
      return { sectionIdx: a.sectionIdx, photoIdx: (a.photoIdx - 1 + len) % len };
    });
  }, [sections]);

  const next = useCallback(() => {
    setActive((a) => {
      if (!a) return a;
      const len = sections[a.sectionIdx].photos.length;
      return { sectionIdx: a.sectionIdx, photoIdx: (a.photoIdx + 1) % len };
    });
  }, [sections]);

  const jumpToSection = useCallback((idx: number) => {
    setActive({ sectionIdx: idx, photoIdx: 0 });
  }, []);

  // Keyboard + scroll lock while the lightbox is open.
  useEffect(() => {
    if (active === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [active, close, prev, next]);

  return (
    <>
      <div className="space-y-12">
        {sections.map((section, sIdx) => (
          <Section
            key={section.id}
            section={section}
            onOpen={(photoIdx) => setActive({ sectionIdx: sIdx, photoIdx })}
          />
        ))}
      </div>

      {active && (
        <Lightbox
          sections={sections}
          active={active}
          onClose={close}
          onPrev={prev}
          onNext={next}
          onJumpSection={jumpToSection}
        />
      )}
    </>
  );
}

// ─── Section grid ──────────────────────────────────────────────────────────

function Section({
  section,
  onOpen,
}: {
  section: PhotoSection;
  onOpen: (photoIdx: number) => void;
}) {
  return (
    <section>
      <div className="flex items-center gap-4 mb-5">
        <div className="h-px bg-slate-200 grow" />
        <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400 whitespace-nowrap">
          {section.label}
        </span>
        <div className="h-px bg-slate-200 grow" />
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {section.photos.map((photo, i) => (
          <li key={photo.publicId}>
            <button
              type="button"
              onClick={() => onOpen(i)}
              aria-label={`Open ${section.label} photo ${i + 1} of ${section.photos.length}`}
              className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 w-full block cursor-zoom-in"
            >
              <CldImage
                src={photo.publicId}
                alt={`${section.label} — Finca San Mateo`}
                width={photo.width}
                height={photo.height}
                crop="fill"
                gravity="auto"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Lightbox overlay ──────────────────────────────────────────────────────

function Lightbox({
  sections,
  active,
  onClose,
  onPrev,
  onNext,
  onJumpSection,
}: {
  sections: PhotoSection[];
  active: Active;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onJumpSection: (idx: number) => void;
}) {
  const section = sections[active.sectionIdx];
  const photo = section.photos[active.photoIdx];
  const total = section.photos.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Property photo viewer"
      className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex flex-col"
    >
      {/* Top bar — section label + counter on the left, close on the right. */}
      <div className="flex items-center justify-between px-6 py-4 text-white shrink-0">
        <p className="text-[11px] font-mono uppercase tracking-[0.4em] text-white/80">
          {section.label}{' '}
          <span className="text-white/40">·</span>{' '}
          <span className="text-white">{active.photoIdx + 1}</span>
          <span className="text-white/40"> / {total}</span>
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Photo area — full-fit, prev/next overlay buttons. */}
      <div className="flex-1 flex items-center justify-center px-4 relative min-h-0">
        {total > 1 && (
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous photo"
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}

        <div className="max-w-[90vw] max-h-full flex items-center justify-center">
          <CldImage
            key={photo.publicId}
            src={photo.publicId}
            alt={`${section.label} — Finca San Mateo`}
            width={photo.width}
            height={photo.height}
            sizes="90vw"
            className="max-w-[90vw] max-h-[78vh] w-auto h-auto object-contain rounded-lg shadow-2xl shadow-black/50"
          />
        </div>

        {total > 1 && (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next photo"
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        )}
      </div>

      {/* Section pills — jump to a different room. The active room
          highlights bright white; others stay translucent. */}
      <div className="px-6 py-5 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 shrink-0">
        {sections.map((s, i) => {
          const isActive = i === active.sectionIdx;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onJumpSection(i)}
              aria-pressed={isActive}
              className={
                'px-4 py-2 rounded-full text-[11px] font-mono uppercase tracking-widest transition-colors ' +
                (isActive
                  ? 'bg-white text-slate-900'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white')
              }
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
