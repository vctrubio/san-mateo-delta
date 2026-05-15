'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Users, ArrowLeft } from 'lucide-react';
import { PROPERTY_LABELS, type PropertySlug } from '@/lib/colors';
import { eur } from '@/lib/format';
import { fmtDateRange } from '@/lib/dates';
import { describePolicy } from '@/lib/payment';
import { formatGuests } from '@/lib/guests';
import { type UseReservationReturn } from './useReservation';
import type { ReservationCtx } from '@/lib/reservation';

// ============================================================================
// ReservationSummary — left pane of the /book "open book". A frozen view of
// what's about to be reserved: property photo + name, picked dates,
// guests, line-item receipt, deposit policy. The pane is read-only; the
// only interaction is a "Change dates" link back to /finca/[slug].
//
// Everything renders off the useReservation return — no local state.
// ============================================================================

export function ReservationSummary({
  ctx,
  rv,
}: {
  ctx: ReservationCtx;
  rv: UseReservationReturn;
}) {
  const label = PROPERTY_LABELS[ctx.property.slug as PropertySlug] ?? ctx.property.slug.toUpperCase();
  const { quote, resolvedPolicy, total, deposit } = rv;
  const balance = total - deposit;

  return (
    <aside className="rounded-3xl bg-white border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
      <div className="relative aspect-[16/10] bg-slate-100">
        <Image
          src={`/images/${ctx.property.slug}.png`}
          alt={`${label} — Finca San Mateo`}
          fill
          priority
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        <div className="absolute bottom-5 left-6 right-6 text-white">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/70">
            {ctx.property.title}
          </p>
          <p className="text-3xl font-bold tracking-tight mt-1">{label}</p>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col gap-6">
        {/* Picked stay */}
        <section>
          <header className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-400">
              Your stay
            </p>
            <Link
              href={`/finca/${ctx.property.slug}`}
              className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-slate-500 hover:text-ocean transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Change dates
            </Link>
          </header>
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              {rv.state.range
                ? <span>{fmtDateRange(rv.state.range.from, rv.state.range.to)}</span>
                : <span className="italic text-slate-400">No dates picked.</span>}
            </li>
            <li className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{formatGuests(rv.state.guests) || 'No guests yet'}</span>
            </li>
          </ul>
        </section>

        {/* Receipt */}
        <section className="border-t border-slate-100 pt-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-400 mb-3">
            Receipt
          </p>
          {!quote ? (
            <p className="text-sm italic text-slate-400">
              Pick dates to see the breakdown.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              <ReceiptRow
                label={`${quote.nights} night${quote.nights === 1 ? '' : 's'} × ${eur(quote.night_rate_cents)}`}
                value={eur(quote.agreed_property_cents)}
              />
              <ReceiptRow label="Cleaning" value={eur(quote.agreed_cleaning_cents)} />
              <li className="flex items-baseline justify-between pt-2 border-t border-slate-100 font-semibold text-slate-900">
                <span>Total</span>
                <span className="font-mono tabular-nums">{eur(total)}</span>
              </li>
            </ul>
          )}
        </section>

        {/* Deposit policy */}
        {resolvedPolicy && quote && (
          <section className="border-t border-slate-100 pt-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-slate-400 mb-3">
              Payment terms
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              {describePolicy(resolvedPolicy.effective)}
            </p>
            {resolvedPolicy.collapsed && resolvedPolicy.collapseReason && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                {resolvedPolicy.collapseReason}
              </p>
            )}
            {deposit > 0 && deposit < total && (
              <ul className="mt-3 space-y-1.5 text-sm">
                <li className="flex items-baseline justify-between">
                  <span className="text-slate-500">Due today</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">{eur(deposit)}</span>
                </li>
                <li className="flex items-baseline justify-between">
                  <span className="text-slate-500">Balance later</span>
                  <span className="font-mono tabular-nums text-slate-700">{eur(balance)}</span>
                </li>
              </ul>
            )}
            {deposit === 0 && (
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold">Due on arrival:</span> {eur(total)}
              </p>
            )}
            {deposit === total && total > 0 && (
              <p className="mt-3 text-sm text-slate-700">
                <span className="font-semibold">Due today:</span> {eur(total)}
              </p>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between text-slate-600">
      <span>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </li>
  );
}
