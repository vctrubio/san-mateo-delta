import { sql } from '@db/client';
import AdminCalendarView from '@/components/admin/AdminCalendarView';
import {
  getCalendarItems,
  windowFor,
  type CalendarItem,
} from '@/lib/calendar';
import { getEstateOverview } from '@/lib/dashboard';
import {
  listProperties,
  listFuturePropertyData,
  type FuturePropertyData,
  type Property,
} from '@/lib/properties';
import type { SelectionUserOption } from '@/components/shared/SelectionActionModal';
import { getActivePaymentPolicy } from '@/lib/systemSettings';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  // Full Property[] (not just id/slug/max_guests) — the per-property card on
  // the dashboard mounts a PropertyEditModal that needs every editable field
  // including rates and features.
  const properties = await listProperties();

  // 6-month forward window — same lens as the per-property strip.
  const { from, to } = windowFor(new Date(), 6);

  const [calendarRows, futureRows, overview, users, activePolicy] = await Promise.all([
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
    // Estate-wide payment policy default; SelectionActionModal's preset
    // picker uses this as the initial selection. Admin can override per
    // booking from the picker; estate-wide changes happen on /admin/payments.
    getActivePaymentPolicy(),
  ]);

  const itemsBySlug: Record<string, CalendarItem[]> = {};
  for (const row of calendarRows) itemsBySlug[row.slug] = row.items;

  const futureBySlug: Record<string, FuturePropertyData> = {};
  for (const row of futureRows) futureBySlug[row.slug] = row;

  // Full property record keyed by slug, for the PropertyEditModal mounted
  // off the Edit pencil on each per-property card.
  const propertyBySlug: Record<string, Property> = {};
  for (const p of properties) propertyBySlug[p.slug] = p;

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
      propertyBySlug={propertyBySlug}
      overview={overview}
      users={users}
      defaultPaymentPolicyKey={activePolicy.key}
    />
  );
}
