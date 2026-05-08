import Link from 'next/link';
import { Inbox, Check, ArrowRight } from 'lucide-react';
import { funnelStats, pendingRequests } from '@/lib/dashboard';
import { BOOKING_STATUS_STYLES } from '@/lib/colors';
import { fmtDate } from '@/lib/dates';
import BookingActionButtons from '@/components/admin/BookingActionButtons';

// ============================================================================
// PipelinePanel — the request → confirmed funnel.
//
// Top: a 3-stat strip: pending now · 30-day inflow · 30-day confirmed +
// conversion %. Bottom: live pending list with inline Confirm/Cancel.
// ============================================================================

export default async function PipelinePanel() {
  const [stats, pending] = await Promise.all([
    funnelStats(),
    pendingRequests(8),
  ]);

  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5">
      {/* Funnel header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <FunnelStat
          label="Pending now"
          value={stats.pending_now}
          sub="awaiting confirmation"
          tone="amber"
          icon={<Inbox className="w-3.5 h-3.5" />}
        />
        <FunnelStat
          label="Confirmed (30d)"
          value={stats.confirmed_30d}
          sub={`of ${stats.inflow_30d} new requests`}
          tone="ocean"
          icon={<Check className="w-3.5 h-3.5" />}
        />
        <FunnelStat
          label="Conversion"
          value={`${stats.conversion_pct}%`}
          sub="last 30 days · request → confirmed"
          tone="emerald"
          icon={<ArrowRight className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Visual funnel bar */}
      <FunnelBar inflow={stats.inflow_30d} confirmed={stats.confirmed_30d} />

      {/* Pending list */}
      <div className="mt-6 pt-5 border-t border-slate-100">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-slate-500 mb-3">
          Pending requests · {pending.length}
        </h3>
        {pending.length === 0 ? (
          <p className="text-[12px] text-slate-400 italic">Nothing waiting on you. ✓</p>
        ) : (
          <ul>
            {pending.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-50 last:border-0"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <span
                    className={`inline-block text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${BOOKING_STATUS_STYLES[b.status].chip}`}
                  >
                    {BOOKING_STATUS_STYLES[b.status].label}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`/admin/bookings/${b.id}`}
                      className="text-[13px] font-bold text-slate-900 truncate hover:text-ocean"
                    >
                      {b.user_name ?? <span className="italic text-slate-400">no user</span>}
                    </Link>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      {b.property_slug} · {fmtDate(b.date_check_in)} → {fmtDate(b.date_check_out)}
                    </div>
                  </div>
                </div>
                <BookingActionButtons bookingId={b.id} currentStatus={b.status} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function FunnelStat({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  tone: 'ocean' | 'amber' | 'emerald';
  icon: React.ReactNode;
}) {
  const tones: Record<typeof tone, string> = {
    ocean:   'bg-ocean/10 text-ocean ring-ocean/30',
    amber:   'bg-amber-50 text-amber-700 ring-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  };
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-6 h-6 rounded-md ring-1 flex items-center justify-center ${tones[tone]}`}>
          {icon}
        </span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
      <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{sub}</div>
    </div>
  );
}

function FunnelBar({ inflow, confirmed }: { inflow: number; confirmed: number }) {
  // Confirmed-share width as a fraction of inflow. Falls back to 0 if no inflow.
  const confirmedPct = inflow === 0 ? 0 : Math.round((confirmed / inflow) * 100);
  const stillPendingPct = 100 - confirmedPct;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
          30-day inflow → confirmed
        </span>
        <span className="text-[10px] font-mono text-slate-500 tabular-nums">
          {confirmed} / {inflow}
        </span>
      </div>
      <div className="h-3 w-full rounded-full overflow-hidden bg-slate-100 flex">
        <div
          className="h-full bg-ocean transition-all"
          style={{ width: `${confirmedPct}%` }}
          title={`Confirmed ${confirmedPct}%`}
        />
        <div
          className="h-full bg-amber-300 transition-all"
          style={{ width: `${stillPendingPct}%` }}
          title={`Pending or other ${stillPendingPct}%`}
        />
      </div>
      <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500 mt-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-ocean" /> Confirmed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-300" /> Still pending / other
        </span>
      </div>
    </div>
  );
}
