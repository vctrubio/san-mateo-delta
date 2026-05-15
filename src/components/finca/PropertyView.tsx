'use client';

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BedDouble, Bath, Maximize, Users as UsersIcon, Check,
  Sparkles,
  MapPin, Moon, Loader2, XCircle,
  CreditCard, ChevronRight, Sun, Snowflake, User as UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { iconByName } from '@/lib/amenityIcons';
import { eur } from '@/lib/format';
import type { Property, RatesByMonth } from '@/lib/properties';
import type { CalendarItem } from '@/lib/calendar';
import type { Quote } from '@/lib/bookings';
import { HIGH_SEASON_MONTHS, type Month } from '@db/enums';
import Calendar from '@/components/calendar/Calendar';
import { ymd } from '@/components/calendar/dateUtils';
import GuestConfig from '@/components/shared/GuestConfig';
import { DEFAULT_GUESTS, totalGuests, type GuestCounts } from '@/lib/guests';
import { previewQuote, requestBooking } from '@/actions/bookings';
import { createCheckoutSession } from '@/actions/checkout';
import {
  resolvePolicy,
  computeDepositCents,
  chargesCardAtBooking,
  describePolicy,
  type PaymentPolicy,
} from '@/lib/payment';
import { todayYmd } from '@/lib/dates';
import fincaData from '@config/finca.json';
import travel from '@config/travel.json';
import { HostsSpotlight } from '@/components/landing/HostsSpotlight';

// ============================================================================
// PropertyView — beta-style property page.
//
//   1. Hero photo with name + per-night price overlay.
//   2. Stats row (sleeps · beds · baths · m²).
//   3. Two-column body:
//        Main:    About + What's included + Calendar (+ booking form when active)
//        Sidebar: Pricing card (browse → receipt) + Location card  (sticky)
//
// State lives here: range, started (booking active?), guests, identity,
// error, isPending. The Pricing card on the right is the booking control
// surface — clicking "Book your stay" flips `started`, the card transforms
// into a receipt with line-item breakdown, and the main column reveals
// guest + identity + submit inline below the Calendar.
//
// Payment terms are driven by the estate-wide active policy passed in via
// the `activePolicy` prop (read from `system_settings.active_payment_policy_key`
// in the server page). Once dates are picked, we resolve the policy against
// the selected check-in date — too-close split policies collapse to 100%
// upfront and surface a plain-English explanation in the receipt. The
// resolved policy is what the submit path acts on (Stripe Checkout for
// card flows; direct insert + redirect for cash / 0% policies). See
// src/lib/payment.ts and docs/payment.md.
// ============================================================================

function displayName(slug: string) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export default function PropertyView({
  properties,
  initialSlug,
  itemsBySlug,
  activePolicy,
}: {
  properties: Property[];
  initialSlug: string;
  itemsBySlug: Record<string, CalendarItem[]>;
  /** Estate-wide active payment policy at page-load time. Resolved against
   *  the guest's selected dates once they pick a range. */
  activePolicy: PaymentPolicy;
}) {
  // URL slug only seeds the initial pick — the carousel switches between
  // properties client-side so the hero / stats / receipt animate without
  // a full nav.
  const [selectedSlug, setSelectedSlug] = useState(initialSlug);
  const selected = properties.find((p) => p.slug === selectedSlug) ?? properties[0];
  const items = itemsBySlug[selected.slug] ?? [];

  // Booking state lives at this level so the Pricing sidebar and the
  // Calendar / booking form in the main column stay in sync.
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [started, setStarted] = useState(false);
  const [guests, setGuests] = useState<GuestCounts>(DEFAULT_GUESTS);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tif, setTif] = useState('');
  const [nationality, setNationality] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!range) { setQuote(null); setQuoteError(null); return; }
    let cancelled = false;
    setIsQuoting(true);
    setQuoteError(null);
    previewQuote({
      slug: selected.slug,
      check_in:  ymd(range.start),
      check_out: ymd(range.end),
    }).then((r) => {
      if (cancelled) return;
      setIsQuoting(false);
      if (r.ok) setQuote(r.quote);
      else { setQuote(null); setQuoteError(r.error); }
    });
    return () => { cancelled = true; };
  }, [selected.slug, range?.start.getTime(), range?.end.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clearing the calendar folds the booking flow back closed.
  useEffect(() => {
    if (!range) setStarted(false);
  }, [range]);

  // Switching property in the carousel resets the in-flight booking —
  // dates and the started flag for LEVANTE shouldn't carry over to ESTRECHO.
  useEffect(() => {
    setRange(null);
    setStarted(false);
  }, [selectedSlug]);

  // Land with `#book` hash (homepage "Book now" CTA) → auto-open the flow
  // and scroll the calendar into view. Without this the user clicks Book
  // and arrives at a page where the booking form is still collapsed.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#book') return;
    setStarted(true);
    requestAnimationFrame(() => {
      document.getElementById('book')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const datesReady = !!range && !!quote && !quoteError && !isQuoting;
  const guestsValid = totalGuests(guests) >= 1 && totalGuests(guests) <= selected.max_guests;
  const identityValid =
    name.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = datesReady && guestsValid && identityValid;

  // Resolve the active estate policy against the picked check-in date.
  // Without a range we still resolve against today + 60 days so the
  // sidebar can describe the policy generically — collapse only fires
  // when there's a real range to evaluate.
  const resolvedPolicy = range
    ? resolvePolicy(activePolicy, ymd(range.start), todayYmd())
    : { effective: activePolicy, requested: activePolicy, collapsed: false } as const;
  const willChargeCard = chargesCardAtBooking(resolvedPolicy.effective);
  const depositCents = quote
    ? computeDepositCents(quote.agreed_total_cents, resolvedPolicy.effective)
    : 0;

  function submit() {
    if (!range || !quote) return;
    setError(null);
    const fd = new FormData();
    fd.set('slug', selected.slug);
    fd.set('check_in',  ymd(range.start));
    fd.set('check_out', ymd(range.end));
    fd.set('name',  name.trim());
    fd.set('email', email.trim());
    if (tif)         fd.set('tif', tif.trim());
    if (nationality) fd.set('nationality', nationality.trim());
    if (dobDay && dobMonth && dobYear) {
      const dd = dobDay.padStart(2, '0');
      const mm = dobMonth.padStart(2, '0');
      fd.set('dob', `${dobYear}-${mm}-${dd}`);
    }
    fd.set('adults',   String(guests.adults));
    fd.set('children', String(guests.children));
    fd.set('infants',  String(guests.infants));
    fd.set('pets',     String(guests.pets));

    startTransition(async () => {
      const result = await requestBooking(fd);
      if (!result.ok) { setError(result.error); return; }

      // If the resolved policy is cash or 0% upfront, skip Stripe entirely —
      // the booking is recorded and admin will collect on arrival. Otherwise
      // open Stripe Checkout for the deposit (or full payment when the
      // policy is 100% upfront).
      if (!willChargeCard) {
        window.location.href = `/user/${result.userId}?just_booked=${result.bookingId}`;
        return;
      }
      const checkout = await createCheckoutSession(result.bookingId, 'deposit');
      if (!checkout.ok) {
        setError(`Booking saved (#${result.bookingId}), but Stripe checkout failed: ${checkout.error}.`);
        window.location.href = `/user/${result.userId}?just_booked=${result.bookingId}`;
        return;
      }
      window.location.href = checkout.url;
    });
  }

  return (
    <article className="space-y-6">
      {/* Hero on the left, property carousel on the right — lets the
          guest swap between homes without leaving the page. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
        <Hero property={selected} />
        <PropertyCarousel
          properties={properties}
          selectedSlug={selectedSlug}
          onSelect={setSelectedSlug}
        />
      </div>

      <StatsRow property={selected} />

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr] gap-5">
        {/* MAIN */}
        <div className="space-y-5">
          <AboutCard description={selected.description} />

          {/* FUTURE — auth-aware banner:
              When auth is wired, if the logged-in user already has an
              upcoming booking for this property, render it as a card here
              ("Your stay: May 19 → 26, 5 nights · view details") so they
              don't re-book the same property by mistake. Stub component:
              <UserUpcomingForProperty propertySlug={selected.slug} /> */}

          {/* "What's included" while browsing → Calendar once the user
              starts booking. Cross-fade keeps the main column anchored
              instead of growing/shrinking abruptly. */}
          <AnimatePresence mode="wait" initial={false}>
            {!started ? (
              <motion.div
                key="features"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="space-y-5"
              >
                <WhatYouGet features={selected.features} amenities={fincaData.amenities} />
                {/* Hosts fill the space below "What's included" while the
                    booking flow is closed. Shared component with the
                    landing page so the brand voice stays consistent. */}
                <HostsSpotlight />
              </motion.div>
            ) : (
              <motion.div
                key="calendar"
                id="book"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                style={{ scrollMarginTop: '5rem' }}
              >
                {/* Calendar carries its own card chrome (header + footer)
                    so we render it bare — no outer wrapper. */}
                <Calendar
                  items={items}
                  monthsDefault={2}
                  selectedRange={range ?? undefined}
                  onSelectRange={(start, end) => setRange({ start, end })}
                  onClearRange={() => setRange(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {started && (
              <motion.div
                key="booking-form"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="space-y-5"
              >
                <GuestsCard guests={guests} setGuests={setGuests} maxGuests={selected.max_guests} />
                <IdentityCard
                  name={name} setName={setName}
                  email={email} setEmail={setEmail}
                  tif={tif} setTif={setTif}
                  nationality={nationality} setNationality={setNationality}
                  dobDay={dobDay}   setDobDay={setDobDay}
                  dobMonth={dobMonth} setDobMonth={setDobMonth}
                  dobYear={dobYear}  setDobYear={setDobYear}
                />

                {error && (
                  <div className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-900">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit || isPending}
                  className="group w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-slate-900 text-white text-xs md:text-sm font-mono uppercase tracking-[0.3em] font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isPending
                    ? 'Submitting…'
                    : !datesReady
                      ? 'Pick dates above'
                      : !guestsValid
                        ? `Max ${selected.max_guests} guests`
                        : !identityValid
                          ? 'Add your name & email'
                          : !willChargeCard
                            ? (
                              <>
                                <ChevronRight className="w-4 h-4" />
                                Reserve · pay on arrival
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                              </>
                            )
                            : resolvedPolicy.effective.deposit_pct === 100
                              ? (
                                <>
                                  <CreditCard className="w-4 h-4" />
                                  Pay {eur(depositCents)} · full payment
                                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                              )
                              : (
                                <>
                                  <CreditCard className="w-4 h-4" />
                                  Pay {eur(depositCents)} deposit
                                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                              )}
                </button>
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest text-center">
                  {willChargeCard
                    ? 'Pay securely on Stripe. Test card 4242 4242 4242 4242.'
                    : 'No card collected at booking. The host will collect on arrival.'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-4 lg:sticky lg:top-6 self-start">
          <PricingCard
            rates={selected.rates}
            cleaningFeeCents={selected.cleaning_fee_cents}
            quote={quote}
            range={range}
            isQuoting={isQuoting}
            quoteError={quoteError}
            started={started}
            resolvedPolicy={resolvedPolicy}
            depositCents={depositCents}
            onBook={() => setStarted(true)}
            onCancel={() => {
              // Close — wipe the whole in-flight booking back to a fresh
              // state so reopening doesn't carry over old dates / guests
              // / form fields.
              setRange(null);
              setStarted(false);
              setGuests(DEFAULT_GUESTS);
              setName('');
              setEmail('');
              setTif('');
              setNationality('');
              setDobDay('');
              setDobMonth('');
              setDobYear('');
              setError(null);
            }}
          />
          <LocationCard />
        </aside>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero — property photo (full bleed) with name on the bottom-left and
// per-night price on the bottom-right. Matches the beta hero composition.

function Hero({ property }: { property: Property }) {
  return (
    <div className="relative h-[42vh] min-h-[280px] lg:h-auto lg:min-h-0 lg:aspect-auto rounded-3xl overflow-hidden bg-slate-100">
      {/* Image fades when the carousel switches property. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={property.slug}
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          <Image
            src={`/images/${property.slug}.png`}
            alt={displayName(property.slug)}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 60vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/65" />
        </motion.div>
      </AnimatePresence>

      {/* Overlay copy — separate motion key so it cross-fades cleanly.
          Price is intentionally NOT here — the sidebar Pricing card is the
          single source of truth for rates. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${property.slug}-copy`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="absolute inset-0 px-6 pb-6 md:pb-8 flex items-end text-white"
        >
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/75 mb-2">
              {property.title}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-tighter leading-none">
              {displayName(property.slug)}
            </h1>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PropertyCarousel — vertical column on desktop (right of the hero),
// horizontal scroll on mobile. Click a thumbnail → switch property
// in-place. The selected one gets a slate-900 ring; the rest dim until
// hover.

function PropertyCarousel({
  properties,
  selectedSlug,
  onSelect,
}: {
  properties: Property[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <div
      className="
        flex flex-row lg:flex-col gap-2 lg:gap-3
        overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto
        lg:max-h-[calc(42vh+0px)]
        snap-x snap-mandatory lg:snap-none
        -mx-1 px-1
      "
    >
      {properties.map((p) => {
        const isActive = p.slug === selectedSlug;
        return (
          <button
            key={p.slug}
            type="button"
            onClick={() => onSelect(p.slug)}
            aria-pressed={isActive}
            className={[
              'relative shrink-0 snap-start',
              'w-40 lg:w-full',
              'h-24 lg:h-[calc(((42vh-32px)/4))]',
              'lg:min-h-[88px]',
              'rounded-2xl overflow-hidden group',
              'transition-all duration-300',
              isActive
                ? 'ring-2 ring-slate-900 shadow-md'
                : 'opacity-65 hover:opacity-100 ring-1 ring-slate-200',
            ].join(' ')}
          >
            <Image
              src={`/images/${p.slug}.png`}
              alt={displayName(p.slug)}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 160px, 240px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-2 left-3 right-3 text-white text-left">
              <p className="text-[8px] font-mono uppercase tracking-widest text-white/70 truncate">
                {p.title}
              </p>
              <p className="text-sm font-bold uppercase tracking-tight leading-tight">
                {displayName(p.slug)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatsRow — four pill cards in a row (sleeps · beds · baths · m²).

function StatsRow({ property }: { property: Property }) {
  const stats: Array<{ icon: LucideIcon; label: string }> = [
    { icon: UsersIcon, label: `Sleeps ${property.max_guests}` },
    { icon: BedDouble, label: `${property.bedrooms} bedroom${property.bedrooms === 1 ? '' : 's'}` },
    { icon: Bath,      label: `${property.bathrooms} bathroom${property.bathrooms === 1 ? '' : 's'}` },
    { icon: Maximize,  label: `${property.m2} m²` },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <Icon className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-sm font-semibold text-slate-700">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable card shell — `rounded-2xl bg-white border + eyebrow header`.

function Card({
  eyebrow,
  icon: Icon,
  children,
  hint,
}: {
  eyebrow: string;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6 md:p-7">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400 inline-flex items-center gap-1.5">
          {Icon && <Icon className="w-3 h-3" />}
          {eyebrow}
        </p>
        {hint && (
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-300">
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function AboutCard({ description }: { description: string }) {
  return (
    <Card eyebrow="About this stay" icon={Sparkles}>
      <p className="text-slate-700 leading-relaxed">{description}</p>
    </Card>
  );
}

type AmenityEntry = { name: string; icon: string };

function WhatYouGet({ features, amenities }: { features: string[]; amenities: readonly AmenityEntry[] }) {
  return (
    <Card eyebrow="What's included" icon={Check}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <FeatureSub title="This property" subtitle="Unique to this unit" items={features} />
        <AmenitySub title={`Every ${fincaData.name} stay`} subtitle="Estate-wide" items={amenities} />
      </div>
    </Card>
  );
}

function SubHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-slate-400">{subtitle}</p>
      <h3 className="text-sm font-bold text-slate-900 mt-0.5">{title}</h3>
    </div>
  );
}

function FeatureSub({ title, subtitle, items }: { title: string; subtitle: string; items: string[] }) {
  return (
    <div>
      <SubHeader title={title} subtitle={subtitle} />
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 italic">None listed.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-slate-700">
              <Check className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AmenitySub({
  title, subtitle, items,
}: {
  title: string;
  subtitle: string;
  items: readonly AmenityEntry[];
}) {
  return (
    <div>
      <SubHeader title={title} subtitle={subtitle} />
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 italic">None listed.</p>
      ) : (
        <ul className="space-y-2">
          {items.map(({ name, icon }) => {
            const Icon = iconByName(icon);
            return (
              <li key={name} className="flex items-center gap-2.5 text-sm text-slate-700">
                <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {name}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PricingCard — sidebar booking control. Two modes:
//   browse:  rate table (low/peak + cleaning) + deposit policy + Book CTA.
//   receipt: nights × rate + cleaning + total + deposit split, with a
//            small "edit" affordance that pops the user back to browse.

function PricingCard({
  rates,
  cleaningFeeCents,
  quote,
  range,
  isQuoting,
  quoteError,
  started,
  resolvedPolicy,
  depositCents,
  onBook,
  onCancel,
}: {
  rates: RatesByMonth;
  cleaningFeeCents: number;
  quote: Quote | null;
  range: { start: Date; end: Date } | null;
  isQuoting: boolean;
  quoteError: string | null;
  started: boolean;
  resolvedPolicy: {
    effective: PaymentPolicy;
    requested: PaymentPolicy;
    collapsed: boolean;
    collapseReason?: string;
  };
  depositCents: number;
  onBook: () => void;
  onCancel: () => void;
}) {
  const { low, high, lowMonths, highMonths } = seasonBreakdown(rates);
  const flat = low === high;

  if (started && quote) {
    return (
      <PricingReceipt
        quote={quote}
        cleaningFeeCents={cleaningFeeCents}
        resolvedPolicy={resolvedPolicy}
        depositCents={depositCents}
        onCancel={onCancel}
      />
    );
  }

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6">
      <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400 mb-4">
        Pricing
      </p>

      <dl className="space-y-3">
        {flat ? (
          <PriceLine icon={Sparkles} label="Per night" sub="any season" amount={eur(low)} amountSub="/ night" />
        ) : (
          <>
            <PriceLine icon={Snowflake} label="Low season"  sub={lowMonths}  amount={eur(low)}  amountSub="/ night" />
            <Divider />
            <PriceLine icon={Sun}       label="Peak season" sub={highMonths} amount={eur(high)} amountSub="/ night" />
          </>
        )}
        {cleaningFeeCents > 0 && (
          <>
            <Divider />
            <PriceLine icon={Sparkles} label="Cleaning fee" sub="one-off" amount={eur(cleaningFeeCents)} amountSub="/ booking" />
          </>
        )}
      </dl>

      {/* Selected total preview */}
      {range && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          {isQuoting && (
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Computing quote…
            </div>
          )}
          {quoteError && (
            <div className="text-xs text-rose-700 flex items-center gap-2">
              <XCircle className="w-3.5 h-3.5" /> {quoteError}
            </div>
          )}
          {quote && !quoteError && (
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-500 mb-1">
                  Your stay
                </p>
                <p className="text-xs text-slate-600 inline-flex items-center gap-1.5">
                  <Moon className="w-3 h-3 text-slate-400" />
                  {quote.nights} night{quote.nights === 1 ? '' : 's'} · {quote.rate_month_label}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-slate-900 tabular-nums leading-none">
                  {eur(quote.agreed_total_cents)}
                </p>
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mt-0.5">total</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment policy — derived from the estate-wide active policy
          (system_settings). Reflects any too-close collapse for the
          currently-selected dates. */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-500 mb-1">Payment</p>
        <p className="text-xs text-slate-600 leading-relaxed">
          {describePolicy(resolvedPolicy.effective)}
        </p>
        {resolvedPolicy.collapsed && resolvedPolicy.collapseReason && (
          <p className="mt-1 text-[11px] text-amber-700 leading-relaxed">
            {resolvedPolicy.collapseReason}
          </p>
        )}
      </div>

      {/* FUTURE — auth gate:
          When auth is wired, this button's onClick should branch:
            - logged in  → run the current onBook() flow
            - logged out → prompt the user to sign in (modal or redirect)
                            and resume onBook() after a successful sign-in.
          For now the button is always clickable; clicking just flips
          `started` so the Calendar reveals in the main column. */}
      {started ? (
        // Already started — the main column shows the Calendar. Hint that
        // dates are next instead of repeating the same primary button.
        <p className="mt-5 text-[10px] font-mono uppercase tracking-widest text-slate-400 text-center">
          Pick your dates on the calendar →
        </p>
      ) : (
        <button
          type="button"
          onClick={onBook}
          className="mt-5 group w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white text-[10px] font-mono uppercase tracking-[0.3em] font-bold hover:bg-slate-800 transition-colors"
        >
          Book your stay
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </button>
      )}
    </section>
  );
}

function PricingReceipt({
  quote,
  cleaningFeeCents,
  resolvedPolicy,
  depositCents,
  onCancel,
}: {
  quote: Quote;
  cleaningFeeCents: number;
  resolvedPolicy: {
    effective: PaymentPolicy;
    requested: PaymentPolicy;
    collapsed: boolean;
    collapseReason?: string;
  };
  depositCents: number;
  onCancel: () => void;
}) {
  const isPeak = HIGH_SEASON_MONTHS.includes(quote.rate_month as Month);
  const policy = resolvedPolicy.effective;
  const balance = quote.agreed_total_cents - depositCents;
  const isCash = policy.method === 'cash';
  const isFullUpfront = policy.deposit_pct === 100;
  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-6">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400">Receipt</p>
        {/* "Close" — flips `started` back off so the booking flow folds
            away and `What's included` reappears in the main column. */}
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] font-mono uppercase tracking-widest text-slate-400 hover:text-slate-700"
        >
          Close
        </button>
      </div>

      <div className="mb-4 space-y-1.5">
        <p className="text-sm font-bold text-slate-900 inline-flex items-center gap-2">
          <Moon className="w-3.5 h-3.5 text-slate-400" />
          {quote.nights} night{quote.nights === 1 ? '' : 's'} · {quote.rate_month_label}
        </p>
        {/* Season on its own line so it reads as a tag, not a sibling of
            the nights count. */}
        <p className="text-[10px] font-mono uppercase tracking-widest inline-flex items-center gap-1">
          {isPeak ? (
            <>
              <Sun className="w-3 h-3 text-amber-500" />
              <span className="text-amber-700">Peak season</span>
            </>
          ) : (
            <>
              <Snowflake className="w-3 h-3 text-sky-500" />
              <span className="text-sky-700">Low season</span>
            </>
          )}
        </p>
      </div>

      <dl className="space-y-1.5 text-[13px] tabular-nums">
        <ReceiptRow
          label={`${eur(quote.night_rate_cents)} × ${quote.nights}`}
          value={eur(quote.agreed_property_cents)}
        />
        {cleaningFeeCents > 0 && (
          <ReceiptRow label="Cleaning fee" value={eur(quote.agreed_cleaning_cents)} />
        )}
        <div className="pt-3 mt-3 border-t border-slate-200 flex items-baseline justify-between">
          <span className="text-[11px] font-mono uppercase tracking-widest text-slate-500">Total</span>
          <span className="text-lg font-bold text-slate-900 tabular-nums">{eur(quote.agreed_total_cents)}</span>
        </div>
      </dl>

      {resolvedPolicy.collapsed && resolvedPolicy.collapseReason && (
        <div className="mt-4 pt-4 border-t border-slate-200 rounded-lg bg-amber-50 ring-1 ring-amber-200 px-3 py-2 text-[11px] text-amber-900 leading-relaxed">
          <strong>Full payment due now.</strong> {resolvedPolicy.collapseReason}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-slate-200 space-y-2 text-[13px] tabular-nums">
        {isCash ? (
          <ReceiptRow label="Due on arrival (cash)" value={eur(quote.agreed_total_cents)} highlight />
        ) : isFullUpfront ? (
          <ReceiptRow label="Total due now" value={eur(quote.agreed_total_cents)} highlight />
        ) : (
          <>
            <ReceiptRow label={`Deposit · ${policy.deposit_pct}% on booking`} value={eur(depositCents)} highlight />
            <ReceiptRow
              label={
                policy.balance_days_before === 0
                  ? 'Balance · on arrival'
                  : `Balance · ${policy.balance_days_before} days before`
              }
              value={eur(balance)}
              muted
            />
          </>
        )}
      </div>

      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-4 leading-relaxed">
        {isCash
          ? 'No card required at booking. The host will collect on arrival.'
          : isFullUpfront
            ? `Pay ${eur(quote.agreed_total_cents)} now to confirm.`
            : `Pay ${eur(depositCents)} now to confirm. The balance is charged ${policy.balance_days_before} days before check-in.`}
      </p>
    </section>
  );
}

function PriceLine({
  icon: Icon, label, sub, amount, amountSub,
}: {
  icon: LucideIcon;
  label: string;
  sub: string;
  amount: string;
  amountSub?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
          <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {label}
        </div>
        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-0.5 ml-5">
          {sub}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-slate-900 font-bold tabular-nums">{amount}</div>
        {amountSub && (
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{amountSub}</div>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-slate-100" />;
}

function ReceiptRow({
  label, value, highlight, muted,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={`text-[11px] font-mono uppercase tracking-widest ${muted ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}
      </span>
      <span className={`tabular-nums ${highlight ? 'text-base font-bold text-slate-900' : muted ? 'text-slate-500' : 'text-slate-900'}`}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LocationCard — dark slate location info.

function LocationCard() {
  const tarifa = fincaData.location;
  const airports = travel.airports;
  const strait = travel.strait;
  return (
    <section className="rounded-2xl bg-slate-900 text-white p-6 overflow-hidden relative">
      <div aria-hidden className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-sky-900/40 blur-3xl pointer-events-none" />
      <div className="relative">
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/50 mb-2">Location</p>
        <p className="inline-flex items-center gap-2 text-sm font-bold mb-3">
          <MapPin className="w-3.5 h-3.5 text-sky-400" />
          {tarifa.city}, {tarifa.region}, {tarifa.country}
        </p>
        <p className="text-xs text-white/70 leading-relaxed mb-5">
          {tarifa.description}
        </p>

        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/50 mb-2">Airports</p>
        <ul className="space-y-1.5 mb-4">
          {airports.map((a) => (
            <li key={a.name} className="flex items-baseline justify-between gap-3 text-[12px]">
              <span className="font-semibold">{a.name}</span>
              <span className="text-white/60 tabular-nums">{a.time}</span>
            </li>
          ))}
        </ul>

        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/50 mb-2">Across the strait</p>
        <div className="flex items-baseline justify-between gap-3 text-[12px]">
          <span className="font-semibold">{strait.name}</span>
          <span className="text-white/60">{strait.time}</span>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking form blocks (revealed in main column when `started`).

function GuestsCard({
  guests, setGuests, maxGuests,
}: {
  guests: GuestCounts;
  setGuests: (g: GuestCounts) => void;
  maxGuests: number;
}) {
  return (
    <Card eyebrow="Who's coming?" icon={UsersIcon} hint={`max ${maxGuests}`}>
      <GuestConfig value={guests} onChange={setGuests} maxGuests={maxGuests} />
    </Card>
  );
}

function IdentityCard({
  name, setName,
  email, setEmail,
  tif, setTif,
  nationality, setNationality,
  dobDay, setDobDay,
  dobMonth, setDobMonth,
  dobYear, setDobYear,
}: {
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  tif: string; setTif: (v: string) => void;
  nationality: string; setNationality: (v: string) => void;
  dobDay: string;   setDobDay:   (v: string) => void;
  dobMonth: string; setDobMonth: (v: string) => void;
  dobYear: string;  setDobYear:  (v: string) => void;
}) {
  return (
    <Card eyebrow="About you" icon={UserIcon}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Name"  value={name}  onChange={setName}  required />
        <Field label="Email" value={email} onChange={setEmail} type="email" required />
        <Field label="TIF"         value={tif}         onChange={setTif} />
        <Field label="Nationality" value={nationality} onChange={setNationality} />
      </div>
      <div className="mt-3">
        <DobInput
          day={dobDay}     onDay={setDobDay}
          month={dobMonth} onMonth={setDobMonth}
          year={dobYear}   onYear={setDobYear}
        />
      </div>
    </Card>
  );
}

function DobInput({
  day, onDay, month, onMonth, year, onYear,
}: {
  day: string;   onDay:   (v: string) => void;
  month: string; onMonth: (v: string) => void;
  year: string;  onYear:  (v: string) => void;
}) {
  function digits(v: string, max: number) {
    return v.replace(/\D/g, '').slice(0, max);
  }
  return (
    <div>
      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
        Date of birth
      </span>
      <div className="flex items-center gap-2 mt-1">
        <input
          inputMode="numeric" placeholder="DD" aria-label="Day of birth"
          value={day}
          onChange={(e) => onDay(digits(e.target.value, 2))}
          className="w-16 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
        />
        <span className="text-slate-300">/</span>
        <input
          inputMode="numeric" placeholder="MM" aria-label="Month of birth"
          value={month}
          onChange={(e) => onMonth(digits(e.target.value, 2))}
          className="w-16 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
        />
        <span className="text-slate-300">/</span>
        <input
          inputMode="numeric" placeholder="YYYY" aria-label="Year of birth"
          value={year}
          onChange={(e) => onYear(digits(e.target.value, 4))}
          className="w-24 px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
        />
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
        {label}{required && <span className="text-rose-500"> *</span>}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
      />
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — derive season groupings from the rates JSONB.

function seasonBreakdown(rates: RatesByMonth) {
  const values = Object.values(rates);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const allMonths: Month[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const highMonths = allMonths.filter((m) => HIGH_SEASON_MONTHS.includes(m));
  const lowMonths = allMonths.filter((m) => !HIGH_SEASON_MONTHS.includes(m));
  return {
    low,
    high,
    highMonths: formatMonthsCompact(highMonths),
    lowMonths:  formatMonthsCompact(lowMonths),
  };
}

const SHORT_MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMonthsCompact(months: Month[]): string {
  if (months.length === 0) return '';
  const sorted = [...months].sort((a, b) => a - b);
  const runs: Array<[Month, Month]> = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) prev = sorted[i];
    else { runs.push([start, prev]); start = sorted[i]; prev = sorted[i]; }
  }
  runs.push([start, prev]);
  return runs
    .map(([a, b]) => (a === b ? SHORT_MONTHS[a] : `${SHORT_MONTHS[a]}–${SHORT_MONTHS[b]}`))
    .join(', ');
}
