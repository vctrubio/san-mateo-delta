'use client';

import { useState, useTransition } from 'react';
import {
  Minus,
  Plus,
  Pencil,
  Save,
  Undo2,
  RotateCcw,
  Euro,
  Eye,
  EyeOff,
} from 'lucide-react';
import Modal from '@/components/shared/Modal';
import {
  ModalHeader,
  Section,
  Field,
  ErrorBanner,
  INPUT_CLASS,
} from '@/components/shared/modalKit';
import { updateProperty, updatePropertyRates } from '@/actions/properties';
import { PROPERTY_LABELS, type PropertySlug } from '@/lib/colors';
import { eur } from '@/lib/format';
import { MONTHS, type Month } from '@db/enums';
import type { Property } from '@/lib/properties';

// ============================================================================
// PropertyEditModal — the single surface for editing a property.
//
// The /admin/properties route is gone. Every admin path to "change this
// property's details, capacity, cleaning fee, visibility, or rates" lands
// here, launched from the Edit pencil on the dashboard's per-property card.
//
// UX
// --
// The modal opens in **view mode** — every field is visible but locked,
// the user is just inspecting the property. Clicking **Edit** unlocks
// the form; the footer swaps to **Reset · Cancel · Save**:
//
//   - Edit    enter edit mode (no DB call)
//   - Reset   restore the form to the original property values, but stay
//             in edit mode (handy if the user got lost mid-change)
//   - Cancel  restore + exit edit (back to view mode); nothing persists
//   - Save    transition to the server: call updateProperty +
//             updatePropertyRates sequentially, then drop back to view
//             on success. Errors surface in the inline banner; the user
//             stays in edit mode so they can fix.
//
// Counters vs inputs
// ------------------
// Per the brand pattern: +/- counters (same shape as GuestConfig) for
// every integer count — max guests, bedrooms, bathrooms, and each bed
// type. Plain number inputs for m² (typed: integers, can be 3 digits),
// the cleaning fee €, and the two season rates.
//
// Rates
// -----
// The 12-month rate JSONB collapses behind a season abstraction:
// **Low season €X · High season €Y**, and a 12-chip month grid that
// assigns each month to one or the other. Clicking a month chip flips
// it between the two seasons. On Save we explode the season back into
// the JSONB shape the DB expects. If the host needs strictly per-month
// rates we can add an "override" toggle later, but the season model is
// what they actually think in (and what the seed reflects).
// ============================================================================

type Season = 'low' | 'high';

type FormState = {
  title: string;
  description: string;
  /** Newline-separated. */
  features: string;
  isPublic: boolean;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  king_beds: number;
  queen_beds: number;
  single_beds: number;
  sofa_beds: number;
  m2_interior: number;
  m2_terrace: number;
  cleaning_fee_eur: number;
  lowRateEur: number;
  highRateEur: number;
  monthSeason: Record<Month, Season>;
};

function toFormState(p: Property): FormState {
  // Derive the season model from the property's existing rates JSONB.
  // min → "low"; max → "high"; anything in between is assigned to whichever
  // side it's closer to. If all months share the same rate, every month is
  // "low" and high defaults to the same value — the user can split them
  // later by raising the high rate and re-tagging months.
  const cents = MONTHS.map((m) => p.rates[m] ?? 0);
  const min = Math.min(...cents);
  const max = Math.max(...cents);
  const midpoint = (min + max) / 2;
  const monthSeason = Object.fromEntries(
    MONTHS.map((m) => [m, (p.rates[m] ?? 0) >= midpoint && max > min ? 'high' : 'low']),
  ) as Record<Month, Season>;
  return {
    title: p.title,
    description: p.description,
    features: p.features.join('\n'),
    isPublic: p.public,
    max_guests: p.max_guests,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    king_beds: p.king_beds,
    queen_beds: p.queen_beds,
    single_beds: p.single_beds,
    sofa_beds: p.sofa_beds,
    m2_interior: p.m2_interior,
    m2_terrace: p.m2_terrace,
    cleaning_fee_eur: Math.round(p.cleaning_fee_cents / 100),
    lowRateEur: Math.round(min / 100),
    highRateEur: Math.round(max / 100),
    monthSeason,
  };
}

export function PropertyEditModal({
  property,
  onClose,
}: {
  property: Property;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [form, setForm] = useState<FormState>(() => toFormState(property));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const readOnly = mode === 'view';
  const label =
    PROPERTY_LABELS[property.slug as PropertySlug] ?? property.slug.toUpperCase();

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMonth(m: Month) {
    setForm((prev) => ({
      ...prev,
      monthSeason: {
        ...prev.monthSeason,
        [m]: prev.monthSeason[m] === 'low' ? 'high' : 'low',
      },
    }));
  }

  function handleReset() {
    setForm(toFormState(property));
    setError(null);
  }

  function handleCancel() {
    handleReset();
    setMode('view');
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        // Update details + capacity + cleaning + visibility.
        const detailsFd = new FormData();
        detailsFd.set('slug', property.slug);
        detailsFd.set('title', form.title);
        detailsFd.set('description', form.description);
        detailsFd.set('features', form.features);
        detailsFd.set('bedrooms', String(form.bedrooms));
        detailsFd.set('bathrooms', String(form.bathrooms));
        detailsFd.set('m2_interior', String(form.m2_interior));
        detailsFd.set('m2_terrace', String(form.m2_terrace));
        detailsFd.set('max_guests', String(form.max_guests));
        detailsFd.set('king_beds', String(form.king_beds));
        detailsFd.set('queen_beds', String(form.queen_beds));
        detailsFd.set('single_beds', String(form.single_beds));
        detailsFd.set('sofa_beds', String(form.sofa_beds));
        if (form.isPublic) detailsFd.set('public', 'on');
        detailsFd.set('cleaning_fee_eur', String(form.cleaning_fee_eur));
        await updateProperty(detailsFd);

        // Explode the season abstraction back into the per-month JSONB.
        const ratesFd = new FormData();
        ratesFd.set('slug', property.slug);
        for (const m of MONTHS) {
          const eurValue =
            form.monthSeason[m] === 'high' ? form.highRateEur : form.lowRateEur;
          ratesFd.set(`rate_${m}_eur`, String(eurValue));
        }
        await updatePropertyRates(ratesFd);

        setMode('view');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed');
      }
    });
  }

  return (
    <Modal onClose={onClose} closeOnBackdrop={readOnly && !pending}>
      <div
        className="rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader
          eyebrow={label}
          eyebrowAccent={readOnly ? 'VIEW' : 'EDIT'}
          title={property.title}
          sub={
            <span className="font-mono normal-case tracking-widest">
              {property.slug}
            </span>
          }
          onClose={onClose}
        />

        <div className="flex-1 overflow-y-auto px-5 divide-y divide-slate-100">
          {error && (
            <div className="py-4">
              <ErrorBanner message={error} />
            </div>
          )}

          {/* ─── Details ───────────────────────────────────────────── */}
          <Section
            label="Details"
            hint={
              <VisibilityHint
                isPublic={form.isPublic}
                onToggle={() => !readOnly && setField('isPublic', !form.isPublic)}
                readOnly={readOnly}
              />
            }
          >
            <div className="space-y-3">
              <Field label="Title">
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  disabled={readOnly}
                  className={INPUT_CLASS + ' disabled:bg-slate-50 disabled:text-slate-700'}
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  disabled={readOnly}
                  rows={3}
                  className={INPUT_CLASS + ' disabled:bg-slate-50 disabled:text-slate-700'}
                />
              </Field>
              <Field label="Features · one per line">
                <textarea
                  value={form.features}
                  onChange={(e) => setField('features', e.target.value)}
                  disabled={readOnly}
                  rows={3}
                  className={INPUT_CLASS + ' font-mono disabled:bg-slate-50 disabled:text-slate-700'}
                  placeholder={readOnly ? '' : 'Master Suite\nJacuzzi\nWrap-around terrace'}
                />
              </Field>
            </div>
          </Section>

          {/* ─── Capacity ──────────────────────────────────────────── */}
          <Section label="Capacity" hint={`m² uses a plain number input`}>
            <div className="space-y-1">
              <Counter
                label="Max guests"
                value={form.max_guests}
                onChange={(n) => setField('max_guests', n)}
                min={1}
                readOnly={readOnly}
              />
              <Counter
                label="Bedrooms"
                value={form.bedrooms}
                onChange={(n) => setField('bedrooms', n)}
                min={0}
                readOnly={readOnly}
              />
              <Counter
                label="Bathrooms"
                value={form.bathrooms}
                onChange={(n) => setField('bathrooms', n)}
                min={0}
                readOnly={readOnly}
              />

              <div className="pt-2 mt-2 border-t border-dashed border-slate-200">
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
                  Beds
                </p>
              </div>

              <Counter
                label="King beds"
                value={form.king_beds}
                onChange={(n) => setField('king_beds', n)}
                min={0}
                readOnly={readOnly}
              />
              <Counter
                label="Queen beds"
                value={form.queen_beds}
                onChange={(n) => setField('queen_beds', n)}
                min={0}
                readOnly={readOnly}
              />
              <Counter
                label="Single beds"
                value={form.single_beds}
                onChange={(n) => setField('single_beds', n)}
                min={0}
                readOnly={readOnly}
              />
              <Counter
                label="Sofa beds"
                value={form.sofa_beds}
                onChange={(n) => setField('sofa_beds', n)}
                min={0}
                readOnly={readOnly}
              />

              <div className="pt-3 mt-2 border-t border-dashed border-slate-200 grid grid-cols-2 gap-3">
                <Field label="m² interior">
                  <input
                    type="number"
                    min={1}
                    value={form.m2_interior}
                    onChange={(e) => setField('m2_interior', parseInt(e.target.value, 10) || 0)}
                    disabled={readOnly}
                    className={INPUT_CLASS + ' tabular-nums disabled:bg-slate-50 disabled:text-slate-700'}
                  />
                </Field>
                <Field label="m² terrace">
                  <input
                    type="number"
                    min={0}
                    value={form.m2_terrace}
                    onChange={(e) => setField('m2_terrace', parseInt(e.target.value, 10) || 0)}
                    disabled={readOnly}
                    className={INPUT_CLASS + ' tabular-nums disabled:bg-slate-50 disabled:text-slate-700'}
                  />
                </Field>
              </div>
            </div>
          </Section>

          {/* ─── Cleaning ─────────────────────────────────────────── */}
          <Section label="Cleaning" hint="goes to Tano">
            <Field label="Fee per stay">
              <EurInput
                value={form.cleaning_fee_eur}
                onChange={(n) => setField('cleaning_fee_eur', n)}
                disabled={readOnly}
              />
            </Field>
          </Section>

          {/* ─── Rates ─────────────────────────────────────────────── */}
          <Section
            label="Rates"
            hint="click a month to switch its season"
          >
            <div className="space-y-4">
              <SeasonRow
                tone="low"
                label="Low season"
                value={form.lowRateEur}
                onChange={(n) => setField('lowRateEur', n)}
                months={MONTHS.filter((m) => form.monthSeason[m] === 'low')}
                readOnly={readOnly}
              />
              <SeasonRow
                tone="high"
                label="High season"
                value={form.highRateEur}
                onChange={(n) => setField('highRateEur', n)}
                months={MONTHS.filter((m) => form.monthSeason[m] === 'high')}
                readOnly={readOnly}
              />

              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">
                  All 12 months
                </p>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                  {MONTHS.map((m) => {
                    const season = form.monthSeason[m];
                    const rate = season === 'high' ? form.highRateEur : form.lowRateEur;
                    return (
                      <MonthChip
                        key={m}
                        month={m}
                        season={season}
                        rate={rate}
                        readOnly={readOnly}
                        onClick={() => toggleMonth(m)}
                      />
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Resolved JSONB on save:
                  <span className="font-mono text-slate-400 ml-1">
                    €{form.lowRateEur} × {MONTHS.filter((m) => form.monthSeason[m] === 'low').length}m
                    {' + '}
                    €{form.highRateEur} × {MONTHS.filter((m) => form.monthSeason[m] === 'high').length}m
                  </span>
                </p>
              </div>
            </div>
          </Section>
        </div>

        {/* ─── Footer ─────────────────────────────────────────────── */}
        <footer className="flex items-center justify-between gap-2 p-4 border-t border-slate-100 bg-slate-50/60">
          {readOnly ? (
            <>
              <p className="text-[11px] text-slate-400">
                Changes apply to <span className="font-bold">new bookings only</span> · existing bookings keep their snapshotted prices.
              </p>
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-mono uppercase tracking-widest hover:bg-ocean transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleReset}
                disabled={pending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-40"
                >
                  <Undo2 className="w-3.5 h-3.5" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={pending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ocean text-white text-xs font-mono uppercase tracking-widest hover:bg-ocean/90 transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {pending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          )}
        </footer>
      </div>
    </Modal>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function VisibilityHint({
  isPublic,
  onToggle,
  readOnly,
}: {
  isPublic: boolean;
  onToggle: () => void;
  readOnly: boolean;
}) {
  const Icon = isPublic ? Eye : EyeOff;
  const text = isPublic ? 'Public' : 'Hidden';
  const tone = isPublic
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-slate-100 text-slate-600';
  if (readOnly) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-widest ${tone}`}
      >
        <Icon className="w-3 h-3" /> {text}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-widest transition-colors ${tone} hover:ring-2 hover:ring-ocean/30`}
      title="Click to toggle public / hidden"
    >
      <Icon className="w-3 h-3" /> {text}
    </button>
  );
}

function Counter({
  label,
  value,
  onChange,
  min,
  readOnly,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  readOnly: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
        {label}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {!readOnly && (
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - 1))}
            disabled={value <= min}
            aria-label={`Decrease ${label}`}
            className="w-7 h-7 rounded-full border border-slate-200 grid place-items-center text-slate-500 hover:border-ocean hover:text-ocean transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Minus className="w-3 h-3" />
          </button>
        )}
        <span className="w-6 text-center font-bold text-slate-900 text-sm tabular-nums">
          {value}
        </span>
        {!readOnly && (
          <button
            type="button"
            onClick={() => onChange(value + 1)}
            aria-label={`Increase ${label}`}
            className="w-7 h-7 rounded-full border border-slate-200 grid place-items-center text-slate-500 hover:border-ocean hover:text-ocean transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function EurInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        <Euro className="w-4 h-4" />
      </span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        disabled={disabled}
        className={INPUT_CLASS + ' pl-9 tabular-nums disabled:bg-slate-50 disabled:text-slate-700'}
      />
    </div>
  );
}

function SeasonRow({
  tone,
  label,
  value,
  onChange,
  months,
  readOnly,
}: {
  tone: Season;
  label: string;
  value: number;
  onChange: (n: number) => void;
  months: readonly Month[];
  readOnly: boolean;
}) {
  const accent = tone === 'high'
    ? 'border-ocean/40 bg-ocean/5'
    : 'border-slate-200 bg-slate-50';
  return (
    <div className={`rounded-2xl border ${accent} p-3`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {label}
        </p>
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
          {months.length} {months.length === 1 ? 'month' : 'months'}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="w-32">
          <EurInput value={value} onChange={onChange} disabled={readOnly} />
        </div>
        <span className="text-xs text-slate-400">/ night</span>
        <span className="ml-auto text-xs font-mono text-slate-500 tabular-nums">
          ={eur(value * 100)}
        </span>
      </div>
    </div>
  );
}

const MONTH_LABELS: Record<Month, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
};

function MonthChip({
  month,
  season,
  rate,
  readOnly,
  onClick,
}: {
  month: Month;
  season: Season;
  rate: number;
  readOnly: boolean;
  onClick: () => void;
}) {
  const tone = season === 'high'
    ? 'bg-ocean/10 text-ocean border-ocean/30'
    : 'bg-slate-50 text-slate-700 border-slate-200';
  const interactive = !readOnly
    ? 'hover:scale-105 cursor-pointer'
    : 'cursor-default';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={readOnly}
      aria-pressed={season === 'high'}
      className={`flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg border ${tone} ${interactive} transition-transform disabled:hover:scale-100`}
    >
      <span className="text-[10px] font-mono uppercase tracking-widest opacity-70">
        {MONTH_LABELS[month]}
      </span>
      <span className="text-xs font-bold tabular-nums">€{rate}</span>
    </button>
  );
}
