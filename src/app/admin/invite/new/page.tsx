import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import { sql } from '@db/client';
import { getCalendarItems, windowFor } from '@/lib/calendar';
import InviteForm, {
  type PropertyOption,
  type UserOption,
} from '@/components/admin/invite/InviteForm';
import type { CalendarItem } from '@/lib/calendar';

export const dynamic = 'force-dynamic';

export default async function NewInvitationPage() {
  // Fetch all properties + recent users, plus calendar items per property for
  // the next 6 months so InviteForm can swap views client-side without round-
  // trips. The estate has 4 properties so this is bounded and cheap.
  const properties = await sql<PropertyOption>(
    `SELECT id::text, slug, title,
            cleaning_fee_cents::int AS cleaning_fee_cents,
            max_guests::int         AS max_guests
       FROM properties ORDER BY id`,
  );

  const users = await sql<UserOption>(
    `SELECT id::text, name, email
       FROM users
      ORDER BY created_at DESC
      LIMIT 200`,
  );

  // Pre-fetch calendar items for every property (6-month forward window).
  const { from, to } = windowFor(new Date(), 6);
  const calendarsBySlug: Record<string, CalendarItem[]> = {};
  await Promise.all(
    properties.map(async (p) => {
      calendarsBySlug[p.slug] = await getCalendarItems({
        propertyId: p.id,
        from, to,
        mode: 'admin',
      });
    }),
  );

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/invite"
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-ocean mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> back to invitations
      </Link>

      <div className="flex items-center gap-2 mb-2">
        <span className="grid place-items-center w-8 h-8 rounded-xl bg-violet-100 text-violet-700">
          <Mail className="w-4 h-4" />
        </span>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">New invitation</h1>
      </div>
      <p className="text-sm text-slate-500 mb-8 max-w-2xl">
        Pick a property and dates, choose an existing guest or invite a new email,
        then override the property fee and cleaning fee. The form previews the
        default rate alongside so you can see exactly how much the discount (or
        premium) costs.
      </p>

      <div className="rounded-3xl bg-white border border-slate-100 p-6">
        <InviteForm properties={properties} users={users} calendarsBySlug={calendarsBySlug} />
      </div>
    </div>
  );
}
