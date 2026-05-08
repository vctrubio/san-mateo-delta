import { upsertRate, deleteRate } from '@/actions/properties';
import { MONTHS, MONTH_NAMES } from '@db/enums';
import type { PropertyRate } from '@/lib/properties';

export default function RatesAdmin({
  slug,
  rates,
}: {
  slug: string;
  rates: PropertyRate[];
}) {
  return (
    <div className="space-y-3">
      {rates.map((r) => (
        <RateRow key={r.id} slug={slug} rate={r} />
      ))}
      <RateRow slug={slug} />
    </div>
  );
}

function RateRow({ slug, rate }: { slug: string; rate?: PropertyRate }) {
  const isNew = !rate;
  const months = rate?.months ?? [];

  return (
    <form
      action={upsertRate}
      className={`rounded-2xl border ${isNew ? 'border-dashed border-slate-200 bg-slate-50' : 'border-slate-100 bg-white'} p-5`}
    >
      <input type="hidden" name="slug" value={slug} />
      {rate && <input type="hidden" name="rate_id" value={rate.id} />}

      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h4 className="text-sm font-bold text-slate-900">
          {isNew ? 'New rate' : rate.name}
          {!isNew && !rate.active && <span className="ml-2 text-[10px] font-mono text-slate-400 uppercase tracking-widest">inactive</span>}
        </h4>
        {!isNew && (
          <DeleteButton slug={slug} rateId={rate.id} />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <Field label="Name" name="name" defaultValue={rate?.name ?? ''} placeholder="e.g. Easter Shoulder" required />
        <Field label="Min nights" name="min_nights" type="number" min={1} defaultValue={rate?.min_nights ?? 2} required />
        <Field label="Night rate (€)" name="night_rate_eur" type="number" min={0} defaultValue={(rate?.night_rate_cents ?? 0) / 100} required />
      </div>

      <div className="mb-3">
        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">Months</div>
        <div className="flex flex-wrap gap-2">
          {MONTHS.map((m) => (
            <label key={m} className="inline-flex items-center gap-1.5 text-[12px] cursor-pointer">
              <input
                type="checkbox"
                name={`month_${m}`}
                defaultChecked={months.includes(m)}
                className="rounded border-slate-300 text-ocean focus:ring-ocean/30"
              />
              <span>{MONTH_NAMES[m].slice(0, 3)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <label className="inline-flex items-center gap-2 text-[12px]">
          <input type="checkbox" name="active" defaultChecked={rate?.active ?? true} className="rounded border-slate-300 text-ocean focus:ring-ocean/30" />
          Active
        </label>
        <label className="inline-flex items-center gap-2 text-[12px]">
          <input type="checkbox" name="public" defaultChecked={rate?.public ?? true} className="rounded border-slate-300 text-ocean focus:ring-ocean/30" />
          Public (false = invite-only)
        </label>
      </div>

      <button
        type="submit"
        className={
          isNew
            ? 'px-5 py-2 rounded-lg bg-ocean text-white text-[11px] font-mono uppercase tracking-widest hover:bg-slate-900 transition-colors'
            : 'px-5 py-2 rounded-lg bg-slate-900 text-white text-[11px] font-mono uppercase tracking-widest hover:bg-ocean transition-colors'
        }
      >
        {isNew ? 'Add rate' : 'Save rate'}
      </button>
    </form>
  );
}

function DeleteButton({ slug, rateId }: { slug: string; rateId: string }) {
  return (
    <form action={deleteRate}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="rate_id" value={rateId} />
      <button
        type="submit"
        className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-500 text-[10px] font-mono uppercase tracking-widest hover:border-rose-300 hover:text-rose-700 transition-colors"
      >
        Delete
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  required,
  min,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
  min?: number;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        min={min}
        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
      />
    </label>
  );
}
