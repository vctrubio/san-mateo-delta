import { sql } from '@db/client';
import AdminCalendarView from '@/components/admin/AdminCalendarView';
import {
  getCalendarItems,
  windowFor,
  type CalendarItem,
} from '@/lib/calendar';
import { getEstateOverview } from '@/lib/dashboard';
import {
  listFuturePropertyData,
  type FuturePropertyData,
} from '@/lib/properties';

export const dynamic = 'force-dynamic';

type PropertyRow = { id: string; slug: string };

export default async function AdminDashboardPage() {
  const properties = await sql<PropertyRow>(
    `SELECT id::text, slug FROM properties ORDER BY id`,
  );

  // 6-month forward window — same lens as the per-property strip.
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
    <AdminCalendarView
      properties={ganttProperties}
      itemsBySlug={itemsBySlug}
      futureBySlug={futureBySlug}
      overview={overview}
    />
  );
}
