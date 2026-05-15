'use client';

import { useState, type ReactNode } from 'react';
import { Home, CalendarDays, Euro, type LucideIcon } from 'lucide-react';

// ============================================================================
// PropertySectionTabs — client tab switcher beneath the
// PropertyNavigationGallery on /finca/[slug]. Owns active-tab state only;
// view contents arrive as RSC children so each can keep fetching its own
// server data.
//
// Visual: rounded-2xl cards matching the photo tile shape above — the
// tabs read as a continuation of the gallery, not a separate UI strip.
// No section divider; spacing alone carries the rhythm. Each tab is
// icon + label so a glance scans faster than reading three words.
//
// Active state is the quiet dark slate-900, not the loud ocean fill we
// use elsewhere for navigation accents. The page already has its loud
// brand moments (the FincaLead title, the eyebrow); here we want the
// switcher to disappear into the page.
// ============================================================================

type TabId = 'property' | 'availability' | 'prices';

const TABS: ReadonlyArray<{ id: TabId; label: string; Icon: LucideIcon }> = [
  { id: 'property',     label: 'Property',     Icon: Home },
  { id: 'availability', label: 'Availability', Icon: CalendarDays },
  { id: 'prices',       label: 'Prices',       Icon: Euro },
];

export function PropertySectionTabs({
  property,
  availability,
  prices,
  initial = 'property',
}: {
  property: ReactNode;
  availability: ReactNode;
  prices: ReactNode;
  initial?: TabId;
}) {
  const [active, setActive] = useState<TabId>(initial);

  return (
    <section className="mt-8">
      <nav
        role="tablist"
        aria-label="Property sections"
        className="mb-6 flex flex-wrap gap-2"
      >
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
      </nav>

      {/* Render all three children, hide inactive via `hidden`. Keeping
          them mounted means the Calendar in Availability doesn't reset
          its month-window state when the user clicks back to Property.
          The tradeoff is a slightly larger initial DOM; acceptable here. */}
      <div role="tabpanel" id="panel-property" hidden={active !== 'property'}>
        {property}
      </div>
      <div role="tabpanel" id="panel-availability" hidden={active !== 'availability'}>
        {availability}
      </div>
      <div role="tabpanel" id="panel-prices" hidden={active !== 'prices'}>
        {prices}
      </div>
    </section>
  );
}
