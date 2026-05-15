import type { Property } from '@/lib/properties';
import type { PaymentPolicy } from '@/lib/payment';
import { describePolicy } from '@/lib/payment';
import { eur } from '@/lib/format';
import { HIGH_SEASON_MONTHS, MONTH_NAMES, type Month } from '@db/enums';

// ============================================================================
// PropertyPrices — read-only summary of what a stay costs.
//
// Three lines + a footer:
//   - LOW SEASON   €X / night   (every month not in HIGH_SEASON_MONTHS)
//   - HIGH SEASON  €Y / night   (Jun · Jul · Aug)
//   - CLEANING     €Z one-off   (goes to Tano — same fee snapshotted onto
//                                bookings via agreed_cleaning_cents)
//   ─────
//   DEPOSIT POLICY
//   <describePolicy(active.policy)>
//
// Rates are read from `property.rates` (jsonb, € cents per night per month).
// If a month within a season has a different rate from its siblings (admin
// has set varied pricing), the row shows the range — but the seed keeps
// season-uniform values so today it's a single number per row.
//
// The "deposit policy" line is the estate-wide active policy at page-load
// time; it can change later, and the actual snapshot a guest sees on
// their booking is frozen at request time (see docs/payment.md).
// ============================================================================

function seasonRange(
  rates: Property['rates'],
  months: readonly Month[],
): { low: number; high: number } {
  const vals = months.map((m) => rates[m]);
  return { low: Math.min(...vals), high: Math.max(...vals) };
}

function formatRange(low: number, high: number): string {
  if (low === high) return eur(low);
  return `${eur(low)} – ${eur(high)}`;
}

function lowSeasonMonths(): Month[] {
  const high = new Set<number>(HIGH_SEASON_MONTHS);
  return ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as Month[]).filter(
    (m) => !high.has(m),
  );
}

function formatMonths(months: readonly Month[]): string {
  if (months.length === 0) return '';
  const first = MONTH_NAMES[months[0]];
  const last = MONTH_NAMES[months[months.length - 1]];
  if (months.length === 1) return first;
  return `${first}–${last}`;
}

export function PropertyPrices({
  property,
  activePolicy,
}: {
  property: Property;
  activePolicy: PaymentPolicy;
}) {
  const highMonths = HIGH_SEASON_MONTHS;
  const lowMonths = lowSeasonMonths();
  const highRange = seasonRange(property.rates, highMonths);
  const lowRange = seasonRange(property.rates, lowMonths);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-4xl">
      {/* Left — rate rows. Bordered top + bottom, divided between rows. */}
      <ul className="divide-y divide-slate-200 border-y border-slate-200">
        <PriceRow
          label="Low season"
          sub={`${formatMonths(lowMonths)} · per night`}
          value={formatRange(lowRange.low, lowRange.high)}
        />
        <PriceRow
          label="High season"
          sub={`Jun · Jul · Aug · per night`}
          value={formatRange(highRange.low, highRange.high)}
        />
        <PriceRow
          label="Cleaning"
          sub="One-off, per stay"
          value={eur(property.cleaning_fee_cents)}
        />
      </ul>

      {/* Right — deposit policy. Borderless so it reads lighter than the
          rate column on its left; the eyebrow is the only structural
          cue, the rest is plain prose. */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-400 mb-3">
          Deposit policy
        </p>
        <p className="text-slate-700 leading-relaxed">
          {describePolicy(activePolicy)}
        </p>
        <p className="mt-3 text-xs text-slate-400 leading-relaxed">
          Estate-wide setting; the exact terms are snapshotted onto your
          booking the moment it's confirmed and never change after.
        </p>
      </div>
    </div>
  );
}

function PriceRow({
  label,
  sub,
  value,
}: {
  label: string;
  sub: string;
  value: string;
}) {
  return (
    <li className="flex items-baseline justify-between gap-4 py-4">
      <div>
        <p className="text-sm font-bold text-slate-900">{label}</p>
        <p className="text-[11px] font-mono uppercase tracking-widest text-slate-400 mt-0.5">
          {sub}
        </p>
      </div>
      <p className="text-lg font-mono font-semibold text-slate-900 tabular-nums">
        {value}
      </p>
    </li>
  );
}
