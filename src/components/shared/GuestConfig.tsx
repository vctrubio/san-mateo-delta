'use client';

import { Minus, Plus } from 'lucide-react';

// ============================================================================
// GuestConfig — the single, reusable guest-count picker. Mirrors the shape of
// `bookings.guests` JSONB exactly so the value is form-submit-ready.
//
// Use this anywhere the app needs adults / children / infants / pets:
//   · admin Add Booking modal
//   · public /finca/[slug] booking form
//   · invitation new-booking flow
//   · anywhere else
//
// `totalGuests` (adults + children + infants — pets are tracked separately) is
// the canonical "how many people" helper. Import it instead of recomputing.
// ============================================================================

export type GuestCounts = {
  adults: number;
  children: number;
  infants: number;
  pets: number;
};

export const DEFAULT_GUESTS: GuestCounts = {
  adults: 2,
  children: 0,
  infants: 0,
  pets: 0,
};

/** Sum of human guests. Pets are excluded — they have their own column on the booking. */
export function totalGuests(g: GuestCounts): number {
  return g.adults + g.children + g.infants;
}

type Row = { key: keyof GuestCounts; label: string; sub: string; min: number };

const ROWS: readonly Row[] = [
  { key: 'adults',   label: 'Adults',   sub: 'Ages 18+',    min: 1 },
  { key: 'children', label: 'Children', sub: 'Ages 2–17',   min: 0 },
  { key: 'infants',  label: 'Infants',  sub: 'Under 2',     min: 0 },
  { key: 'pets',     label: 'Pets',     sub: 'Dogs / cats', min: 0 },
];

export default function GuestConfig({
  value,
  onChange,
  maxGuests,
  hidePets = false,
  hideInfants = false,
}: {
  value: GuestCounts;
  onChange: (next: GuestCounts) => void;
  /** Property capacity. Caps adults+children+infants collectively. Pets unaffected. */
  maxGuests?: number;
  hidePets?: boolean;
  hideInfants?: boolean;
}) {
  const rows = ROWS.filter(
    (r) => (r.key !== 'pets' || !hidePets) && (r.key !== 'infants' || !hideInfants),
  );

  const total = totalGuests(value);
  const overCap = maxGuests != null && total > maxGuests;

  function set(key: keyof GuestCounts, n: number) {
    onChange({ ...value, [key]: Math.max(0, n) });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/50">
      <div className="divide-y divide-slate-100">
        {rows.map((r) => {
          const v = value[r.key];
          // Cap human-guest rows at maxGuests; pets are independent.
          const isGuestRow = r.key !== 'pets';
          const canIncrement = !isGuestRow || maxGuests == null || total < maxGuests;
          return (
            <Counter
              key={r.key}
              label={r.label}
              sub={r.sub}
              value={v}
              canDecrement={v > r.min}
              canIncrement={canIncrement}
              onDecrement={() => set(r.key, v - 1)}
              onIncrement={() => set(r.key, v + 1)}
            />
          );
        })}
      </div>

      <div className="flex items-baseline justify-between px-5 py-3 border-t border-slate-100">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Total</span>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-base font-bold tabular-nums ${overCap ? 'text-rose-700' : 'text-slate-900'}`}>
            {total}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
            {total === 1 ? 'guest' : 'guests'}
            {maxGuests != null ? ` / max ${maxGuests}` : ''}
          </span>
          {value.pets > 0 && (
            <span className="ml-2 text-[10px] font-mono uppercase tracking-widest text-ocean">
              + {value.pets} {value.pets === 1 ? 'pet' : 'pets'}
            </span>
          )}
        </div>
      </div>

      {overCap && (
        <p className="px-5 pb-3 text-xs text-rose-700">
          Property max is {maxGuests} guests — over by {total - maxGuests}.
        </p>
      )}
    </div>
  );
}

function Counter({
  label, sub, value, canDecrement, canIncrement, onDecrement, onIncrement,
}: {
  label: string;
  sub: string;
  value: number;
  canDecrement: boolean;
  canIncrement: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div className="min-w-0">
        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">{label}</div>
        <div className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-0.5">{sub}</div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onDecrement}
          disabled={!canDecrement}
          aria-label={`Decrease ${label}`}
          className="w-7 h-7 rounded-full border border-slate-200 grid place-items-center text-slate-500 hover:border-ocean hover:text-ocean transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-5 text-center font-bold text-slate-900 text-sm tabular-nums">{value}</span>
        <button
          type="button"
          onClick={onIncrement}
          disabled={!canIncrement}
          aria-label={`Increase ${label}`}
          className="w-7 h-7 rounded-full border border-slate-200 grid place-items-center text-slate-500 hover:border-ocean hover:text-ocean transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
