'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, Wand2 } from 'lucide-react';
import { updatePropertyRates } from '@/actions/properties';
import { MONTHS, MONTH_NAMES, type Month } from '@db/enums';
import type { RatesByMonth } from '@/lib/properties';

// ============================================================================
// PropertyRateForm — 12-row editable grid, one cents-per-night value per
// calendar month. Replaces the old multi-row property_rates editor. The
// JSONB column on `properties` always carries all 12 months; this form
// guarantees the shape on submit.
//
// Two presets help fill it quickly:
//   - "Set all to X"            — flat rate
//   - "Low/High split"          — Jun-Aug at one rate, rest at another
//
// Submits updatePropertyRates → re-validates server-side → CHECK constraint
// rejects anything missing a key.
// ============================================================================

export type PropertyRateFormProps = {
  slug: string;
  rates: RatesByMonth;
};

function eurOfCents(c: number): number {
  return Math.round(c / 100);
}

export default function PropertyRateForm({ slug, rates: initial }: PropertyRateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local state in EUR (whole), one entry per month.
  const [eur, setEur] = useState<Record<Month, number>>(() => {
    const out = {} as Record<Month, number>;
    for (const m of MONTHS) out[m] = eurOfCents(initial[m] ?? 0);
    return out;
  });

  const [bulk, setBulk] = useState<string>('');
  const [low, setLow] = useState<string>('');
  const [high, setHigh] = useState<string>('');

  function setMonth(m: Month, v: string) {
    const n = v === '' ? 0 : parseInt(v, 10);
    if (!Number.isFinite(n) || n < 0) return;
    setEur((s) => ({ ...s, [m]: n }));
  }

  function applyAll() {
    const n = parseInt(bulk, 10);
    if (!Number.isFinite(n) || n < 0) return;
    const next = {} as Record<Month, number>;
    for (const m of MONTHS) next[m] = n;
    setEur(next);
  }

  function applySplit() {
    const lo = parseInt(low, 10);
    const hi = parseInt(high, 10);
    if (!Number.isFinite(lo) || lo < 0) return;
    if (!Number.isFinite(hi) || hi < 0) return;
    const next = {} as Record<Month, number>;
    for (const m of MONTHS) next[m] = m >= 6 && m <= 8 ? hi : lo;
    setEur(next);
  }

  const total = useMemo(() => {
    return MONTHS.reduce((sum, m) => sum + eur[m], 0);
  }, [eur]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData();
    fd.set('slug', slug);
    for (const m of MONTHS) {
      fd.set(`rate_${m}_eur`, String(eur[m]));
    }

    startTransition(async () => {
      try {
        await updatePropertyRates(fd);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed.');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Presets row */}
      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
        <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
          <Wand2 className="w-3 h-3" /> Quick fill
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PresetCard label="Flat rate" hint="Set every month to the same value">
            <EurInput value={bulk} onChange={setBulk} placeholder="350" />
            <button type="button" onClick={applyAll}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono uppercase tracking-widest text-slate-700 hover:border-ocean hover:text-ocean">
              Apply to all 12
            </button>
          </PresetCard>
          <PresetCard label="Low / High split" hint="Jun-Aug at one rate; the rest at another">
            <div className="flex items-center gap-2">
              <EurInput value={low}  onChange={setLow}  placeholder="350" />
              <span className="text-xs font-mono text-slate-400">low</span>
            </div>
            <div className="flex items-center gap-2">
              <EurInput value={high} onChange={setHigh} placeholder="480" />
              <span className="text-xs font-mono text-slate-400">high</span>
            </div>
            <button type="button" onClick={applySplit}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono uppercase tracking-widest text-slate-700 hover:border-ocean hover:text-ocean">
              Apply split
            </button>
          </PresetCard>
        </div>
      </div>

      {/* The 12-month grid */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs font-mono uppercase tracking-widest text-slate-400">
              <th className="text-left px-4 py-2">Month</th>
              <th className="text-left px-4 py-2">Season</th>
              <th className="text-right px-4 py-2">€ / night</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((m) => {
              const isHigh = m >= 6 && m <= 8;
              return (
                <tr key={m} className="border-t border-slate-50">
                  <td className="px-4 py-2 font-bold text-slate-900">{MONTH_NAMES[m]}</td>
                  <td className="px-4 py-2 text-xs">
                    {isHigh ? (
                      <span className="font-mono uppercase text-amber-700 bg-amber-50 ring-1 ring-amber-200 px-1.5 py-0.5 rounded">high</span>
                    ) : (
                      <span className="font-mono uppercase text-slate-500">low</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="inline-flex items-center bg-white rounded-lg ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-ocean/30 focus-within:border-ocean">
                      <span className="px-2 text-slate-400 text-sm">€</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={eur[m]}
                        onChange={(e) => setMonth(m, e.target.value)}
                        className="w-24 px-2 py-2 text-sm text-right tabular-nums focus:outline-none bg-transparent"
                      />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-100">
              <td className="px-4 py-2 font-mono text-xs uppercase tracking-widest text-slate-400" colSpan={2}>Sum (12-month total)</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-700">
                €{total.toLocaleString('es-ES')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-[0.2em] hover:bg-ocean transition disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {isPending ? 'Saving…' : 'Save rates'}
        </button>
        <p className="text-xs text-slate-400">
          Existing bookings keep their snapshot — rate changes only affect new requests.
        </p>
      </div>
    </form>
  );
}

function PresetCard({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white border border-slate-100 p-3">
      <div className="text-xs font-mono uppercase tracking-widest text-slate-700">{label}</div>
      <div className="text-xs text-slate-400 mb-2">{hint}</div>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}

function EurInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <span className="inline-flex items-center bg-white rounded-lg ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-ocean/30">
      <span className="px-2 text-slate-400 text-sm">€</span>
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-20 px-2 py-1.5 text-sm text-right tabular-nums focus:outline-none bg-transparent"
      />
    </span>
  );
}
