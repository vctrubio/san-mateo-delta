'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Home, CalendarDays, Euro, BookOpen, type LucideIcon } from 'lucide-react';
import Calendar from '@/components/calendar/Calendar';
import { ymd } from '@/components/calendar/dateUtils';
import type { CalendarItem } from '@/lib/calendar';

// ============================================================================
// PropertySectionTabs — client tab switcher beneath the
// PropertyNavigationGallery on /finca/[slug].
//
// Owns:
//   - active-tab state (property / availability / prices)
//   - picked-range state (driven by the Calendar in the Availability tab)
//
// The picked range gates the **Book** button on the right of the nav.
// Range valid → button is a `<Link href="/book?slug=…&from=…&to=…">`.
// Range missing → button is a styled `<button>` that flips the active
// tab to Availability so the guest knows where to pick dates.
//
// `property` and `prices` arrive as RSC children (server-rendered);
// `availability` is rendered HERE from the items+slug data so we can
// wire the Calendar's onSelectRange callback into local state.
// ============================================================================

type TabId = 'property' | 'availability' | 'prices';

const TABS: ReadonlyArray<{ id: TabId; label: string; Icon: LucideIcon }> = [
  { id: 'property',     label: 'Property',     Icon: Home },
  { id: 'availability', label: 'Availability', Icon: CalendarDays },
  { id: 'prices',       label: 'Prices',       Icon: Euro },
];

type Range = { start: Date; end: Date };

export function PropertySectionTabs({
  slug,
  calendarItems,
  property,
  prices,
  initial = 'property',
}: {
  slug: string;
  calendarItems: CalendarItem[];
  property: ReactNode;
  prices: ReactNode;
  initial?: TabId;
}) {
  const [active, setActive] = useState<TabId>(initial);
  const [range, setRange] = useState<Range | null>(null);

  // /book URL — only valid when both dates are picked. Used by the
  // Book button on the right of the nav.
  const bookUrl = useMemo(() => {
    if (!range) return null;
    const from = ymd(range.start);
    const to = ymd(range.end);
    return `/book?slug=${encodeURIComponent(slug)}&from=${from}&to=${to}`;
  }, [range, slug]);

  return (
    <section className="mt-8">
      <nav
        role="tablist"
        aria-label="Property sections"
        className="mb-6 flex flex-wrap items-center justify-between gap-3"
      >
        {/* Left cluster — section tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map(({ id, label, Icon }) => {
            const isActive = id === active;
            return (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`panel-${id}`}
                onClick={() => setActive(id)}
                className={
                  'inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-mono uppercase tracking-widest transition-colors ' +
                  (isActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900')
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Right cluster — Book button. Enabled when a date range is
            picked. Disabled state nudges the user to Availability. */}
        <BookButton bookUrl={bookUrl} onPickDates={() => setActive('availability')} />
      </nav>

      {/* Render all three panels, hide inactive via `hidden`. Keeping
          them mounted means the Calendar state survives tab switches. */}
      <div role="tabpanel" id="panel-property" hidden={active !== 'property'}>
        {property}
      </div>
      <div role="tabpanel" id="panel-availability" hidden={active !== 'availability'}>
        <Calendar
          slug={slug}
          items={calendarItems}
          selectedRange={range ? { start: range.start, end: range.end } : undefined}
          onSelectRange={(start, end) => setRange({ start, end })}
          onClearRange={() => setRange(null)}
        />
      </div>
      <div role="tabpanel" id="panel-prices" hidden={active !== 'prices'}>
        {prices}
      </div>
    </section>
  );
}

// ─── Book button ───────────────────────────────────────────────────────────

function BookButton({
  bookUrl,
  onPickDates,
}: {
  bookUrl: string | null;
  onPickDates: () => void;
}) {
  const baseClass =
    'inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-mono uppercase tracking-widest transition-all';

  if (bookUrl) {
    return (
      <Link
        href={bookUrl}
        className={`${baseClass} bg-ocean text-white shadow-md shadow-ocean/20 hover:shadow-xl hover:shadow-ocean/30`}
      >
        <BookOpen className="w-3.5 h-3.5" />
        Book
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onPickDates}
      aria-disabled
      title="Pick your dates to enable"
      className={`${baseClass} bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer`}
    >
      <BookOpen className="w-3.5 h-3.5" />
      Book
    </button>
  );
}
