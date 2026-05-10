import { AlertTriangle } from 'lucide-react';
import BookNowForm from '@/components/finca/BookNowForm';
import UserSignUpForm from '@/components/shared/UserSignUpForm';
import BookingActionButtons from '@/components/admin/BookingActionButtons';
import PaymentActionButtons from '@/components/admin/PaymentActionButtons';
import CancelBookingForm from '@/components/admin/CancelBookingForm';
import PropertyEditForm from '@/components/admin/PropertyEditForm';
import PropertyRateForm from '@/components/admin/PropertyRateForm';
import Calendar from '@/components/calendar/Calendar';
import InviteForm, { type PropertyOption, type UserOption } from '@/components/admin/invite/InviteForm';
import type { Property } from '@/lib/properties';
import type { CalendarItem } from '@/lib/calendar';
import type { BookingStatus } from '@db/enums';

export const metadata = { title: 'Forms · San Mateo' };

// ─────────────────────────────────────────────────────────────────────────────
// Mock data so each form can render without a DB hit. The IDs are intentionally
// fake (`MOCK-…`) so a stray submission would fail loudly rather than silently
// mutate a real row. Forms are also wrapped in <fieldset disabled> below.

const MOCK_PROPERTY: Property = {
  id: 'MOCK-1',
  slug: 'levante',
  title: 'The Villa',
  description: 'Our flagship villa. A masterpiece of coastal architecture featuring expansive living spaces and direct access to the estate gardens.',
  features: ['Fully Equipped Kitchen', 'Master Suite'],
  bedrooms: 3,
  bathrooms: 2,
  m2: 180,
  max_guests: 6,
  cleaning_fee_cents: 12000,
  rates: {
    1: 35000, 2: 35000, 3: 35000, 4: 35000, 5: 35000,
    6: 48000, 7: 48000, 8: 48000,
    9: 35000, 10: 35000, 11: 35000, 12: 35000,
  },
};

const ACTION_STATES: BookingStatus[] = ['request', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];

// Mock items for the Calendar showcase. Dates are anchored relative to a fixed
// "demo today" so the rendered output is deterministic on the page (the real
// calendar component still renders past days as past at runtime).
function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
const Y = new Date().getFullYear();
const NEXT_MONTH = ((new Date().getMonth() + 1) % 12) + 1;
const M2 = ((NEXT_MONTH) % 12) + 1;
const MOCK_SLUG = 'levante';
const MOCK_CALENDAR_ITEMS: CalendarItem[] = [
  // a confirmed booking next month
  { kind: 'booking', id: 'MOCK-B1', status: 'confirmed', start: ymd(Y, NEXT_MONTH, 5),  end: ymd(Y, NEXT_MONTH, 12),
    label: 'Maria · levante', property_slug: MOCK_SLUG,
    user_id: 'MOCK-U1', user_name: 'Maria',  user_email: 'maria@example.com',
    agreed_property_cents: 245000, agreed_cleaning_cents: 12000, agreed_total_cents: 257000, paid_cents: 0,
    guests: { adults: 4, children: 2, infants: 0, pets: 0 }, href: '/admin/bookings/MOCK-B1' },
  // a checked-in booking now
  { kind: 'booking', id: 'MOCK-B2', status: 'checked_in', start: ymd(Y, NEXT_MONTH, 18), end: ymd(Y, NEXT_MONTH, 22),
    label: 'Tom · levante', property_slug: MOCK_SLUG,
    user_id: 'MOCK-U2', user_name: 'Tom', user_email: 'tom@example.com',
    agreed_property_cents: 140000, agreed_cleaning_cents: 12000, agreed_total_cents: 152000, paid_cents: 152000,
    guests: { adults: 2, children: 0, infants: 0, pets: 1 } },
  // a request (admin sees, public ignores)
  { kind: 'booking', id: 'MOCK-B3', status: 'request',  start: ymd(Y, M2, 8),  end: ymd(Y, M2, 11),
    label: 'Carla · levante', property_slug: MOCK_SLUG,
    user_id: 'MOCK-U3', user_name: 'Carla', user_email: 'carla@example.com',
    agreed_property_cents: 105000, agreed_cleaning_cents: 12000, agreed_total_cents: 117000, paid_cents: 0,
    guests: { adults: 2, children: 0, infants: 0, pets: 0 } },
  // a cancelled booking (admin sees faded, public ignores)
  { kind: 'booking', id: 'MOCK-B4', status: 'cancelled', start: ymd(Y, M2, 24), end: ymd(Y, M2, 27),
    label: 'Past guest · levante', property_slug: MOCK_SLUG,
    user_id: null, user_name: null, user_email: null,
    agreed_property_cents: 105000, agreed_cleaning_cents: 12000, agreed_total_cents: 117000, paid_cents: 0,
    guests: { adults: 2, children: 0, infants: 0, pets: 0 } },
  // a property block
  { kind: 'block', id: 'MOCK-PB1', start: ymd(Y, M2, 1), end: ymd(Y, M2, 6), reason: 'Owner family stay', property_slug: MOCK_SLUG },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function FormsPreviewPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <Header />
        <div className="space-y-8 mt-8">
          <Section
            title="Calendar · public mode (2 months)"
            file="src/components/calendar/Calendar.tsx"
            usedOn="/finca/[slug] (inside BookNowForm)"
            note="Two-click date range selection. Held bookings + property blocks render as unavailable (hatched / colored). Cancelled / request / invite bookings are invisible to the public. Selection drives the parent form's hidden date inputs."
          >
            <Calendar monthsDefault={2} items={MOCK_CALENDAR_ITEMS} />
          </Section>

          <Section
            title="Calendar · admin mode (4 months default, toggle 4/8/12)"
            file="src/components/calendar/Calendar.tsx"
            usedOn="/admin/properties/[slug]"
            note="Every booking colored by status. Click an empty range to auto-open SelectionActionModal (chooser → block dates OR create new booking). Click a booking to open BookingActionModal — same modal kit, with inline status actions and a register-cash-payment section when there's an outstanding balance. Click a block to remove it."
          >
            <Calendar admin slug={MOCK_PROPERTY.slug} monthsDefault={4} items={MOCK_CALENDAR_ITEMS} />
          </Section>

          <Section
            title="BookNowForm"
            file="src/components/finca/BookNowForm.tsx"
            usedOn="/finca/[slug]"
            note="Guest-facing booking request. Embeds the public calendar (replaces the old date inputs), shows a live quote on selection, then collects guest info. Submits requestBooking → upserts user + creates booking → redirects to /user/[id]."
          >
            <BookNowForm slug={MOCK_PROPERTY.slug} maxGuests={MOCK_PROPERTY.max_guests} items={MOCK_CALENDAR_ITEMS} />
          </Section>

          <Section
            title="UserSignUpForm · variant=card"
            file="src/components/shared/UserSignUpForm.tsx"
            usedOn="/admin, /admin/users, /user"
            note="Sign-up form. Creates a user row and redirects to /user/[id]. Two visual variants — card and inline."
          >
            <UserSignUpForm variant="card" />
          </Section>

          <Section
            title="UserSignUpForm · variant=inline"
            file="src/components/shared/UserSignUpForm.tsx"
            note="Same component, denser styling for embedding in tighter contexts."
          >
            <UserSignUpForm variant="inline" />
          </Section>

          <Section
            title="BookingActionButtons · all states"
            file="src/components/admin/BookingActionButtons.tsx"
            usedOn="/admin/bookings (per row), /admin/bookings/[id]"
            note="One-click status transitions. Each row shows only the buttons valid for that booking's current status (state-machine guarded server-side too)."
          >
            <div className="space-y-2">
              {ACTION_STATES.map((s) => (
                <div key={s} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white border border-slate-100">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 min-w-[100px]">{s}</span>
                  <BookingActionButtons bookingId="MOCK-1" currentStatus={s} size="sm" />
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="PaymentActionButtons · payment scenarios"
            file="src/components/admin/PaymentActionButtons.tsx"
            usedOn="/admin/bookings/[id], /user/[id]"
            note="Pay-deposit / Pay-full / Pay-balance. Buttons appear depending on what's been paid already. Cancelled and fully-paid bookings show terminal labels."
          >
            <div className="space-y-2">
              {[
                { label: 'Confirmed, nothing paid', paid: 0,    agreed: 257000, status: 'confirmed' as BookingStatus },
                { label: 'Confirmed, deposit paid', paid: 77100, agreed: 257000, status: 'confirmed' as BookingStatus },
                { label: 'Confirmed, fully paid',   paid: 257000, agreed: 257000, status: 'confirmed' as BookingStatus },
                { label: 'Cancelled',               paid: 0,    agreed: 257000, status: 'cancelled' as BookingStatus },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white border border-slate-100">
                  <span className="text-[11px] text-slate-500 min-w-[200px]">{row.label}</span>
                  <PaymentActionButtons
                    bookingId="MOCK-1"
                    agreedCents={row.agreed}
                    paidCents={row.paid}
                    status={row.status}
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="CancelBookingForm · admin variant"
            file="src/components/admin/CancelBookingForm.tsx"
            usedOn="/admin/bookings/[id]"
            note="Cancellation initiated by admin. Records the booking_cancellations row with cancelled_by='admin'. Refund amount computed by the policy in docs/refund.md."
          >
            <CancelBookingForm bookingId="MOCK-1" status="confirmed" cancelledBy="admin" />
          </Section>

          <Section
            title="CancelBookingForm · guest variant"
            file="src/components/admin/CancelBookingForm.tsx"
            usedOn="/user/[id]"
            note="Same component, but cancelled_by='guest'. Used inline on each non-terminal booking in the user dashboard."
          >
            <CancelBookingForm bookingId="MOCK-1" status="confirmed" cancelledBy="guest" />
          </Section>

          <Section
            title="PropertyEditForm"
            file="src/components/admin/PropertyEditForm.tsx"
            usedOn="/admin/properties/[slug]"
            note="Edit title / description / features / characteristics / cleaning fee. Cleaning fee is the default for new bookings; existing bookings keep their snapshotted value."
          >
            <PropertyEditForm property={MOCK_PROPERTY} />
          </Section>

          <Section
            title="PropertyRateForm · 12-month grid"
            file="src/components/admin/PropertyRateForm.tsx"
            usedOn="/admin/properties/[slug]"
            note="One €/night value per calendar month. Two presets — flat rate, low/high split (Jun-Aug = high). Submits updatePropertyRates which writes the JSONB column. CHECK constraint enforces all 12 keys present. See docs/rates.md."
          >
            <PropertyRateForm slug={MOCK_PROPERTY.slug} rates={MOCK_PROPERTY.rates} />
          </Section>

          <Section
            title="InviteForm · admin-priced bookings for friends"
            file="src/components/admin/invite/InviteForm.tsx"
            usedOn="/admin/invite/new"
            note="Admin picks a property, dates, an existing or new guest, and overrides the property + cleaning fees. The form previews what the rate engine would have charged so the diff vs default shows whether this is a discount or a premium. Submits createInvitation → both bookings + booking_invitations rows in one tx."
          >
            <InviteForm
              properties={MOCK_INVITE_PROPERTIES}
              users={MOCK_INVITE_USERS}
              calendarsBySlug={{ [MOCK_PROPERTY.slug]: MOCK_CALENDAR_ITEMS }}
            />
          </Section>
        </div>
      </div>
    </main>
  );
}

const MOCK_INVITE_PROPERTIES: PropertyOption[] = [
  { id: 'MOCK-P1', slug: 'levante',  title: 'The Villa',     cleaning_fee_cents: 12000, max_guests: 6 },
  { id: 'MOCK-P2', slug: 'estrecho', title: 'The Residence', cleaning_fee_cents:  9000, max_guests: 4 },
  { id: 'MOCK-P3', slug: 'marea',    title: 'The Retreat',   cleaning_fee_cents:  6000, max_guests: 2 },
  { id: 'MOCK-P4', slug: 'cala',     title: 'The Bungalow',  cleaning_fee_cents:  5000, max_guests: 2 },
];

const MOCK_INVITE_USERS: UserOption[] = [
  { id: 'MOCK-U1', name: 'Maria Garcia',  email: 'maria@example.com' },
  { id: 'MOCK-U2', name: 'Tom Johnson',   email: 'tom@example.com' },
  { id: 'MOCK-U3', name: 'Lukas Müller',  email: 'lukas@example.com' },
];

// ─────────────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Forms preview</h1>
      <p className="text-sm text-slate-500 mt-1 max-w-3xl">
        Catalog of every form in the app, rendered with mock data so you can iterate on styling
        in one place. Each section cites the component file and where it&apos;s used in the real app.
      </p>
      <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-[12px] text-amber-900 leading-relaxed">
          Forms are wrapped in <code className="font-mono px-1 rounded bg-amber-100">&lt;fieldset disabled&gt;</code>{' '}
          so submissions don&apos;t fire while you&apos;re styling. The mock IDs (e.g. <code className="font-mono">MOCK-1</code>)
          would also fail loudly in the action layer if a submission did get through. To exercise
          a form for real, use it on its actual route.
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  file,
  usedOn,
  note,
  children,
}: {
  title: string;
  file: string;
  usedOn?: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white border border-slate-100">
      <header className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <code className="text-[10px] font-mono text-slate-400">{file}</code>
        </div>
        {usedOn && (
          <div className="text-[10px] font-mono text-ocean uppercase tracking-widest mt-1">
            used on · {usedOn}
          </div>
        )}
        <p className="text-[12px] text-slate-500 leading-relaxed mt-2 max-w-3xl">{note}</p>
      </header>
      <fieldset disabled className="p-5 [&_*]:cursor-default">
        {children}
      </fieldset>
    </section>
  );
}
