import { sql } from '@db/client';
import AdminCalendarView from '@/components/admin/AdminCalendarView';
import EstateOverview from '@/components/admin/EstateOverview';
import { getCalendarItems, windowFor, type CalendarItem } from '@/lib/calendar';
import { listFuturePropertyData, type FuturePropertyData } from '@/lib/properties';
import { getEstateOverview } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

type PropertyRow = {
  id: string;
  slug: string;
};

export default async function AdminCalendarPage() {
  const properties = await sql<PropertyRow>(
    `SELECT id::text, slug FROM properties ORDER BY id`,
  );

  // 6-month forward window — enough for the 4-month default Calendar plus
  // some headroom for the 8M / 12M toggles and the gantt's 90-day strip.
  const { from, to } = windowFor(new Date(), 6);

  const [calendarRows, futureRows, overview] = await Promise.all([
    Promise.all(
      properties.map(async (p) => ({
        slug: p.slug,
        items: await getCalendarItems({
          propertyId: p.id,
          from,
          to,
          mode: 'admin',
        }),
      })),
    ),
    listFuturePropertyData(),
    getEstateOverview(),
  ]);

  const itemsBySlug: Record<string, CalendarItem[]> = {};
  for (const row of calendarRows) itemsBySlug[row.slug] = row.items;

  const futureBySlug: Record<string, FuturePropertyData> = {};
  for (const row of futureRows) futureBySlug[row.slug] = row;

  const ganttProperties = properties.map((p) => ({
    id: p.id,
    slug: p.slug,
    label: p.slug,
  }));

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <span className="text-xs font-mono text-ocean uppercase tracking-[0.4em]">
          Admin · all properties
        </span>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mt-1">Calendar</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Scan availability across the whole estate. Click a row in the gantt strip to focus
          a property — its operational stats and full calendar drop in below.
        </p>
      </div>

      <div className="space-y-5">
        <EstateOverview data={overview} />
        <AdminCalendarView
          properties={ganttProperties}
          itemsBySlug={itemsBySlug}
          futureBySlug={futureBySlug}
        />
      </div>
    </div>
  );
}
