'use client';

import { type ReactNode } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Equal, X, ArrowLeft } from 'lucide-react';

// ============================================================================
// modalKit — the shared visual language for admin modals (selection-action,
// booking-action, future siblings). Anything that wants the same look pulls
// from here instead of redefining it. Keeping these small and primitive on
// purpose: a Section is just a label + content with vertical padding, a
// PickerTile is a single tile shape with one variant axis, etc.
// ============================================================================

// ─── Card shell ─────────────────────────────────────────────────────────────
//
// The outer card every admin modal uses. Caller is expected to wrap this in
// the shared <Modal> component and provide the body; this just stamps out
// the consistent rounded-2xl/border/shadow + flex+max-h treatment so all
// modal bodies feel identical.
export const MODAL_CARD_CLASS =
  'rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 w-full max-w-xl max-h-[90vh] flex flex-col';

// Common input class used across forms.
export const INPUT_CLASS =
  'w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean';

// ─── Modal header ───────────────────────────────────────────────────────────
//
// Two-line header: small uppercase eyebrow (status/mode + slug accent) on
// top, big bold title (typically a date range) underneath. Optional sub line
// for relative-time hints ("in 12 days"). Optional back arrow for modals
// that have inner navigation.
export function ModalHeader({
  eyebrow, eyebrowAccent, title, sub, onClose, onBack,
}: {
  eyebrow: string;
  /** Highlighted suffix shown in ocean to the right of the eyebrow. */
  eyebrowAccent?: string;
  title: ReactNode;
  /** Optional second line under the title — e.g. "in 12 days". */
  sub?: ReactNode;
  onClose: () => void;
  onBack?: () => void;
}) {
  return (
    <header className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
      <div className="min-w-0 flex items-start gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-400">
            {eyebrow}
            {eyebrowAccent && <span className="text-ocean ml-2">{eyebrowAccent}</span>}
          </p>
          <p className="text-base font-bold tracking-tight text-slate-900 mt-0.5">
            {title}
          </p>
          {sub && (
            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-widest mt-1">
              {sub}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 shrink-0"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </header>
  );
}

// ─── Sections ───────────────────────────────────────────────────────────────
//
// Section is the anchor unit inside a modal body. Use a `divide-y` wrapper
// around a list of <Section>s and they'll get hairline dividers between
// them automatically.
export function Section({
  label, hint, children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="py-5 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <h3 className="text-xs font-mono uppercase tracking-[0.3em] text-ocean font-bold">
          {label}
        </h3>
        {hint && (
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Field ──────────────────────────────────────────────────────────────────

export function Field({
  label, children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

// ─── PickerTile ─────────────────────────────────────────────────────────────
//
// Single shape used for any pickable option (guest mode, status, payment
// choice, action button). One look, one set of states. The `accent` flag
// flips the active ring to emerald — used for the "primary" pick in a binary
// chooser like Confirm-now.
export function PickerTile({
  active, onClick, label, sub, icon, accent, disabled, danger,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub?: string;
  icon?: ReactNode;
  accent?: boolean;
  disabled?: boolean;
  /** Use for destructive buttons (e.g. Cancel). Switches the active ring
   *  to rose and the hover state too. */
  danger?: boolean;
}) {
  let activeClass: string;
  if (danger) activeClass = 'border-rose-300 ring-2 ring-rose-100 text-rose-900';
  else if (accent) activeClass = 'border-emerald-400 ring-2 ring-emerald-100 text-slate-900';
  else activeClass = 'border-ocean ring-2 ring-ocean/15 text-slate-900';

  const hoverClass = danger
    ? 'hover:border-rose-300 hover:text-rose-700'
    : 'hover:border-slate-300';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={[
        'rounded-xl px-3 py-2.5 text-left transition border bg-white',
        active ? activeClass : `border-slate-200 text-slate-600 ${hoverClass}`,
        disabled ? 'opacity-40 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <span className="flex items-center gap-1.5 text-sm font-bold">
        {icon}
        {label}
      </span>
      {sub && (
        <span className="block text-[11px] text-slate-500 tabular-nums mt-0.5">{sub}</span>
      )}
    </button>
  );
}

// ─── DiffStrip ──────────────────────────────────────────────────────────────

export function DiffStrip({
  diffCents, diffPct,
}: {
  diffCents: number;
  diffPct: number;
}) {
  if (diffCents === 0) {
    return (
      <div className="rounded-lg border border-slate-200 px-3 py-2 flex items-center gap-2 text-[11px] text-slate-600">
        <Equal className="w-3 h-3" />
        Matches default
      </div>
    );
  }
  const negative = diffCents < 0;
  const tone = negative
    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
    : 'bg-amber-50 border-amber-200 text-amber-900';
  const Icon = negative ? ArrowDown : ArrowUp;
  return (
    <div className={`rounded-lg border px-3 py-2 flex items-center gap-2 text-[11px] ${tone}`}>
      <Icon className="w-3 h-3" />
      <span>
        <strong>{negative ? 'Discount' : 'Premium'}</strong>:{' '}
        {negative ? '−' : '+'}{eur(Math.abs(diffCents))}
        {Math.abs(diffPct) > 0 && <> · {negative ? '−' : '+'}{Math.abs(diffPct)}%</>}
      </span>
    </div>
  );
}

// ─── ErrorBanner ────────────────────────────────────────────────────────────

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-900 flex items-start gap-2">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      {message}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(cents / 100);
}

// Relative date language used in modal headers. Rules:
//   - today < check-in   → "in N days" (or "tomorrow"/"today")
//   - check-in ≤ today < check-out  → "Day X of N"
//   - today ≥ check-out  → "ended N days ago"
// Dates come in as YYYY-MM-DD; comparisons are at day granularity in the
// browser's local zone.
export function relativeStayLabel(startYmd: string, endYmd: string): string {
  const today = startOfDay(new Date());
  const start = parseYmd(startYmd);
  const end   = parseYmd(endYmd);
  const day = 86_400_000;

  const totalNights = Math.round((end.getTime() - start.getTime()) / day);

  if (today.getTime() < start.getTime()) {
    const days = Math.round((start.getTime() - today.getTime()) / day);
    if (days === 0) return 'check-in today';
    if (days === 1) return 'tomorrow';
    return `in ${days} days`;
  }
  if (today.getTime() < end.getTime()) {
    const elapsed = Math.round((today.getTime() - start.getTime()) / day);
    return `day ${elapsed + 1} of ${totalNights}`;
  }
  const days = Math.round((today.getTime() - end.getTime()) / day);
  if (days === 0) return 'checked out today';
  if (days === 1) return 'ended yesterday';
  return `ended ${days} days ago`;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
