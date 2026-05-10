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
import type { SelectionUserOption } from '@/components/shared/SelectionActionModal';

export const dynamic = 'force-dynamic';

// max_guests is needed by SelectionActionModal so it can validate party size
// before submitting createAdminBooking.
type PropertyRow = { id: string; slug: string; max_guests: number };

export default async function AdminDashboardPage() {
  const properties = await sql<PropertyRow>(
    `SELECT id::text, slug, max_guests::int FROM properties ORDER BY id`,
  );

  // 6-month forward window — same lens as the per-property strip.
  const { from, to } = windowFor(new Date(), 6);

  const [calendarRows, futureRows, overview, users] = await Promise.all([
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
    // Users are fetched here (not on demand inside the modal) because the
    // list is small and the modal needs them for email autocomplete the
    // moment it opens.
    sql<SelectionUserOption>(
      `SELECT id::text, name, email FROM users ORDER BY name`,
    ),
  ]);

  const itemsBySlug: Record<string, CalendarItem[]> = {};
  for (const row of calendarRows) itemsBySlug[row.slug] = row.items;

  const futureBySlug: Record<string, FuturePropertyData> = {};
  for (const row of futureRows) futureBySlug[row.slug] = row;

  const ganttProperties = properties.map((p) => ({
    id: p.id,
    slug: p.slug,
    label: p.slug,
    max_guests: p.max_guests,
  }));

  return (
    <AdminCalendarView
      properties={ganttProperties}
      itemsBySlug={itemsBySlug}
      futureBySlug={futureBySlug}
      overview={overview}
      users={users}
    />
  );
}
