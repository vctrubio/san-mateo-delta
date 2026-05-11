'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Search,
  X,
  LayoutGrid,
  Calendar,
  Archive,
  ChevronRight,
} from 'lucide-react';
import Modal from '@/components/shared/Modal';
import StatusBadge from './StatusBadge';
import type { BookingChipSource } from '@/lib/bookingAdapters';
import { paymentState, type PaymentState } from '@/lib/bookingState';
import { todayYmd, fmtDateRange, nightsBetween } from '@/lib/dates';
import { PROPERTY_SLUGS, type PropertySlug } from '@/lib/colors';

// ============================================================================
// AdminSearchBell — search icon in the admin nav. Opens a modal that
// lists bookings with three filter axes:
//   1. Scope toggle: Upcoming (default) vs All
//   2. Property chips: All / per-property
//   3. Search input: matches guest name + email
//
// Each row links to /admin/bookings/[id]. usePathname → setOpen(false)
// closes the modal on navigation so the destination page is unobstructed.
// ============================================================================

type Scope = 'upcoming' | 'all';

export function AdminSearchBell({ bookings }: { bookings: BookingChipSource[] }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>('upcoming');
  const [property, setProperty] = useState<PropertySlug | null>(null);
  const [query, setQuery] = useState('');
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on navigation (clicking a row, or any other route change).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Reset transient state when the modal closes so a re-open starts fresh.
  // Focus the search input when the modal opens so admin can start typing
  // immediately after ⌘J.
  useEffect(() => {
    if (open) {
      // Microtask so the portal has mounted before we try to focus.
      queueMicrotask(() => inputRef.current?.focus());
    } else {
      setProperty(null);
      setQuery('');
    }
  }, [open]);

  // Global shortcut: ⌘J / Ctrl+J toggles the search modal. The notifications
  // bell uses ⌘K; pair so admin can swap between the two without reaching
  // for the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const today = todayYmd();

  // Filter chain: scope → property → search. Memoised so typing doesn't
  // re-derive scope on every keystroke.
  const inScope = useMemo(
    () => (scope === 'upcoming' ? bookings.filter((b) => b.date_check_out > today) : bookings),
    [bookings, scope, today],
  );

  const propertyCounts = useMemo(() => {
    const out = new Map<PropertySlug, number>();
    for (const b of inScope) {
      out.set(b.property_slug as PropertySlug, (out.get(b.property_slug as PropertySlug) ?? 0) + 1);
    }
    return out;
  }, [inScope]);

  const filtered = useMemo(() => {
    let rows = property === null ? inScope : inScope.filter((b) => b.property_slug === property);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (b) =>
          (b.user_name?.toLowerCase().includes(q) ?? false) ||
          (b.user_email?.toLowerCase().includes(q) ?? false),
      );
    }
    return rows;
  }, [inScope, property, query]);

  const upcomingCount = useMemo(
    () => bookings.filter((b) => b.date_check_out > today).length,
    [bookings, today],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search bookings — ⌘J"
        title="Search  ⌘J"
        className="relative grid place-items-center w-9 h-9 rounded-full bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm text-slate-600 hover:text-slate-900 transition-all"
      >
        <Search className="w-4 h-4" />
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl p-6">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-4 right-4 grid place-items-center w-8 h-8 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-sm font-mono uppercase tracking-widest text-slate-400 mb-4">
              Search
            </h2>

            {/* Scope toggle */}
            <div className="flex items-center gap-1.5 mb-3">
              <ScopeChip
                icon={Calendar}
                label="Upcoming"
                count={upcomingCount}
                active={scope === 'upcoming'}
                onClick={() => setScope('upcoming')}
              />
              <ScopeChip
                icon={Archive}
                label="All"
                count={bookings.length}
                active={scope === 'all'}
                onClick={() => setScope('all')}
              />
            </div>

            {/* Property filter chips */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <FilterChip
                icon={LayoutGrid}
                label="All"
                count={inScope.length}
                active={property === null}
                tone="dark"
                onClick={() => setProperty(null)}
              />
              {PROPERTY_SLUGS.map((slug) => {
                const n = propertyCounts.get(slug) ?? 0;
                if (n === 0) return null;
                return (
                  <FilterChip
                    key={slug}
                    label={slug.toUpperCase()}
                    count={n}
                    active={property === slug}
                    tone="property"
                    onClick={() => setProperty(property === slug ? null : slug)}
                  />
                );
              })}
            </div>

            {/* Search input */}
            <label className="relative block mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by guest name or email…"
                className="w-full pl-9 pr-3 py-2 rounded-full border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </label>

            {/* Results */}
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No bookings match these filters.</p>
            ) : (
              <ResultsTable rows={filtered} />
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── Scope toggle chip ─────────────────────────────────────────────────────

function ScopeChip({
  icon: Icon, label, count, active, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
        'text-[11px] font-mono uppercase tracking-widest transition',
        active
          ? 'bg-slate-900 text-white ring-2 ring-slate-900 shadow-sm'
          : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
      ].join(' ')}
    >
      <Icon className="w-3 h-3" />
      <span className="normal-case tracking-normal font-semibold">{label}</span>
      <span className="opacity-60">·</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

// ─── Filter chip (property) ────────────────────────────────────────────────

function FilterChip({
  icon: Icon, label, count, active, onClick, tone,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone: 'dark' | 'property';
}) {
  const baseClasses = [
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
    'text-[11px] font-mono uppercase tracking-widest transition',
  ];

  if (tone === 'dark') {
    baseClasses.push(
      active
        ? 'bg-slate-900 text-white ring-2 ring-slate-900 shadow-sm'
        : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
    );
  } else {
    baseClasses.push(
      active
        ? 'bg-slate-50 text-slate-900 ring-2 ring-slate-900 shadow-sm'
        : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
    );
  }

  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={baseClasses.join(' ')}>
      {Icon && <Icon className="w-3 h-3" />}
      <span className="font-semibold">{label}</span>
      <span className="opacity-60">·</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

// ─── Results table ─────────────────────────────────────────────────────────

const PAYMENT_LABEL: Record<PaymentState, string> = {
  paid:           'paid',
  partial:        'partial',
  unpaid:         'unpaid',
  not_applicable: '—',
};

const PAYMENT_TONE: Record<PaymentState, string> = {
  paid:           'text-emerald-700',
  partial:        'text-amber-700',
  unpaid:         'text-slate-400',
  not_applicable: 'text-slate-300',
};

function ResultsTable({ rows }: { rows: BookingChipSource[] }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <div
        className="hidden sm:grid gap-x-3 px-3 py-2 bg-slate-50/70 border-b border-slate-200 text-[10px] font-mono uppercase tracking-[0.22em] text-slate-400"
        style={{ gridTemplateColumns: '90px minmax(0,1.6fr) auto auto 24px' }}
      >
        <div>Property</div>
        <div>Dates</div>
        <div>Status</div>
        <div className="text-right">Payment</div>
        <div className="sr-only">Open</div>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((b) => {
          const nights = nightsBetween(b.date_check_in, b.date_check_out);
          const pay = paymentState(b);
          return (
            <li key={b.id}>
              <Link
                href={`/admin/bookings/${b.id}`}
                className="grid grid-cols-[1fr_auto] sm:grid-cols-[90px_minmax(0,1.6fr)_auto_auto_24px] gap-x-3 items-center px-3 py-2.5 hover:bg-slate-50/70 transition-colors group"
              >
                {/* Property — slug on top; status badge below on mobile only
                    (desktop renders the status in its own column to the right). */}
                <div className="min-w-0 space-y-1">
                  <div className="text-xs font-mono uppercase tracking-widest text-slate-700 truncate">
                    {b.property_slug}
                  </div>
                  <div className="sm:hidden">
                    <StatusBadge status={b.status} />
                  </div>
                </div>

                {/* Dates + nights (desktop), guest name underneath on mobile */}
                <div className="min-w-0 hidden sm:block">
                  <div className="text-sm text-slate-900 tabular-nums truncate">
                    {fmtDateRange(b.date_check_in, b.date_check_out)}
                    <span className="text-slate-400 font-mono ml-1.5">· {nights}n</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {b.user_name ?? <span className="italic text-slate-400">no user</span>}
                  </div>
                </div>

                {/* Mobile: dates + guest + payment stacked, right-aligned.
                    Status lives under the property slug on the left. */}
                <div className="sm:hidden min-w-0 col-span-1 text-right space-y-0.5">
                  <div className="text-xs text-slate-900 tabular-nums truncate">
                    {fmtDateRange(b.date_check_in, b.date_check_out)} · {nights}n
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {b.user_name ?? <span className="italic text-slate-400">no user</span>}
                  </div>
                  <div className={`text-[10px] font-mono uppercase tracking-widest ${PAYMENT_TONE[pay]}`}>
                    {PAYMENT_LABEL[pay]}
                  </div>
                </div>

                {/* Status */}
                <div className="hidden sm:block">
                  <StatusBadge status={b.status} />
                </div>

                {/* Payment */}
                <div className={`hidden sm:block text-xs font-mono uppercase tracking-widest text-right ${PAYMENT_TONE[pay]}`}>
                  {PAYMENT_LABEL[pay]}
                </div>

                {/* Chevron */}
                <ChevronRight className="hidden sm:block w-4 h-4 text-slate-300 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
