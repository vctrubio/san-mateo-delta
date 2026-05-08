import Link from 'next/link';
import { Plus, Mail } from 'lucide-react';
import InvitationsTable from '@/components/admin/invite/InvitationsTable';
import FiltersBar from '@/components/admin/filters/FiltersBar';
import FilterChips from '@/components/admin/filters/FilterChips';
import DateRangePicker from '@/components/admin/filters/DateRangePicker';
import SearchInput from '@/components/admin/filters/SearchInput';
import ResetButton from '@/components/admin/filters/ResetButton';
import Pagination from '@/components/admin/filters/Pagination';
import { listInvitations, invitationStats } from '@/lib/invitations';
import { asInt, asString, asStringList, asDate, paginate, DEFAULT_PAGE_LIMIT } from '@/lib/searchParams';
import { INVITATION_STATUSES, type InvitationStatus } from '@db/enums';
import { PROPERTY_SLUGS, PROPERTY_LABELS } from '@/lib/colors';

export const dynamic = 'force-dynamic';

const STATUS_CHIPS = INVITATION_STATUSES.map((s) => ({
  value: s,
  label: s,
  activeClass:
    s === 'invited'  ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200' :
    s === 'accepted' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' :
                       'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  dotClass:
    s === 'invited'  ? 'bg-violet-500' :
    s === 'accepted' ? 'bg-emerald-500' :
                       'bg-slate-400',
}));

const PROPERTY_CHIPS = PROPERTY_SLUGS.map((slug) => ({
  value: slug,
  label: PROPERTY_LABELS[slug],
  activeClass: 'bg-slate-900 text-white ring-1 ring-slate-900',
  dotClass: `bg-[var(--color-property-${slug})]`,
}));

export default async function AdminInvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const status = (asStringList(sp.status) ?? [])
    .filter((s): s is InvitationStatus => (INVITATION_STATUSES as readonly string[]).includes(s));
  const property = asStringList(sp.property);
  const from = asDate(sp.from);
  const to = asDate(sp.to);
  const search = asString(sp.q);
  const { limit, offset } = paginate({ page: asInt(sp.page, 1), limit: DEFAULT_PAGE_LIMIT });

  const [{ rows, total }, stats] = await Promise.all([
    listInvitations({
      status: status.length > 0 ? status : undefined,
      property,
      from, to,
      search: search ?? undefined,
      limit, offset,
    }),
    invitationStats(),
  ]);

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="grid place-items-center w-8 h-8 rounded-xl bg-violet-100 text-violet-700">
              <Mail className="w-4 h-4" />
            </span>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Invitations</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Custom-priced bookings for friends &amp; family. Issue with admin-set rates;
            invitee accepts via the access link.
          </p>
        </div>
        <Link
          href="/admin/invite/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-ocean text-white text-xs font-bold uppercase tracking-[0.2em] transition"
        >
          <Plus className="w-3.5 h-3.5" /> New invitation
        </Link>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Total"    value={stats.total}    tone="slate" />
        <Stat label="Invited"  value={stats.invited}  tone="violet" />
        <Stat label="Accepted" value={stats.accepted} tone="emerald" />
        <Stat label="Declined" value={stats.declined} tone="slate" />
      </div>

      {/* Filters */}
      <FiltersBar>
        <FilterChips paramKey="status"   label="Status"   options={STATUS_CHIPS} />
        <FilterChips paramKey="property" label="Property" options={PROPERTY_CHIPS} />
        <DateRangePicker label="Check-in" />
        <SearchInput placeholder="Email or guest name…" />
        <div className="ml-auto">
          <ResetButton />
        </div>
      </FiltersBar>

      <p className="text-[12px] text-slate-500 mb-3">
        {total} matching{search ? <> · search <code className="font-mono">{search}</code></> : null}
      </p>

      <InvitationsTable invitations={rows} />

      <Pagination total={total} limit={limit} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'violet' | 'emerald' }) {
  const accent =
    tone === 'violet'  ? 'bg-violet-50 text-violet-700 ring-violet-200' :
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                         'bg-slate-50 text-slate-700 ring-slate-200';
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{label}</span>
        <span className={`w-6 h-6 rounded-md ring-1 ${accent}`}></span>
      </div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}
