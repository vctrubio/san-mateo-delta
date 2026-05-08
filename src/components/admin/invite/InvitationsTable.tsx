import Link from 'next/link';
import { ArrowDown, ArrowUp, Equal, X } from 'lucide-react';
import { revokeInvitation } from '@/actions/invitations';
import { fmtDateRange, fmtDate } from '@/lib/dates';
import type { InvitationRow } from '@/lib/invitations';
import type { InvitationStatus } from '@db/enums';

// ============================================================================
// Table view of all invitations. Columns mirror what an admin needs to scan
// quickly: status, property, dates, who, what they paid (custom) vs what the
// rate engine would have charged (default), and how big the difference is.
//
// Each row links to /admin/bookings/[booking_id] for full detail. Pending
// invitations have an inline `Revoke` button that flips both the booking and
// the invitation row in one action.
// ============================================================================

type Props = {
  invitations: Array<InvitationRow & {
    /** Joined-in default pricing (the "would-be" cost). */
    default_property_cents: number | null;
    default_cleaning_cents: number | null;
  }>;
};

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

function StatusBadge({ status }: { status: InvitationStatus }) {
  const cls =
    status === 'invited'  ? 'bg-violet-50 text-violet-700 ring-violet-200' :
    status === 'accepted' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                            'bg-slate-50 text-slate-500 ring-slate-200';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] ring-1 ${cls}`}>
      {status}
    </span>
  );
}

function DiffPill({ customCents, defaultCents }: { customCents: number; defaultCents: number | null }) {
  if (defaultCents == null) {
    return <span className="text-slate-300 text-[11px] font-mono">no rate</span>;
  }
  const diff = customCents - defaultCents;
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] bg-slate-50 text-slate-600 ring-1 ring-slate-200">
        <Equal className="w-2.5 h-2.5" /> 0%
      </span>
    );
  }
  const negative = diff < 0;
  const pct = defaultCents > 0 ? Math.round((diff / defaultCents) * 100) : 0;
  const tone = negative
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : 'bg-amber-50 text-amber-700 ring-amber-200';
  const Icon = negative ? ArrowDown : ArrowUp;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] ring-1 ${tone}`}>
      <Icon className="w-2.5 h-2.5" />
      {negative ? '−' : '+'}{eur(Math.abs(diff))}
      {pct !== 0 && <> ({negative ? '−' : '+'}{Math.abs(pct)}%)</>}
    </span>
  );
}

export default function InvitationsTable({ invitations }: Props) {
  if (invitations.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-sm text-slate-400">
        No invitations match the current filters.
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-100 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-[10px] font-mono uppercase tracking-widest text-slate-400">
            <th className="text-left px-4 py-3">#</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Property</th>
            <th className="text-left px-4 py-3">Dates</th>
            <th className="text-left px-4 py-3">Invitee</th>
            <th className="text-right px-4 py-3">Custom</th>
            <th className="text-right px-4 py-3">Default</th>
            <th className="text-right px-4 py-3">Diff</th>
            <th className="text-right px-4 py-3">Sent</th>
            <th className="text-right px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((inv) => (
            <tr key={inv.invitation_id} className="border-t border-slate-50 hover:bg-slate-50/50">
              <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                <Link href={`/admin/bookings/${inv.booking_id}`} className="hover:text-ocean">
                  #{inv.invitation_id}
                </Link>
              </td>
              <td className="px-4 py-3"><StatusBadge status={inv.invitation_status} /></td>
              <td className="px-4 py-3 text-slate-700">
                <span className="font-bold uppercase">{inv.property_slug}</span>
              </td>
              <td className="px-4 py-3 text-[12px] text-slate-700">
                {fmtDateRange(inv.date_check_in, inv.date_check_out)}
              </td>
              <td className="px-4 py-3 text-[12px]">
                <div className="font-bold text-slate-900">{inv.user_name ?? <span className="italic text-slate-400">no name</span>}</div>
                <div className="text-[11px] font-mono text-slate-400">{inv.email}</div>
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                {eur(inv.agreed_total_cents)}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">
                {inv.default_property_cents != null && inv.default_cleaning_cents != null
                  ? <span className="text-slate-500">{eur(inv.default_property_cents + inv.default_cleaning_cents)}</span>
                  : <span className="text-slate-300">—</span>}
              </td>
              <td className="px-4 py-3 text-right">
                <DiffPill
                  customCents={inv.agreed_total_cents}
                  defaultCents={inv.default_property_cents != null && inv.default_cleaning_cents != null
                    ? inv.default_property_cents + inv.default_cleaning_cents
                    : null}
                />
              </td>
              <td className="px-4 py-3 text-right text-[11px] text-slate-400">
                {fmtDate(inv.invited_at)}
              </td>
              <td className="px-4 py-3 text-right">
                {inv.invitation_status === 'invited' ? (
                  <form action={revokeInvitation} className="inline-flex">
                    <input type="hidden" name="invitation_id" value={inv.invitation_id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest rounded bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 transition"
                    >
                      <X className="w-2.5 h-2.5" /> Revoke
                    </button>
                  </form>
                ) : (
                  <span className="text-[10px] text-slate-300 font-mono">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
