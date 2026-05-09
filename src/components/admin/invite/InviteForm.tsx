'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, AlertCircle, ArrowDown, ArrowUp, Equal } from 'lucide-react';
import Calendar from '@/components/calendar/Calendar';
import { ymd } from '@/components/calendar/dateUtils';
import { previewInviteQuote, createInvitation } from '@/actions/invitations';
import { fmtDateRange, nightsBetween } from '@/lib/dates';
import type { CalendarItem } from '@/lib/calendar';
import type { Quote } from '@/lib/bookings';

// ============================================================================
// InviteForm — admin-only. Workflow:
//
//   1. Pick a property (chip row).
//   2. Pick dates from that property's calendar (admin mode shows held
//      bookings + blocks; we re-check overlap server-side too).
//   3. Pick or invite a guest (email + name, datalist autocompletes against
//      existing users; typing a new email creates a fresh user record).
//   4. The form fetches the would-be default quote (computeQuote — a JSONB
//      lookup against properties.rates) and pre-fills the custom inputs with it.
//   5. Admin overrides property fee + cleaning fee. Live diff vs the default
//      shows whether this is a discount or a premium.
//   6. Submit → createInvitation → redirect to /admin/invite.
//
// All money values are EUR cents. The form converts to/from euros for input.
// ============================================================================

export type PropertyOption = {
  id: string;
  slug: string;
  title: string;
  cleaning_fee_cents: number;
  max_guests: number;
};

export type UserOption = {
  id: string;
  name: string;
  email: string;
};

type Props = {
  properties: PropertyOption[];
  users: UserOption[];
  /** Pre-fetched calendar items per property slug. */
  calendarsBySlug: Record<string, CalendarItem[]>;
};

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(cents / 100);
}

function eurInputVal(cents: number): string {
  // Show as euros (whole). Admin types "100" → 10000 cents.
  return String(Math.round(cents / 100));
}

function parseEur(input: string): number | null {
  if (input.trim() === '') return null;
  const n = Math.round(parseFloat(input.replace(',', '.')) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function InviteForm({ properties, users, calendarsBySlug }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // -------- form state --------
  const [slug, setSlug] = useState<string>(properties[0]?.slug ?? '');
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [tif, setTif] = useState('');
  const [nationality, setNationality] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [confirmNow, setConfirmNow] = useState(false);

  const [customPropertyEuros, setCustomPropertyEuros] = useState<string>('');
  const [customCleaningEuros, setCustomCleaningEuros] = useState<string>('');
  const [customTouched, setCustomTouched] = useState(false);

  const [defaultQuote, setDefaultQuote] = useState<Quote | null>(null);
  const [defaultError, setDefaultError] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);

  const [submitError, setSubmitError] = useState<string | null>(null);

  // -------- derived --------
  const property = useMemo(
    () => properties.find((p) => p.slug === slug),
    [properties, slug],
  );
  const items = calendarsBySlug[slug] ?? [];
  const nights = range ? nightsBetween(range.start, range.end) : 0;

  // Auto-fill name on email change when it matches an existing user — done in
  // the onChange handler (not an effect) so the lint rule about cascading
  // setState-in-effect doesn't fire and so the auto-fill is bound to the user
  // gesture rather than React's render cycle.
  function onEmailChange(value: string) {
    setEmail(value);
    if (!name) {
      const match = users.find((u) => u.email.toLowerCase() === value.trim().toLowerCase());
      if (match) setName(match.name);
    }
  }

  // Re-quote on (slug, range) change and pre-fill the custom fields.
  useEffect(() => {
    if (!slug || !range) {
      setDefaultQuote(null);
      setDefaultError(null);
      return;
    }
    let cancelled = false;
    setIsQuoting(true);
    setDefaultError(null);
    previewInviteQuote({
      slug,
      check_in: ymd(range.start),
      check_out: ymd(range.end),
    }).then((res) => {
      if (cancelled) return;
      setIsQuoting(false);
      if (res.ok) {
        setDefaultQuote(res.quote);
        // Pre-fill custom inputs with the default — admin can override.
        if (!customTouched) {
          setCustomPropertyEuros(eurInputVal(res.quote.agreed_property_cents));
          setCustomCleaningEuros(eurInputVal(res.quote.agreed_cleaning_cents));
        }
      } else {
        setDefaultQuote(null);
        setDefaultError(res.error);
        // Fallback: if no rate matches, prefill cleaning from property default
        // and leave property fee blank for admin to fill.
        if (!customTouched && property) {
          setCustomCleaningEuros(eurInputVal(property.cleaning_fee_cents));
          setCustomPropertyEuros('');
        }
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, range?.start.getTime(), range?.end.getTime()]);

  // -------- diff calc --------
  const customPropertyCents = parseEur(customPropertyEuros);
  const customCleaningCents = parseEur(customCleaningEuros);
  const customTotalCents =
    customPropertyCents != null && customCleaningCents != null
      ? customPropertyCents + customCleaningCents
      : null;
  const defaultTotalCents = defaultQuote?.agreed_total_cents ?? null;
  const diffCents =
    customTotalCents != null && defaultTotalCents != null
      ? customTotalCents - defaultTotalCents
      : null;
  const diffPct =
    diffCents != null && defaultTotalCents && defaultTotalCents > 0
      ? Math.round((diffCents / defaultTotalCents) * 100)
      : 0;

  const ready =
    slug && range && email && name &&
    customPropertyCents != null && customCleaningCents != null &&
    !isPending;

  // -------- submit --------
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    if (!ready) return;
    if (!range || customPropertyCents == null || customCleaningCents == null) return;

    const fd = new FormData();
    fd.set('slug', slug);
    fd.set('check_in', ymd(range.start));
    fd.set('check_out', ymd(range.end));
    fd.set('email', email);
    fd.set('name', name);
    if (tif) fd.set('tif', tif);
    if (nationality) fd.set('nationality', nationality);
    fd.set('adults', String(adults));
    fd.set('children', String(children));
    fd.set('agreed_property_cents', String(customPropertyCents));
    fd.set('agreed_cleaning_cents', String(customCleaningCents));
    if (confirmNow) fd.set('confirm_now', 'true');

    startTransition(async () => {
      const result = await createInvitation(fd);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      router.push('/admin/invite');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* ── Property picker ── */}
      <Section label="Property">
        <div className="flex flex-wrap gap-2">
          {properties.map((p) => {
            const active = p.slug === slug;
            return (
              <button
                key={p.slug}
                type="button"
                onClick={() => { setSlug(p.slug); setRange(null); setCustomTouched(false); }}
                className={[
                  'px-4 py-2 rounded-xl text-sm font-bold transition',
                  active
                    ? 'bg-slate-900 text-white ring-2 ring-slate-900'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300',
                ].join(' ')}
              >
                <span className="uppercase tracking-wider">{p.slug}</span>
                <span className={`ml-2 text-xs font-mono ${active ? 'text-white/60' : 'text-slate-400'}`}>
                  sleeps {p.max_guests}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Calendar ── */}
      <Section label="Dates" hint={range ? fmtDateRange(range.start, range.end) + ` · ${nights} nights` : 'Click two days'}>
        <Calendar
          mode="admin"
          slug={slug}
          items={items}
          monthsDefault={4}
          selectedRange={range ? { start: range.start, end: range.end } : undefined}
          onSelectRange={(start, end) => { setRange({ start, end }); setCustomTouched(false); }}
          onClearRange={() => setRange(null)}
        />
      </Section>

      {/* ── Default vs Custom — pricing ── */}
      <Section label="Pricing">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Default */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">
              Default {isQuoting && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />}
            </h3>
            {!range && <p className="text-xs text-slate-400 italic">Pick dates to compute.</p>}
            {range && defaultError && (
              <p className="text-xs text-amber-700 italic">{defaultError}</p>
            )}
            {range && defaultQuote && (
              <dl className="space-y-1.5 text-xs text-slate-700 tabular-nums">
                <Row label={`${eur(defaultQuote.night_rate_cents)} × ${defaultQuote.nights} ${defaultQuote.nights === 1 ? 'night' : 'nights'}`}
                     value={eur(defaultQuote.agreed_property_cents)} />
                <Row label="Cleaning" value={eur(defaultQuote.agreed_cleaning_cents)} />
                <div className="pt-2 mt-2 border-t border-slate-200 flex items-baseline justify-between">
                  <span className="text-xs font-mono uppercase tracking-widest text-slate-500">Total</span>
                  <span className="text-base font-bold text-slate-900">{eur(defaultQuote.agreed_total_cents)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-widest">
                  rate · {defaultQuote.rate_month_label}
                </p>
              </dl>
            )}
          </div>

          {/* Custom */}
          <div className="rounded-2xl border-2 border-ocean/30 bg-ocean/[0.03] p-5">
            <h3 className="text-xs font-mono uppercase tracking-widest text-ocean mb-3">Custom (admin override)</h3>
            <div className="space-y-3">
              <EurField
                label={`Property fee${nights > 0 && customPropertyCents != null ? ` (${eur(Math.round(customPropertyCents / nights))} / night)` : ''}`}
                value={customPropertyEuros}
                onChange={(v) => { setCustomPropertyEuros(v); setCustomTouched(true); }}
              />
              <EurField
                label="Cleaning fee"
                value={customCleaningEuros}
                onChange={(v) => { setCustomCleaningEuros(v); setCustomTouched(true); }}
              />
              <div className="pt-2 mt-2 border-t border-ocean/20 flex items-baseline justify-between">
                <span className="text-xs font-mono uppercase tracking-widest text-ocean">Total</span>
                <span className="text-base font-bold text-slate-900">
                  {customTotalCents != null ? eur(customTotalCents) : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Diff strip */}
        <DiffStrip diffCents={diffCents} diffPct={diffPct} />
      </Section>

      {/* ── Guest ── */}
      <Section label="Guest" hint={users.length ? `${users.length} existing — autocomplete by email` : undefined}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Email *" required>
            <input
              type="email"
              required
              list="invite-user-emails"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              autoComplete="off"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
            />
            <datalist id="invite-user-emails">
              {users.map((u) => (
                <option key={u.id} value={u.email}>{u.name}</option>
              ))}
            </datalist>
          </Field>
          <Field label="Name *" required>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
            />
          </Field>
          <Field label="TIF (optional)">
            <input
              type="text"
              value={tif}
              onChange={(e) => setTif(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
            />
          </Field>
          <Field label="Nationality (optional)">
            <input
              type="text"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
            />
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Adults">
            <input type="number" min={1} max={property?.max_guests ?? 10} value={adults}
                   onChange={(e) => setAdults(parseInt(e.target.value, 10) || 1)}
                   className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm" />
          </Field>
          <Field label="Children">
            <input type="number" min={0} max={property?.max_guests ?? 10} value={children}
                   onChange={(e) => setChildren(parseInt(e.target.value, 10) || 0)}
                   className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm" />
          </Field>
        </div>
      </Section>

      {/* ── How to deliver ── confirm-now toggle */}
      <Section label="On submit">
        <div role="radiogroup" aria-label="Invitation behaviour" className="grid grid-cols-1 md:grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
          <DeliveryOption
            value={false}
            current={confirmNow}
            onChange={setConfirmNow}
            label="Hold for invitee to accept"
            sub="Booking sits as request/invite until they confirm"
          />
          <DeliveryOption
            value={true}
            current={confirmNow}
            onChange={setConfirmNow}
            label="Confirm now"
            sub="Booking goes straight to confirmed · skip the accept step"
            accent
          />
        </div>
        {confirmNow && (
          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-emerald-900 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Dates lock immediately and the invitation is filed as <span className="font-mono">accepted</span>.
              Use this when the guest already agreed verbally and there&apos;s no need for the back-and-forth.
            </span>
          </div>
        )}
      </Section>

      {/* ── Errors + submit ── */}
      {submitError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {submitError}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!ready}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white font-bold text-xs uppercase tracking-[0.2em] hover:bg-ocean transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {isPending
            ? 'Creating…'
            : confirmNow
              ? 'Create + confirm'
              : 'Send invitation'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/invite')}
          className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono uppercase tracking-widest"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function DeliveryOption({
  value, current, onChange, label, sub, accent,
}: {
  value: boolean;
  current: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub: string;
  accent?: boolean;
}) {
  const selected = current === value;
  const selectedClass = accent
    ? 'bg-white shadow-sm ring-1 ring-emerald-300 text-emerald-900'
    : 'bg-white shadow-sm ring-1 ring-slate-300 text-slate-900';
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onChange(value)}
      className={`px-4 py-3 rounded-xl text-left transition ${selected ? selectedClass : 'text-slate-500 hover:text-slate-700'}`}
    >
      <span className="block text-sm font-bold">{label}</span>
      <span className="block text-xs text-slate-500 leading-snug mt-0.5">{sub}</span>
    </button>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xs font-mono uppercase tracking-[0.3em] text-ocean">{label}</h2>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={`text-xs font-mono uppercase tracking-widest ${required ? 'text-slate-700' : 'text-slate-400'}`}>
        {label}
      </span>
      {children}
    </label>
  );
}

function EurField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-3">
      <span className="text-xs font-mono uppercase tracking-widest text-slate-500 flex-1 min-w-0">
        {label}
      </span>
      <span className="inline-flex items-center bg-white rounded-lg ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-ocean/30 focus-within:border-ocean shrink-0">
        <span className="px-2 text-slate-400 text-sm">€</span>
        <input
          type="number"
          step={1}
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 px-2 py-2 text-sm text-right tabular-nums focus:outline-none bg-transparent"
        />
      </span>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function DiffStrip({ diffCents, diffPct }: { diffCents: number | null; diffPct: number }) {
  if (diffCents == null) {
    return (
      <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-xs text-slate-400 italic">
        Diff appears once both default + custom are computed.
      </div>
    );
  }
  if (diffCents === 0) {
    return (
      <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center gap-2 text-xs text-slate-700">
        <Equal className="w-3.5 h-3.5" />
        <span><strong>No diff</strong> — same as default pricing.</span>
      </div>
    );
  }
  const negative = diffCents < 0;
  const tone = negative
    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
    : 'bg-amber-50 border-amber-200 text-amber-900';
  const Icon = negative ? ArrowDown : ArrowUp;
  return (
    <div className={`mt-3 rounded-xl border px-4 py-3 flex items-center gap-2 text-xs ${tone}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>
        <strong>{negative ? 'Discount' : 'Premium'}:</strong>{' '}
        {negative ? '−' : '+'}{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.abs(diffCents) / 100)}
        {Math.abs(diffPct) > 0 && <> ({negative ? '−' : '+'}{Math.abs(diffPct)}%)</>}
        {' vs default'}
      </span>
    </div>
  );
}
