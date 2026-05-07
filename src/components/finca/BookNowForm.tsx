'use client';

import { useState, useTransition } from 'react';
import { requestBooking } from '@/actions/bookings';

type Props = {
  slug: string;
  maxGuests: number;
};

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default function BookNowForm({ slug, maxGuests }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      formData.set('slug', slug);
      const result = await requestBooking(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Hard redirect — the action upserted the user and now we go to their dashboard.
      window.location.href = `/user/${result.userId}`;
    });
  }

  return (
    <section id="book" className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 scroll-mt-24">
      <div className="flex items-baseline justify-between mb-5 flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Book now</h2>
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
          no auth · sleeps {maxGuests} max
        </span>
      </div>

      <form action={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <Field label="Check-in"  name="check_in"  type="date" required />
        <Field label="Check-out" name="check_out" type="date" required />

        <Field label="Adults"    name="adults"    type="number" min={1} max={maxGuests} defaultValue={2} required />
        <Field label="Children"  name="children"  type="number" min={0} max={maxGuests} defaultValue={0} />
        <Field label="Infants"   name="infants"   type="number" min={0} max={maxGuests} defaultValue={0} />
        <Field label="Pets"      name="pets"      type="number" min={0} max={4}        defaultValue={0} />

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
          disabled={isPending}
          className="md:col-span-2 mt-2 w-full py-4 rounded-2xl bg-slate-900 text-white font-bold uppercase tracking-[0.2em] text-xs hover:bg-ocean hover:shadow-lg hover:shadow-ocean/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Submitting…' : 'Request booking'}
        </button>

        <p className="md:col-span-2 text-[11px] text-slate-400 text-center">
          You&apos;ll be redirected to your dashboard. Status starts as <span className="font-mono">request</span> until the host approves.
        </p>
      </form>
    </section>
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
