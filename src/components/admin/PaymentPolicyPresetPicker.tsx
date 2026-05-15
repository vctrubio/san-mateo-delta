'use client';

import { Split, CreditCard, Banknote, AlertTriangle } from 'lucide-react';
import {
  PAYMENT_POLICY_KEYS,
  PAYMENT_PRESETS,
  resolvePolicy,
  type PaymentPolicyKey,
} from '@/lib/payment';
import { todayYmd } from '@/lib/dates';

// ============================================================================
// PaymentPolicyPresetPicker — 2×2 grid of preset tiles for the admin's
// booking creation modal. Picks from the same vocabulary the estate-wide
// switcher uses (/admin/payments), so the booking's policy is one of the
// four named presets. No free-form fields.
//
// When the picked split policy can't accommodate its balance window before
// the booking's check-in date, we surface a caption explaining that the
// system will collapse to 100% upfront at submit time. The actual
// collapse runs inside `resolvePolicy` in src/lib/payment.ts — server-side
// at insert and previewed here on the client.
// ============================================================================

const ICONS: Record<PaymentPolicyKey, typeof CreditCard> = {
  split_14: Split,
  split_7:  Split,
  full_now: CreditCard,
  cash:     Banknote,
};

export default function PaymentPolicyPresetPicker({
  value,
  onChange,
  checkInYmd,
}: {
  value: PaymentPolicyKey;
  onChange: (v: PaymentPolicyKey) => void;
  /** YYYY-MM-DD of this booking's check-in. Drives the too-close caption. */
  checkInYmd: string;
}) {
  const today = todayYmd();
  const requested = PAYMENT_PRESETS[value].policy;
  const resolved = resolvePolicy(requested, checkInYmd, today);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {PAYMENT_POLICY_KEYS.map((k) => {
          const preset = PAYMENT_PRESETS[k];
          const Icon = ICONS[k];
          const active = k === value;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange(k)}
              aria-pressed={active}
              className={[
                'text-left p-3 rounded-xl transition-colors',
                active
                  ? 'bg-slate-900 text-white ring-1 ring-slate-900'
                  : 'bg-white text-slate-900 ring-1 ring-slate-200 hover:ring-slate-400',
              ].join(' ')}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[10px] font-mono uppercase tracking-widest opacity-80">
                  {preset.policy.method === 'cash' ? 'Cash' : `${preset.policy.deposit_pct}% now`}
                </span>
              </div>
              <p className={['text-[12px] leading-snug', active ? 'text-white' : 'text-slate-700'].join(' ')}>
                {preset.label}
              </p>
            </button>
          );
        })}
      </div>

      {resolved.collapsed && (
        <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-900 leading-relaxed">
            <strong>Collapses to 100% upfront at submit.</strong>{' '}
            {resolved.collapseReason}
          </div>
        </div>
      )}
    </div>
  );
}
