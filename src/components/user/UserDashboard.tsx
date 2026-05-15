import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Calendar,
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  MapPin,
  Moon,
  MoveRight,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import StatusBadge from '@/components/admin/StatusBadge';
import BookingActions from '@/components/user/BookingActions';
import { fmtDate, fmtDateRange, nightsBetween, relativeStayLabel } from '@/lib/dates';
import { eur } from '@/lib/format';
import { PROPERTY_LABELS, type PropertySlug } from '@/lib/colors';
import { paymentState } from '@/lib/bookingState';
import { describePolicy } from '@/lib/payment';
import { formatGuests } from '@/lib/guests';
import type { BookingRow } from '@/lib/bookings';
import type { User } from '@/lib/users';

// ============================================================================
// UserDashboard — guest-side portfolio. Read-only: shows everything the
// guest cares about (next stay, history, money, refunds) but doesn't expose
// cancellation. Cancellations route through the admin so the host stays in
// the loop (the demo `/admin` covers this).
//
// Layout:
//   1. Hero        — gradient + greeting + email + lifetime stats
//   2. Next stay   — prominent card highlighting the soonest upcoming stay
//   3. Bookings    — four grouped sections (pending / upcoming / past /
//                    cancelled), each a list of rich BookingCard tiles
//   4. CTA         — "Want another stay?" → /finca
//
// A BookingCard carries: property photo, name, relative-stay label, status
// badge, date range + nights, guest counts (4A · 1C), paid / agreed money
// breakdown, refund line if cancelled, and a "View property" link to
// /finca/[slug]. No action buttons — this surface is for the guest's
// situational awareness, not for mutations.
// ============================================================================

export default function UserDashboard({
  user,
  bookings,
  justBookedId,
}: {
  user: User;
  bookings: BookingRow[];
  justBookedId?: string;
}) {
  // Arrive from /checkout/success with ?just_booked=<id> — show a one-time
  // banner above the dashboard so the guest sees a clear "request submitted"
  // moment instead of just landing in a list.
  const justBooked = justBookedId
    ? bookings.find((b) => b.id === justBookedId)
    : undefined;
  // Lifetime aggregates.
  const totalBookings = bookings.length;
  const lifetimeSpend = bookings.reduce((s, b) => s + b.paid_cents, 0);
  const nightsLifetime = bookings
    .filter((b) => b.status === 'checked_out' || b.status === 'checked_in')
    .reduce((s, b) => s + nightsBetween(b.date_check_in, b.date_check_out), 0);

  // Soonest upcoming stay — confirmed or checked_in, earliest check-in. The
  // hero card renders this booking on its own; the "More upcoming" section
  // below shows the OTHER confirmed/checked-in bookings so nothing is shown
  // twice.
  const upcomingAll = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'checked_in')
    .sort((a, b) => a.date_check_in.localeCompare(b.date_check_in));
  const nextStay = upcomingAll[0];
  const moreUpcoming = upcomingAll.slice(1);

  // Group lists — `upcoming` skips the nextStay since the hero owns it.
  const groups: Array<{ key: string; label: string; items: BookingRow[] }> = [
    { key: 'pending',   label: 'Pending host approval', items: bookings.filter((b) => b.status === 'request' || b.status === 'invite') },
    { key: 'upcoming',  label: 'More upcoming',         items: moreUpcoming },
    { key: 'past',      label: 'Past stays',            items: bookings.filter((b) => b.status === 'checked_out') },
    { key: 'cancelled', label: 'Cancelled',             items: bookings.filter((b) => b.status === 'cancelled') },
  ];

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <Hero
        user={user}
        totalBookings={totalBookings}
        lifetimeSpend={lifetimeSpend}
        nightsLifetime={nightsLifetime}
      />

      <div className="max-w-4xl mx-auto px-6 -mt-20 relative z-10 space-y-10">
        {justBooked && <JustBookedBanner booking={justBooked} />}
        {nextStay && <NextStayCard booking={nextStay} />}

        {bookings.length === 0 ? (
          <EmptyState />
        ) : (
          groups.map(({ key, label, items }) => {
            if (items.length === 0) return null;
            return (
              <section key={key}>
                <h2 className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400 mb-3 flex items-baseline gap-2">
                  {label}
                  <span className="text-slate-300 tracking-widest">· {items.length}</span>
                </h2>
                <ul className="space-y-3">
                  {items.map((b) => (
                    <li key={b.id}>
                      <BookingCard booking={b} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}

        <BrowseAnotherCard />
      </div>
    </main>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────

function Hero({
  user,
  totalBookings,
  lifetimeSpend,
  nightsLifetime,
}: {
  user: User;
  totalBookings: number;
  lifetimeSpend: number;
  nightsLifetime: number;
}) {
  return (
    <header className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-ocean text-white pb-28 pt-12 px-6 overflow-hidden">
      {/* Soft accents */}
      <div className="absolute -top-32 -right-24 w-72 h-72 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-sand/10 blur-3xl" />

      <div className="max-w-4xl mx-auto relative">
        <Link
          href="/user?demo=1"
          className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          All users · demo
        </Link>

        <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tighter">
          Hi, {user.name.split(' ')[0]}.
        </h1>
        <p className="mt-1 text-sm font-mono text-white/60">{user.email}</p>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Bookings"        value={String(totalBookings)} />
          <Stat label="Lifetime spend"  value={eur(lifetimeSpend)} />
          <Stat label="Nights stayed"   value={String(nightsLifetime)} />
          <Stat label="Member since"    value={fmtDate(user.created_at)} />
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 p-3">
      <div className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/60">{label}</div>
      <div className="text-base md:text-lg font-bold tabular-nums tracking-tight mt-1 truncate">{value}</div>
    </div>
  );
}

// ─── Just-booked confirmation banner ──────────────────────────────────────
//
// Shown when the dashboard is opened from /checkout/success with the
// ?just_booked=<id> query param. Echoes the booking back to the guest so
// they see explicit confirmation ("request received") rather than landing
// in a generic list view. The banner is purely informational — it doesn't
// link anywhere; the booking itself appears in NextStayCard or the
// pending-host-approval group below.

function JustBookedBanner({ booking }: { booking: BookingRow }) {
  const propLabel = PROPERTY_LABELS[booking.property_slug as PropertySlug] ?? booking.property_slug;
  const isConfirmed = booking.status === 'confirmed' || booking.status === 'checked_in';
  const policy = booking.payment_policy;
  const isCash = policy.method === 'cash';
  // Body copy derives from the booking's snapshotted policy — so a guest
  // who booked under 50/14 still sees "balance 14 days before arrival"
  // even if admin later flips estate-wide to cash mode.
  const body = isConfirmed
    ? 'Your stay is locked in. Add the dates to your calendar and we’ll see you in Tarifa.'
    : isCash
      ? 'Your host typically replies within 24 hours. No card was collected — pay in cash on arrival.'
      : policy.deposit_pct === 100
        ? 'Your host typically replies within 24 hours. Full payment has been received.'
        : `Your host typically replies within 24 hours. Deposit has been received; the balance is due ${policy.balance_days_before} day${policy.balance_days_before === 1 ? '' : 's'} before arrival.`;

  return (
    <section className="rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-emerald-50 border border-emerald-200 p-5 md:p-6 shadow-[0_4px_24px_-12px_rgba(16,185,129,0.25)]">
      <div className="flex items-start gap-4">
        <span className="shrink-0 grid place-items-center w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-emerald-700 mb-1">
            {isConfirmed ? 'Booking confirmed' : isCash ? 'Reserve received' : 'Request received'}
          </p>
          <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
            {propLabel} · {fmtDateRange(booking.date_check_in, booking.date_check_out)}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed mt-1">{body}</p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-600 mt-2">
            {describePolicy(policy)}
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Next stay highlight ───────────────────────────────────────────────────

function NextStayCard({ booking }: { booking: BookingRow }) {
  const nights = nightsBetween(booking.date_check_in, booking.date_check_out);
  const propLabel = PROPERTY_LABELS[booking.property_slug as PropertySlug] ?? booking.property_slug;
  const pay = paymentState(booking);
  const owed = booking.agreed_total_cents - booking.paid_cents;

  return (
    <article className="rounded-3xl bg-white border border-slate-200 shadow-[0_4px_24px_-12px_rgba(15,23,42,0.15)] overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
        <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[260px] bg-slate-100">
          <Image
            src={`/images/${booking.property_slug}.png`}
            alt={propLabel}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 280px"
          />
          <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md ring-1 ring-white/40 text-[10px] font-mono uppercase tracking-widest text-slate-700">
            <Sparkles className="w-3 h-3 text-ocean" />
            Next stay
          </div>
        </div>

        <div className="p-6 md:p-7 flex flex-col gap-4">
          <div>
            <div className="text-xs font-mono text-ocean uppercase tracking-[0.4em]">
              {relativeStayLabel(booking.date_check_in, booking.date_check_out)}
            </div>
            <div className="flex items-baseline gap-3 flex-wrap mt-1">
              <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tighter">{propLabel}</h2>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                {booking.property_title}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge status={booking.status} />
            <PaymentChip kind={pay} owed={owed} />
          </div>

          <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
            <Field icon={CalendarRange} label="Dates"   value={fmtDateRange(booking.date_check_in, booking.date_check_out)} />
            <Field icon={Moon}          label="Nights"  value={String(nights)} />
            <Field icon={Users}         label="Guests"  value={formatGuests(booking.guests)} />
            <Field icon={Wallet}        label="Total"   value={`${eur(booking.paid_cents)} / ${eur(booking.agreed_total_cents)}`} />
          </dl>

          <BookingActions booking={booking} />

          <Link
            href={`/finca/${booking.property_slug}`}
            className="mt-auto inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-mono uppercase tracking-[0.2em] font-semibold hover:bg-ocean hover:shadow-lg hover:shadow-ocean/30 transition-all"
          >
            <MapPin className="w-3.5 h-3.5" />
            View property
            <MoveRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

// ─── Booking card (used in grouped lists) ──────────────────────────────────

function BookingCard({ booking }: { booking: BookingRow }) {
  const nights = nightsBetween(booking.date_check_in, booking.date_check_out);
  const propLabel = PROPERTY_LABELS[booking.property_slug as PropertySlug] ?? booking.property_slug;
  const pay = paymentState(booking);
  const owed = booking.agreed_total_cents - booking.paid_cents;
  const refunded = booking.refunded_cents ?? 0;

  return (
    <article className="rounded-2xl bg-white border border-slate-200 overflow-hidden hover:border-ocean/40 hover:shadow-lg hover:shadow-ocean/5 transition-all">
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr]">
        {/* Photo */}
        <div className="relative aspect-[4/3] sm:aspect-auto sm:min-h-[200px] bg-slate-100">
          <Image
            src={`/images/${booking.property_slug}.png`}
            alt={propLabel}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 180px"
          />
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">{propLabel}</h3>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  {booking.property_title}
                </span>
              </div>
              <p className="text-[11px] font-mono text-ocean uppercase tracking-widest mt-1">
                {relativeStayLabel(booking.date_check_in, booking.date_check_out)}
              </p>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            <Field icon={CalendarRange} label="Dates"  value={`${fmtDateRange(booking.date_check_in, booking.date_check_out)} · ${nights}n`} compact />
            <Field icon={Users}         label="Guests" value={formatGuests(booking.guests)} compact />
            <Field icon={Wallet}        label="Paid"   value={`${eur(booking.paid_cents)} / ${eur(booking.agreed_total_cents)}`} compact />
            {booking.status === 'cancelled'
              ? <Field icon={Wallet} label="Refund" value={booking.refund_amount_cents != null ? eur(booking.refund_amount_cents) : '—'} compact />
              : owed > 0
                ? <Field icon={Wallet} label="Outstanding" value={eur(owed)} compact highlight="amber" />
                : <Field icon={Wallet} label="Status" value="Settled" compact />}
          </dl>

          {/* Footer row: payment chip + actions */}
          <div className="flex items-center justify-between gap-3 mt-auto pt-3 border-t border-slate-100 flex-wrap">
            <PaymentChip kind={pay} owed={owed} />
            <Link
              href={`/finca/${booking.property_slug}`}
              className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest text-ocean hover:gap-2 transition-all"
            >
              View property
              <MoveRight className="w-3 h-3" />
            </Link>
          </div>

          <BookingActions booking={booking} />

          {/* Cancellation breakdown */}
          {booking.status === 'cancelled' && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-[11px] text-rose-700 leading-relaxed">
              Cancelled by <span className="font-semibold">{booking.cancelled_by ?? 'host'}</span>
              {booking.cancellation_reason && <> · {booking.cancellation_reason}</>}
              {booking.policy_applied && <> · policy {booking.policy_applied}</>}
              {refunded > 0 && <> · refunded {eur(refunded)}</>}
            </div>
          )}

          {/* Pending — host hasn't approved yet */}
          {booking.status === 'request' && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-[11px] text-amber-800">
              <CalendarCheck className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />
              Waiting for the host to confirm — you&apos;ll be notified.
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Shared bits ───────────────────────────────────────────────────────────

function Field({
  icon: Icon,
  label,
  value,
  compact = false,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  compact?: boolean;
  highlight?: 'amber';
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-slate-400 shrink-0" />
        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div className={`mt-0.5 font-semibold truncate ${compact ? 'text-[13px]' : 'text-sm'} ${highlight === 'amber' ? 'text-amber-700' : 'text-slate-900'} tabular-nums`}>
        {value}
      </div>
    </div>
  );
}

function PaymentChip({ kind, owed }: { kind: ReturnType<typeof paymentState>; owed: number }) {
  if (kind === 'paid') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 text-[10px] font-mono uppercase tracking-widest">
        Fully paid
      </span>
    );
  }
  if (kind === 'partial') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200 text-[10px] font-mono uppercase tracking-widest">
        Partial · {eur(owed)} owed
      </span>
    );
  }
  if (kind === 'unpaid') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200 text-[10px] font-mono uppercase tracking-widest">
        Unpaid · {eur(owed)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-200 text-[10px] font-mono uppercase tracking-widest">
      n/a
    </span>
  );
}

// ─── Empty + CTA ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <section className="rounded-3xl bg-white border border-slate-200 p-10 text-center">
      <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-3" />
      <h3 className="text-lg font-bold text-slate-900 mb-1">No bookings yet</h3>
      <p className="text-sm text-slate-500 mb-5">
        Pick one of the four properties at Finca San Mateo and reserve your stay.
      </p>
      <Link
        href="/finca"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 text-white text-xs font-mono uppercase tracking-[0.2em] hover:bg-ocean hover:shadow-lg hover:shadow-ocean/30 transition-all"
      >
        Browse the collection
        <MoveRight className="w-3.5 h-3.5" />
      </Link>
    </section>
  );
}

function BrowseAnotherCard() {
  return (
    <section className="rounded-3xl bg-gradient-to-br from-sand/40 via-sand/20 to-white border border-amber-200 p-6 md:p-8 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-amber-700">Plan another stay</p>
        <h3 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight mt-1">
          Four homes, one estate, Tarifa.
        </h3>
        <p className="text-sm text-slate-600 mt-1">Pick your dates and the right space for the rhythm.</p>
      </div>
      <Link
        href="/finca"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 text-white text-xs font-mono uppercase tracking-[0.2em] hover:bg-ocean hover:shadow-lg hover:shadow-ocean/30 transition-all shrink-0"
      >
        Browse properties
        <MoveRight className="w-3.5 h-3.5" />
      </Link>
    </section>
  );
}
