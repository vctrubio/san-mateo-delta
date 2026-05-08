'use client';

import { useEffect, useState, useTransition } from 'react';
import { Loader2, CheckCircle2, XCircle, Moon } from 'lucide-react';
import { previewQuote, requestBooking } from '@/actions/bookings';
import Calendar from '@/components/calendar/Calendar';
import { ymd } from '@/components/calendar/dateUtils';
import type { CalendarItem } from '@/lib/calendar';
import type { Quote } from '@/lib/bookings';

type Props = {
  slug: string;
  maxGuests: number;
  /** Pre-fetched server-side, covers ~6 future months from /finca/[slug]/page.tsx. */
  items: CalendarItem[];
};

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default function BookNowForm({ slug, maxGuests, items }: Props) {
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Re-quote whenever the calendar selection changes
  useEffect(() => {
    if (!range) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    let cancelled = false;
    setIsQuoting(true);
    setQuoteError(null);
    previewQuote({
      slug,
      check_in: ymd(range.start),
      check_out: ymd(range.end),
    }).then((result) => {
      if (cancelled) return;
      setIsQuoting(false);
      if (result.ok) {
        setQuote(result.quote);
      } else {
        setQuote(null);
        setQuoteError(result.error);
      }
    });
    return () => { cancelled = true; };
  }, [slug, range?.start.getTime(), range?.end.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  function onSubmit(formData: FormData) {
    setError(null);
    if (!range) {
      setError('Select check-in and check-out dates first.');
      return;
    }
    formData.set('slug', slug);
    formData.set('check_in', ymd(range.start));
    formData.set('check_out', ymd(range.end));
    startTransition(async () => {
      const result = await requestBooking(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = `/user/${result.userId}`;
    });
  }

  const ready = range && quote && !quoteError && !isQuoting;

  return (
    <section id="book" className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 scroll-mt-24">
      <div className="flex items-baseline justify-between mb-5 flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Book now</h2>
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
          no auth · sleeps {maxGuests} max
        </span>
      </div>

      <Calendar
        mode="public"
        items={items}
        monthsDefault={2}
        selectedRange={range ? { start: range.start, end: range.end } : undefined}
        onSelectRange={(start, end) => setRange({ start, end })}
        onClearRange={() => setRange(null)}
      />

      {/* Live quote preview */}
      <div className="mt-5">
        {!range && (
          <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-4 text-[12px] text-slate-400">
            Pick check-in and check-out dates above to see your quote.
          </div>
        )}
        {range && isQuoting && (
          <div className="rounded-2xl border border-slate-100 px-5 py-4 text-[12px] text-slate-500 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Computing quote…
          </div>
        )}
        {range && quoteError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900 flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" /> {quoteError}
          </div>
        )}
        {range && quote && !quoteError && <QuoteCard quote={quote} />}
      </div>

      {/* Guest form */}
      <form action={onSubmit} className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <div className="md:col-span-2">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">Who is checking in?</h3>
        </div>
        <Field label="Adults"   name="adults"   type="number" min={1} max={maxGuests} defaultValue={2} required />
        <Field label="Children" name="children" type="number" min={0} max={maxGuests} defaultValue={0} />
        <Field label="Infants"  name="infants"  type="number" min={0} max={maxGuests} defaultValue={0} />
        <Field label="Pets"     name="pets"     type="number" min={0} max={4}        defaultValue={0} />

        <div className="md:col-span-2 mt-4 pt-4 border-t border-slate-100">
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">About you</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Name"           name="name"        type="text"  required />
            <Field label="Email"          name="email"       type="email" required />
            <Field label="TIF (optional)"         name="tif" />
            <Field label="Nationality (optional)" name="nationality" />
            <Field label="DOB (optional)"         name="dob" type="date" />
          </div>
        </div>

        {error && (
          <div className="md:col-span-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || !ready}
          className="md:col-span-2 mt-2 w-full py-4 rounded-2xl bg-slate-900 text-white font-bold uppercase tracking-[0.2em] text-xs hover:bg-ocean hover:shadow-lg hover:shadow-ocean/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isPending ? 'Submitting…' : ready ? 'Request booking' : 'Pick dates first'}
        </button>

        <p className="md:col-span-2 text-[11px] text-slate-400 text-center">
          You&apos;ll be redirected to your dashboard. Status starts as <span className="font-mono">request</span> until the host approves.
        </p>
      </form>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function QuoteCard({ quote }: { quote: Quote }) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-ocean">Quote</p>
          <p className="text-base font-bold text-slate-900 tracking-tight mt-0.5">{quote.rate_name}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-500 uppercase tracking-widest">
          <Moon className="w-3 h-3" /> {quote.nights} night{quote.nights === 1 ? '' : 's'}
        </span>
      </div>
      <dl className="space-y-1.5 text-[12px] text-slate-600 tabular-nums">
        <Line label={`${eur(quote.night_rate_cents)} × ${quote.nights} night${quote.nights === 1 ? '' : 's'}`} value={eur(quote.agreed_property_cents)} />
        <Line label="Cleaning fee" value={eur(quote.agreed_cleaning_cents)} />
        <div className="pt-2 mt-2 border-t border-slate-200 flex items-baseline justify-between">
          <span className="text-[11px] font-mono uppercase tracking-widest text-slate-500">Total</span>
          <span className="text-lg font-bold text-slate-900 tabular-nums">{eur(quote.agreed_total_cents)}</span>
        </div>
      </dl>
      <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-700 uppercase tracking-widest">
        <CheckCircle2 className="w-3 h-3" /> Available
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  defaultValue,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        min={min}
        max={max}
        className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
      />
    </label>
  );
}
