import PropertyShowcaseGrid from './PropertyShowcaseGrid';
import { listProperties } from '@/lib/properties';
import { getCalendarItems, windowFor, type CalendarItem } from '@/lib/calendar';

// ============================================================================
// PropertyShowcase — homepage bento section. Server component.
//
// Fetches the public properties AND a 6-month public availability window
// for each, in parallel. The per-property calendar feeds the inline
// `<Calendar>` inside the showcase modal so guests can pick dates without
// leaving the homepage — the modal's "Continue to booking" button then
// links to `/book?slug=…&from=…&to=…`.
// ============================================================================

export default async function PropertyShowcase() {
  const properties = await listProperties({ publicOnly: true });

  // 6-month public window — same shape /book and /finca/[slug] use. Public
  // mode = held bookings + blocks come back unselectable; everything else
  // is invisible to the guest.
  const { from, to } = windowFor(new Date(), 6);
  const calendarsBySlug = Object.fromEntries(
    await Promise.all(
      properties.map(async (p): Promise<[string, CalendarItem[]]> => [
        p.slug,
        await getCalendarItems({ propertyId: p.id, from, to, mode: 'public' }),
      ]),
    ),
  );

  return (
    <section id="homes" className="py-24 px-4 bg-white overflow-hidden scroll-mt-8">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col items-center mb-20 text-center">
          <span className="text-xs font-mono uppercase tracking-[0.3em] text-ocean mb-4">
          300 m from Punta Paloma Beach
          </span>
          <h2 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tighter max-w-2xl text-balance">
            Discover your sanctuary at Finca San Mateo
          </h2>
          <p className="mt-6 text-slate-500 max-w-lg text-lg leading-relaxed">
A coastal haven in the south of Spain, perfect for surf and wind lovers. Surrounded by nature and the Atlantic Ocean.
          </p>
        </div>

        <PropertyShowcaseGrid properties={properties} calendarsBySlug={calendarsBySlug} />
      </div>
    </section>
  );
}
