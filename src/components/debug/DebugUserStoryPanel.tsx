import {
  BookOpen,
  CheckCircle2,
  Circle,
  FileCode2,
  Layers,
  Wallet,
  Mail,
} from 'lucide-react';

// ============================================================================
// DebugUserStory — surfaces the docs/user-story.md digest on the deployed
// /debug page. Status report for the user-story branch: guest-side booking
// + payment management.
//
// Authoritative content lives in docs/user-story.md. This panel mirrors
// its structure so a teammate can see "what's shipped, what's next" at a
// glance from the live site without opening the repo.
// ============================================================================

export const dynamic = 'force-dynamic';

export default function DebugUserStoryPanel() {
  return (
    <section className="px-6 py-10 border-t border-slate-100 bg-gradient-to-b from-sky-50/30 via-white to-white">
      <div className="max-w-5xl mx-auto">
        <Header />
        <Flow />
        <Shipped />
        <Plan title="Booking story polish" items={STORY_ITEMS} icon={BookOpen} />
        <Plan title="Payment management"   items={PAYMENT_ITEMS} icon={Wallet} />
        <Plan title="Communications · deferred" items={COMMS_ITEMS} icon={Mail} />
        <Files />
        <Footer />
      </div>
    </section>
  );
}

// ============================================================================

function Header() {
  return (
    <div className="mb-6">
      <div className="inline-flex items-center gap-2 mb-2">
        <span className="grid place-items-center w-8 h-8 rounded-xl bg-sky-100 text-ocean">
          <BookOpen className="w-4 h-4" />
        </span>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">DebugUserStory</h2>
        <span className="text-[10px] font-mono text-ocean bg-sky-100 ring-1 ring-sky-200 px-1.5 py-0.5 rounded uppercase tracking-widest">
          branch
        </span>
        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 ring-1 ring-slate-200 px-1.5 py-0.5 rounded uppercase tracking-widest">
          user-story
        </span>
      </div>
      <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
        Where the guest-side journey stands. Landing → property → booking →
        payment → dashboard. Spec lives in{' '}
        <code className="font-mono px-1 rounded bg-slate-100">docs/user-story.md</code>.
      </p>
    </div>
  );
}

function Flow() {
  const steps = [
    { label: '/',                       body: 'HeroLanding + PropertyShowcase. Guest scrolls, clicks a property card.' },
    { label: 'Property modal',          body: 'Two CTAs: Book now (primary, → /finca/[slug]#book) · View full property (secondary).' },
    { label: '/finca/[slug]',           body: 'PropertyView: hero + carousel · characteristics · about · features · sidebar PricingCard (rates + deposit policy) · LocationCard.' },
    { label: 'Click "Book your stay"',  body: 'PricingCard flips to Receipt mode; main column swaps "What\'s included" for the Calendar; guests + identity reveal inline below.' },
    { label: 'Submit',                  body: 'requestBooking → upsert user, insert booking (status=request), revalidate /admin. Then createCheckoutSession(\'deposit\') for 50% via Stripe.' },
    { label: 'Stripe Checkout',         body: 'Hosted page charges 50% deposit. Webhook flips pending → succeeded. Balance (50%) is due 14 days before arrival — manual for now; scheduled charge is a follow-up.' },
    { label: '/user/[id]',              body: 'UserDashboard, grouped by state. Fresh booking shows under Pending host approval.' },
    { label: 'Admin bell · ⌘K',         body: 'getAdminAlerts picks up the new request_awaiting on the next render.' },
  ];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <Layers className="w-3 h-3" /> The flow today
      </h3>
      <ol className="space-y-2 text-[12px]">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-start gap-3">
            <span className="font-mono text-[10px] text-slate-400 w-5 shrink-0 mt-0.5 tabular-nums">{i + 1}</span>
            <span className="font-mono text-[11px] text-ocean shrink-0 w-44">{s.label}</span>
            <span className="text-slate-600 leading-relaxed">{s.body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const SHIPPED = [
  'Two-CTA property modal on / (Book now + View full property)',
  'Persistent /finca banner with shared <Title> from the homepage hero (cream surface + back pill)',
  '/finca/[slug] rebuilt: hero photo + 4-property carousel · characteristics · about · what\'s included · sidebar PricingCard + LocationCard · hosts (souls of San Mateo)',
  'Inline booking flow (no modal): click "Book your stay" → calendar replaces features, guests + identity slide in below, sidebar flips to detailed Receipt with season + 50%/14-day split',
  '50% deposit on booking via Stripe Checkout; balance scheduled 14 days before arrival (manual today, scheduled charge planned)',
];

function Shipped() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Shipped on this branch
      </h3>
      <ul className="space-y-2 text-[12px]">
        {SHIPPED.map((s) => (
          <li key={s} className="flex items-start gap-2.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span className="text-slate-700 leading-relaxed">{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type PlanItem = { title: string; body: string };

const STORY_ITEMS: PlanItem[] = [
  { title: 'Hero CTA on /',                 body: 'A "See the homes ↓" pill under the giant brand mark. The hero is decorative today — no verb for a first-time visitor.' },
  { title: 'Confirmation moment',           body: 'On /user/[id] first paint after submit, show "Request sent — Levante, Mar 5→12. The host responds within 24h."' },
  { title: 'Modal dismiss-on-click',        body: 'Property modal stays mounted while the page transitions. Call setSelected(null) before Link navigation.' },
  { title: '/user privacy',                 body: '"Sign in as anyone" listing emails + spend is fine for demo, uncomfortable for a real walkthrough. Gate behind ?demo=1.' },
  { title: 'Auth → /user resolves',         body: 'Today /user/[id] is reachable by URL-typing. Once auth lands, /user resolves to the logged-in user automatically.' },
];

const PAYMENT_ITEMS: PlanItem[] = [
  { title: 'Pay outstanding from /user/[id]',  body: 'Guests on cash-on-arrival should be able to switch to Stripe later. Reuses createCheckoutSession.' },
  { title: 'Paid / owed breakdown',            body: 'paymentState(b) already returns paid/partial/unpaid/not_applicable. Surface it as a chip in the user dashboard rows.' },
  { title: 'Cancellation UX with refund preview', body: 'computeRefund returns the tier math. Guest-side dialog showing the refund before they confirm.' },
  { title: 'Refund visibility',                body: 'When admin issues a refund, the guest dashboard surfaces "€350 refunded on Apr 12".' },
  { title: 'Stripe webhook audit',             body: 'Confirm pending → succeeded flip is reliable for hosted checkout, abandoned sessions get cleaned up.' },
];

const COMMS_ITEMS: PlanItem[] = [
  { title: 'Booking confirmation email',  body: 'Request sent / confirmed / payment received. booking.access_token already exists for the future accept-link.' },
  { title: 'Status-change notifications', body: 'Triggered off booking_events when admin confirms or cancels.' },
  { title: 'Payment receipts',            body: 'Stripe sends its own; cash needs a manual sender.' },
  { title: 'Cancellation confirmations',  body: 'With the policy outcome inline.' },
];

function Plan({ title, items, icon: Icon }: { title: string; items: PlanItem[]; icon: typeof BookOpen }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <Icon className="w-3 h-3" /> {title}
      </h3>
      <ul className="space-y-3 text-[12px]">
        {items.map((it) => (
          <li key={it.title} className="flex items-start gap-2.5">
            <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">{it.title}</div>
              <div className="text-slate-500 leading-relaxed mt-0.5">{it.body}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Files() {
  const items: Array<[string, string]> = [
    ['docs/user-story.md',                              'Source of truth — what this panel mirrors'],
    ['src/app/finca/layout.tsx',                        'Persistent /finca banner (Title from HeroLanding) + back pill'],
    ['src/app/finca/[slug]/page.tsx',                   'Server shell: fetches all 4 properties + their calendar items'],
    ['src/components/finca/PropertyView.tsx',           'Client: hero + carousel + characteristics + about + features + Calendar + booking form + Pricing/Location sidebar'],
    ['src/components/finca/FincaBackPill.tsx',          'Context-aware back link in the banner (Home ↔ All properties)'],
    ['src/components/landing/Title.tsx',                'Shared SAN MATEO / FINCA / TARIFA typographic stamp (hero + banner)'],
    ['src/components/landing/HostsSpotlight.tsx',       'Shared "Souls of San Mateo" hosts block (landing + property page)'],
    ['src/components/landing/PropertyShowcaseGrid.tsx', 'Two-CTA property modal on the homepage'],
    ['src/components/shared/GuestConfig.tsx',           'Shared adults/children/infants/pets picker'],
    ['src/lib/guests.ts',                               'GuestCounts + DEFAULT_GUESTS + totalGuests + formatGuests'],
    ['src/lib/bookingState.ts',                         'paymentState() — payment-axis derivation'],
    ['src/lib/refund.ts',                               'computeRefund() — cancellation policy math'],
    ['src/actions/bookings.ts',                         'requestBooking, transitionStatus, cancelBooking'],
    ['src/actions/checkout.ts',                         'createCheckoutSession — 50% deposit on booking (DEPOSIT_PCT)'],
  ];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <FileCode2 className="w-3 h-3" /> Files
      </h3>
      <ul className="space-y-1 text-[12px]">
        {items.map(([path, body]) => (
          <li key={path} className="flex items-start gap-3">
            <code className="font-mono text-[11px] text-ocean shrink-0 w-72 truncate">{path}</code>
            <span className="text-slate-600">{body}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer() {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 text-[12px] text-slate-600 leading-relaxed">
      <p>
        Mirror lives in <code className="font-mono px-1 rounded bg-white border border-slate-200">docs/user-story.md</code>.
        Edit there; this panel will catch up on the next deploy. The branch
        is built on top of the admin notifications + search command palette
        that landed on <code className="font-mono px-1 rounded bg-white border border-slate-200">main</code>.
      </p>
    </div>
  );
}
