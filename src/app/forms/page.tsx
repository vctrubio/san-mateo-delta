import { AlertTriangle } from 'lucide-react';
import BookNowForm from '@/components/finca/BookNowForm';
import UserSignUpForm from '@/components/shared/UserSignUpForm';
import BookingActionButtons from '@/components/admin/BookingActionButtons';
import PaymentActionButtons from '@/components/admin/PaymentActionButtons';
import CancelBookingForm from '@/components/admin/CancelBookingForm';
import PropertyEditForm from '@/components/admin/PropertyEditForm';
import RatesAdmin from '@/components/admin/RatesAdmin';
import type { Property, PropertyRate } from '@/lib/properties';
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
};

const MOCK_RATES: PropertyRate[] = [
  { id: 'MOCK-R1', name: 'Low Season',  active: true,  public: true,  min_nights: 2,  months: [1,2,3,4,5,9,10,11,12], night_rate_cents: 35000 },
  { id: 'MOCK-R2', name: 'High Season', active: true,  public: true,  min_nights: 2,  months: [6,7,8],                 night_rate_cents: 48000 },
  { id: 'MOCK-R3', name: 'Long-Stay',   active: false, public: false, min_nights: 15, months: [1,2,3,4,5,9,10,11,12], night_rate_cents: 28000 },
];

const ACTION_STATES: BookingStatus[] = ['request', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];

// ─────────────────────────────────────────────────────────────────────────────

export default function FormsPreviewPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <Header />
        <div className="space-y-8 mt-8">
          <Section
            title="BookNowForm"
            file="src/components/finca/BookNowForm.tsx"
            usedOn="/finca/[slug]"
            note="Guest-facing booking request. Collects dates + guests + identity. Submits requestBooking → upserts user + creates booking → redirects to /user/[id]."
          >
            <BookNowForm slug={MOCK_PROPERTY.slug} maxGuests={MOCK_PROPERTY.max_guests} />
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
            note="Cancellation initiated by admin. Records the booking_cancellations row with cancelled_by='admin'. Refund amount computed by the policy in db/refund.md."
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
            title="RatesAdmin · existing rates + new rate"
            file="src/components/admin/RatesAdmin.tsx"
            usedOn="/admin/properties/[slug]"
            note="One form per rate row. Months are 12 checkboxes. The last form (dashed border) is for adding a new rate. See db/rates.md for the selection algorithm."
          >
            <RatesAdmin slug={MOCK_PROPERTY.slug} rates={MOCK_RATES} />
          </Section>
        </div>
      </div>
    </main>
  );
}

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
