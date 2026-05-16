'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Users, X, ArrowRight, ArrowLeft, CalendarDays } from 'lucide-react';
import Calendar from '@/components/calendar/Calendar';
import { ymd } from '@/components/calendar/dateUtils';
import { accentedTitle } from '@/components/finca/FincaLead';
import { PropertyStickers } from '@/components/finca/PropertyStickers';
import type { Property } from '@/lib/properties';
import type { CalendarItem } from '@/lib/calendar';

// ============================================================================
// PropertyShowcaseGrid — the bento on the landing page.
//
// Each tile opens a two-phase modal:
//
//   Phase A — Summary
//     The same voice the /finca/[slug] page uses: accentedTitle headline +
//     PropertyStickers (characteristics + features). Two CTAs:
//       • "Book now"       → switches to Phase B (date picker)
//       • "View property"  → /finca/[slug]
//
//   Phase B — Pick dates
//     Inline `<Calendar>` driven by the property's public-mode 6-month
//     window (passed in from PropertyShowcase). When the guest picks a
//     valid range, "Continue to booking" lights up and links to
//     /book?slug=…&from=…&to=… — the slug page's flow stays the canonical
//     deep-link path; the modal is a shortcut, not a parallel system.
// ============================================================================

const RATIO_BY_INDEX = [
  'col-span-2 md:col-span-4',
  'col-span-1 md:col-span-2',
  'col-span-1 md:col-span-2',
  'col-span-1 md:col-span-2',
];

function imageFor(slug: string) {
  return `/images/${slug}.png`;
}

function displayName(slug: string) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export default function PropertyShowcaseGrid({
  properties,
  calendarsBySlug,
}: {
  properties: Property[];
  calendarsBySlug: Record<string, CalendarItem[]>;
}) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const open = properties.find((p) => p.slug === openSlug) ?? null;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-10 gap-4">
        {properties.map((p, index) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
            className={RATIO_BY_INDEX[index] ?? 'col-span-1 md:col-span-2'}
          >
            <button
              type="button"
              onClick={() => setOpenSlug(p.slug)}
              aria-label={`Open ${displayName(p.slug)} — ${p.title}`}
              className="relative aspect-[4/5] md:aspect-auto md:h-[600px] w-full rounded-3xl overflow-hidden group cursor-pointer text-left block"
            >
              <Image
                src={imageFor(p.slug)}
                alt={displayName(p.slug)}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 opacity-80" />
              <div className="absolute top-8 left-8 right-8 flex flex-col gap-1">
                <h3 className="text-3xl md:text-5xl font-bold text-white uppercase tracking-tighter">
                  {displayName(p.slug)}
                </h3>
                <span className="text-xs md:text-sm font-mono text-white/70 uppercase tracking-[0.3em]">
                  {p.title}
                </span>
              </div>
              <div className="absolute bottom-8 left-8 flex items-center gap-2">
                <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center gap-2">
                  <Users className="w-4 h-4 text-white" />
                  <span className="text-xs font-mono text-white uppercase tracking-widest">
                    Sleeps {p.max_guests}
                  </span>
                </div>
              </div>
              <div className="absolute inset-0 border-[1px] border-white/0 group-hover:border-white/20 transition-all duration-500 rounded-3xl m-4 pointer-events-none" />
            </button>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <ShowcaseModal
            property={open}
            calendarItems={calendarsBySlug[open.slug] ?? []}
            onClose={() => setOpenSlug(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

type Phase = 'summary' | 'dates';
type Range = { start: Date; end: Date };

function ShowcaseModal({
  property,
  calendarItems,
  onClose,
}: {
  property: Property;
  calendarItems: CalendarItem[];
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('summary');
  const [range, setRange] = useState<Range | null>(null);

  // Scroll lock + Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const bookUrl = range
    ? `/book?slug=${encodeURIComponent(property.slug)}&from=${ymd(range.start)}&to=${ymd(range.end)}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left pane — cover image with title overlay. Stacks above the
            content on mobile, locks to the side at md+ so the modal
            reads as an open book. */}
        <div className="relative md:w-1/2 md:shrink-0 aspect-[4/3] md:aspect-auto bg-slate-100">
          <Image
            src={imageFor(property.slug)}
            alt={displayName(property.slug)}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 text-white">
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/70">
              {displayName(property.slug)}
            </p>
            <h2 className="mt-1 text-3xl md:text-4xl font-bold tracking-tighter text-balance">
              {accentedTitleOnDark(property.title)}
            </h2>
          </div>
        </div>

        {/* Right pane — phase content. Scrollable on its own so the
            cover image stays anchored when the calendar pushes the
            content tall. */}
        <div className="relative flex-1 overflow-y-auto p-6 md:p-8">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>

          {phase === 'summary' ? (
            <SummaryPhase
              property={property}
              onBookNow={() => setPhase('dates')}
            />
          ) : (
            <DatesPhase
              property={property}
              calendarItems={calendarItems}
              range={range}
              setRange={setRange}
              bookUrl={bookUrl}
              onBack={() => setPhase('summary')}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// On the dark cover overlay the ocean accent reads dim — swap to a warm
// white-italic so the headline still has a beat. `accentedTitle` (from
// FincaLead) is the slug-page voice for the slug page itself; on the dark
// modal cover we mirror the structure but tune the color.
function accentedTitleOnDark(title: string) {
  const idx = title.indexOf(' ');
  if (idx <= 0) {
    return <span className="italic text-white/90">{title}</span>;
  }
  const article = title.slice(0, idx);
  const noun = title.slice(idx + 1);
  return (
    <>
      {article} <span className="italic text-white/90">{noun}</span>
    </>
  );
}

// ─── Phase A: summary ──────────────────────────────────────────────────────

function SummaryPhase({
  property,
  onBookNow,
}: {
  property: Property;
  onBookNow: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Slug-voice title repeated inside the panel so the stickers sit
          under it the same way they do on /finca/[slug]. The cover
          overlay shows the same words; on a small viewport the user may
          scroll past it before reaching the CTAs. */}
      <div>
        <h3 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tighter">
          {accentedTitle(property.title)}
        </h3>
        <div className="mt-4">
          <PropertyStickers property={property} kind="both" size="md" />
        </div>
      </div>

      <p className="text-slate-600 leading-relaxed">{property.description}</p>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={onBookNow}
          className="group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-[0.2em] text-white bg-ocean shadow-lg shadow-ocean/30 hover:shadow-2xl hover:shadow-ocean/40 hover:-translate-y-[1px] transition-all duration-200"
        >
          Book now
          <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
        <Link
          href={`/finca/${property.slug}`}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-[0.2em] text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors duration-200"
        >
          View property
        </Link>
      </div>
    </div>
  );
}

// ─── Phase B: dates ────────────────────────────────────────────────────────

function DatesPhase({
  property,
  calendarItems,
  range,
  setRange,
  bookUrl,
  onBack,
}: {
  property: Property;
  calendarItems: CalendarItem[];
  range: Range | null;
  setRange: (r: Range | null) => void;
  bookUrl: string | null;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="group self-start inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-slate-500 hover:text-ocean transition-colors"
      >
        <ArrowLeft className="w-3 h-3 transition-transform duration-200 group-hover:-translate-x-0.5" />
        Back
      </button>

      <Calendar
        slug={property.slug}
        items={calendarItems}
        selectedRange={range ? { start: range.start, end: range.end } : undefined}
        onSelectRange={(start, end) => setRange({ start, end })}
        onClearRange={() => setRange(null)}
      />

      <div className="flex justify-end pt-1">
        {bookUrl ? (
          <Link
            href={bookUrl}
            className="group inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-[0.2em] text-white bg-ocean shadow-lg shadow-ocean/30 hover:shadow-2xl hover:shadow-ocean/40 hover:-translate-y-[1px] transition-all duration-200"
          >
            Continue to booking
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold uppercase tracking-[0.2em] text-slate-400 bg-slate-100"
          >
            <CalendarDays className="w-4 h-4" />
            Pick dates
          </button>
        )}
      </div>
    </div>
  );
}
