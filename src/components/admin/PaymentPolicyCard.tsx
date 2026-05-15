import { updateActivePaymentPolicy } from '@/actions/settings';
import { CheckCircle2, CreditCard, Banknote, Split, Coins } from 'lucide-react';
import type { PaymentPolicyKey } from '@/lib/payment';

// ============================================================================
// PaymentPolicyCard — single preset tile on /admin/payments. Submits to
// `updateActivePaymentPolicy` via a tiny inline form, no client JS needed.
// One card per preset; the currently-active key gets a highlighted ring +
// "Current" badge. Submit is disabled on the active card so clicking it
// doesn't re-fire the same UPDATE.
// ============================================================================

const ICONS: Record<PaymentPolicyKey, typeof CreditCard> = {
  split_14: Split,
  split_7:  Split,
  full_now: CreditCard,
  cash:     Banknote,
};

export default function PaymentPolicyCard({
  presetKey,
  label,
  description,
  active,
}: {
  presetKey: PaymentPolicyKey;
  label: string;
  description: string;
  active: boolean;
}) {
  const Icon = ICONS[presetKey] ?? Coins;
  return (
    <form
      action={updateActivePaymentPolicy}
      className={[
        'rounded-2xl p-5 bg-white transition-all',
        active
          ? 'border-2 border-emerald-500 shadow-[0_4px_24px_-12px_rgba(16,185,129,0.35)]'
          : 'border border-slate-200 hover:border-slate-400 hover:shadow-sm',
      ].join(' ')}
    >
      <input type="hidden" name="key" value={presetKey} />

      <div className="flex items-start justify-between gap-3 mb-3">
        <span
          className={[
            'shrink-0 grid place-items-center w-10 h-10 rounded-xl',
            active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
          ].join(' ')}
        >
          <Icon className="w-5 h-5" />
        </span>
        {active && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 text-[10px] font-mono uppercase tracking-widest">
            <CheckCircle2 className="w-3 h-3" />
            Current
          </span>
        )}
      </div>

      <h3 className="text-sm font-bold text-slate-900 tracking-tight">
        {label}
      </h3>
      <p className="text-[12px] text-slate-500 leading-relaxed mt-1 mb-4">
        {description}
      </p>

      <button
        type="submit"
        disabled={active}
        className={[
          'w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[11px] font-mono uppercase tracking-widest font-bold transition',
          active
            ? 'bg-emerald-50 text-emerald-700 cursor-not-allowed'
            : 'bg-slate-900 text-white hover:bg-ocean',
        ].join(' ')}
      >
        {active ? 'Active' : 'Switch to this'}
      </button>
    </form>
  );
}
