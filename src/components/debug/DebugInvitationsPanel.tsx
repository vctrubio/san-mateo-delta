import { Mail, Database, ArrowDown, ArrowUp, Equal, FileCode2, ShieldCheck } from 'lucide-react';
import { listInvitations, invitationStats } from '@/lib/invitations';
import { fmtDateRange, fmtDateTime } from '@/lib/dates';

// ============================================================================
// DebugInvitations — narrate the new /admin/invite feature with live data.
// Same pattern as DebugAdminPanel and DebugStripePanel: prose + the actual
// rows from the DB next to each other so this stays honest as the feature
// evolves.
// ============================================================================

export const dynamic = 'force-dynamic';

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function DebugInvitationsPanel() {
  const [stats, { rows: recent }] = await Promise.all([
    invitationStats(),
    listInvitations({ limit: 6 }),
  ]);

  return (
    <section className="px-6 py-10 border-t border-slate-100 bg-gradient-to-b from-violet-50/30 via-white to-white">
      <div className="max-w-5xl mx-auto">
        <Header />
        <Story />
        <SchemaCard />
        <StatsCard stats={stats} />
        <RecentCard rows={recent} />
        <Files />
        <Footer />
      </div>
    </section>
  );
}

// ============================================================================

function Header() {
  return (
    <div className="mb-6">
      <div className="inline-flex items-center gap-2 mb-2">
        <span className="grid place-items-center w-8 h-8 rounded-xl bg-violet-100 text-violet-700">
          <Mail className="w-4 h-4" />
        </span>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">DebugInvitations</h2>
        <span className="text-[10px] font-mono text-violet-700 bg-violet-100 ring-1 ring-violet-200 px-1.5 py-0.5 rounded uppercase tracking-widest">
          live
        </span>
      </div>
      <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
        Admin-issued bookings priced manually for friends &amp; family. Lives at{' '}
        <code className="font-mono px-1 rounded bg-slate-100">/admin/invite</code>. Long-form spec
        in <code className="font-mono px-1 rounded bg-slate-100">docs/invitations.md</code>.
      </p>
    </div>
  );
}

function Story() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5 text-[13px] text-slate-700 leading-relaxed">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">How it differs from a regular booking</h3>
      <ul className="space-y-1.5 list-disc pl-5 marker:text-slate-300">
        <li>
          A regular booking comes from <code className="font-mono">requestBooking</code> on{' '}
          <code className="font-mono">/finca/[slug]</code> — the guest fills the form, prices come
          from <code className="font-mono">computeQuote</code> against{' '}
          <code className="font-mono">property_rates</code>, status starts as{' '}
          <code className="font-mono">request</code>.
        </li>
        <li>
          An <strong>invitation</strong> comes from{' '}
          <code className="font-mono">createInvitation</code> on{' '}
          <code className="font-mono">/admin/invite/new</code> — admin sets prices manually.
          Status starts as <code className="font-mono">invite</code>. Both
          <code className="font-mono"> agreed_property_cents</code> and{' '}
          <code className="font-mono">agreed_cleaning_cents</code> can be anything &gt;= 0
          (including <code className="font-mono">0</code> for a free stay).
        </li>
        <li>
          The would-be default price (what <code className="font-mono">computeQuote</code> would
          have returned) is snapshotted into the{' '}
          <code className="font-mono">booking.invited</code> audit event so the table can show the
          live diff between custom and default — proof of the favor, basically.
        </li>
        <li>
          Date overlap is enforced manually inside the action&apos;s transaction
          (<code className="font-mono">FOR UPDATE</code> on held bookings) — Postgres&apos;
          <code className="font-mono"> no_overlap_when_held</code> exclusion only catches
          held statuses.
        </li>
      </ul>
    </div>
  );
}

function SchemaCard() {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <Database className="w-3 h-3" /> Schema
      </h3>
      <pre className="bg-slate-900 text-slate-100 text-[11px] font-mono p-4 rounded-xl overflow-x-auto leading-relaxed">{
`CREATE TYPE invitation_status AS ENUM ('invited', 'accepted', 'declined');

bookings {
  status                booking_status   -- 'invite' for new invitations
  agreed_property_cents BIGINT           -- admin-set, not from computeQuote
  agreed_cleaning_cents BIGINT           -- admin-set, not properties.cleaning_fee_cents
  access_token          UUID  UNIQUE     -- for the invitee's accept link (future)
}

booking_invitations {
  booking_id        BIGINT  UNIQUE  -- 1:1 with the booking
  email             TEXT            -- where to send the invite (auth slice TBD)
  status            invitation_status
  accepted_user_id  BIGINT          -- set when invitee accepts
  invited_at        TIMESTAMPTZ
  responded_at      TIMESTAMPTZ
}`
      }</pre>
    </div>
  );
}

function StatsCard({ stats }: { stats: { invited: number; accepted: number; declined: number; total: number } }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">
        Live distribution — booking_invitations
      </h3>
      {stats.total === 0 ? (
        <p className="text-[12px] text-slate-400 italic">
          No invitations yet. Create one at <code className="font-mono">/admin/invite/new</code>.
          (The full-season seed only sets <code className="font-mono">bookings.status=&apos;invite&apos;</code>;
          it doesn&apos;t populate the <code className="font-mono">booking_invitations</code> table —
          this is intentional so the inbox is empty until real admin action.)
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Invited"  value={stats.invited}  tone="violet" />
          <Stat label="Accepted" value={stats.accepted} tone="emerald" />
          <Stat label="Declined" value={stats.declined} tone="slate" />
          <Stat label="Total"    value={stats.total}    tone="slate" />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'violet' | 'emerald' }) {
  const accent =
    tone === 'violet' ? 'bg-violet-50 text-violet-700' :
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' :
                         'bg-slate-50 text-slate-600';
  return (
    <div className={`rounded-xl ${accent} p-3`}>
      <div className="text-[10px] font-mono uppercase tracking-widest opacity-70 mb-1">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function RecentCard({ rows }: {
  rows: Array<{
    invitation_id: string;
    invitation_status: string;
    invited_at: string;
    email: string;
    booking_id: string;
    property_slug: string;
    date_check_in: string;
    date_check_out: string;
    agreed_total_cents: number;
    default_property_cents: number | null;
    default_cleaning_cents: number | null;
    user_name: string | null;
  }>;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">
        Recent invitations (6 most recent)
      </h3>
      {rows.length === 0 ? (
        <p className="text-[12px] text-slate-400 italic">No invitations yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-[12px]">
          {rows.map((r) => {
            const def = r.default_property_cents != null && r.default_cleaning_cents != null
              ? r.default_property_cents + r.default_cleaning_cents
              : null;
            const diff = def != null ? r.agreed_total_cents - def : null;
            return (
              <li key={r.invitation_id} className="py-2 flex items-center gap-3 flex-wrap">
                <span className="font-mono text-[10px] text-slate-400 w-10 shrink-0">#{r.invitation_id}</span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] ring-1 ${
                  r.invitation_status === 'invited'  ? 'bg-violet-50 text-violet-700 ring-violet-200' :
                  r.invitation_status === 'accepted' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                                                       'bg-slate-50 text-slate-500 ring-slate-200'
                } shrink-0`}>{r.invitation_status}</span>
                <span className="font-mono text-[11px] text-slate-700 shrink-0 uppercase">{r.property_slug}</span>
                <span className="text-slate-500 shrink-0">{fmtDateRange(r.date_check_in, r.date_check_out)}</span>
                <span className="text-slate-700 truncate">{r.user_name ?? r.email}</span>
                <span className="font-mono tabular-nums text-slate-900 ml-auto shrink-0">{eur(r.agreed_total_cents)}</span>
                <DiffPill diff={diff} />
                <span className="text-[10px] text-slate-400 shrink-0">{fmtDateTime(r.invited_at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DiffPill({ diff }: { diff: number | null }) {
  if (diff == null) {
    return <span className="text-slate-300 text-[10px] font-mono">no rate</span>;
  }
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] bg-slate-50 text-slate-600 ring-1 ring-slate-200">
        <Equal className="w-2.5 h-2.5" /> 0
      </span>
    );
  }
  const negative = diff < 0;
  const tone = negative
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : 'bg-amber-50 text-amber-700 ring-amber-200';
  const Icon = negative ? ArrowDown : ArrowUp;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] ring-1 ${tone}`}>
      <Icon className="w-2.5 h-2.5" />
      {negative ? '−' : '+'}{eur(Math.abs(diff))}
    </span>
  );
}

function Files() {
  const items = [
    ['db/schema.sql', 'booking_invitations table + invitation_status enum'],
    ['src/lib/invitations.ts', 'listInvitations, getInvitationById, invitationStats'],
    ['src/actions/invitations.ts', 'createInvitation, revokeInvitation, previewInviteQuote'],
    ['src/components/admin/invite/InviteForm.tsx', 'client form: property → calendar → guest → custom fees + diff'],
    ['src/components/admin/invite/InvitationsTable.tsx', 'list rendering with custom-vs-default + revoke'],
    ['src/app/admin/invite/page.tsx', 'list + filters + stats strip'],
    ['src/app/admin/invite/new/page.tsx', 'form server-shell (prefetches users + calendars)'],
  ];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 mb-5">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
        <FileCode2 className="w-3 h-3" /> Files
      </h3>
      <ul className="space-y-1 text-[12px]">
        {items.map(([path, body]) => (
          <li key={path} className="flex items-start gap-3">
            <code className="font-mono text-[11px] text-violet-700 shrink-0 w-72 truncate">{path}</code>
            <span className="text-slate-600">{body}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer() {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 text-[12px] text-slate-600 leading-relaxed">
      <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
        <ShieldCheck className="w-3 h-3" /> What&apos;s not built yet
      </h3>
      <ul className="space-y-1 list-disc pl-5 marker:text-slate-300">
        <li>
          Email delivery — the invitee never gets an email. <code className="font-mono">access_token</code>{' '}
          on the booking is the entry-point for the future accept-link flow.
        </li>
        <li>
          Guest-side accept / decline UI. The next route to build is{' '}
          <code className="font-mono">/booking/[token]</code> with two big buttons.
        </li>
        <li>
          When the invitee accepts, the booking should auto-promote to{' '}
          <code className="font-mono">confirmed</code> and{' '}
          <code className="font-mono">booking_invitations.accepted_user_id</code> should be set.
        </li>
      </ul>
    </div>
  );
}
