import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { perPropertyMoney } from '@/lib/dashboard';
import { PROPERTY_LABELS } from '@/lib/colors';

// ============================================================================
// Four cards, one per property. Each card shows money split between David
// (host, agreed_property_cents) and Tano (cleaner, agreed_cleaning_cents),
// plus the total and the booking count. A two-segment bar visualises the
// David/Tano proportion at a glance.
// ============================================================================

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function PerPropertyMoneyStrip() {
  const rows = await perPropertyMoney();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {rows.map((r) => {
        const davidPct = r.total_cents === 0 ? 0 : Math.round((r.david_cents / r.total_cents) * 100);
        const tanoPct = 100 - davidPct;
        return (
          <Link
            key={r.slug}
            href={`/admin/properties/${r.slug}`}
            className="group rounded-2xl bg-white border border-slate-100 p-5 hover:border-ocean hover:shadow-lg hover:shadow-ocean/5 transition-all"
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: `var(--color-property-${r.slug})` }}
              />
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-ocean transition-colors">
                {PROPERTY_LABELS[r.slug]}
              </h4>
              <ArrowRight className="ml-auto w-3.5 h-3.5 text-slate-300 group-hover:text-ocean group-hover:translate-x-0.5 transition-all" />
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Total
                </span>
                <span className="text-xl font-bold text-slate-900 tabular-nums">
                  {eur(r.total_cents)}
                </span>
              </div>

              {/* Two-segment split bar */}
              <div className="h-2 w-full rounded-full overflow-hidden bg-slate-100 flex">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${davidPct}%`,
                    backgroundColor: `var(--color-property-${r.slug})`,
                  }}
                  title={`David ${davidPct}%`}
                />
                <div
                  className="h-full bg-amber-300 transition-all"
                  style={{ width: `${tanoPct}%` }}
                  title={`Tano ${tanoPct}%`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <Split
                  label="David"
                  amount={r.david_cents}
                  pct={davidPct}
                  dotColor={`var(--color-property-${r.slug})`}
                />
                <Split
                  label="Tano"
                  amount={r.tano_cents}
                  pct={tanoPct}
                  dotColor="rgb(252 211 77)"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                    Held bookings
                  </span>
                  <span className="text-sm font-bold text-slate-700 tabular-nums">
                    {r.bookings}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function Split({
  label,
  amount,
  pct,
  dotColor,
}: {
  label: string;
  amount: number;
  pct: number;
  dotColor: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
          {label} · {pct}%
        </span>
      </div>
      <div className="text-[12px] font-bold text-slate-900 tabular-nums mt-0.5">
        {eur(amount)}
      </div>
    </div>
  );
}
