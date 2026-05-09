import Link from 'next/link';
import { Plus, ArrowDown, ArrowUp, Equal, X } from 'lucide-react';
import AdminSection from '@/components/admin/AdminSection';
import AdminTable, { type AdminTableColumn } from '@/components/admin/AdminTable';
import FiltersBar from '@/components/admin/filters/FiltersBar';
import FilterChips from '@/components/admin/filters/FilterChips';
import DateRangePicker from '@/components/admin/filters/DateRangePicker';
import SearchInput from '@/components/admin/filters/SearchInput';
import ResetButton from '@/components/admin/filters/ResetButton';
import Pagination from '@/components/admin/filters/Pagination';
import { listInvitations, invitationStats, type InvitationRow } from '@/lib/invitations';
import { revokeInvitation } from '@/actions/invitations';
import { fmtDateRange, fmtDate } from '@/lib/dates';
import { asInt, asString, asStringList, asDate, paginate, DEFAULT_PAGE_LIMIT } from '@/lib/searchParams';
import { INVITATION_STATUSES, type InvitationStatus } from '@db/enums';
import { PROPERTY_SLUGS, PROPERTY_LABELS } from '@/lib/colors';

export const dynamic = 'force-dynamic';

type InviteListRow = InvitationRow & {
  default_property_cents: number | null;
  default_cleaning_cents: number | null;
};

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

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  const cls =
    status === 'invited'  ? 'bg-violet-50 text-violet-700 ring-violet-200' :
    status === 'accepted' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                            'bg-slate-50 text-slate-500 ring-slate-200';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-xs ring-1 ${cls}`}>
      {status}
    </span>
  );
}

function DiffPill({ customCents, defaultCents }: { customCents: number; defaultCents: number | null }) {
  if (defaultCents == null) return <span className="text-slate-300 text-xs font-mono">no rate</span>;
  const diff = customCents - defaultCents;
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-xs bg-slate-50 text-slate-600 ring-1 ring-slate-200">
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
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-xs ring-1 ${tone}`}>
      <Icon className="w-2.5 h-2.5" />
      {negative ? '−' : '+'}{eur(Math.abs(diff))}
      {pct !== 0 && <> ({negative ? '−' : '+'}{Math.abs(pct)}%)</>}
    </span>
  );
}

const COLUMNS: AdminTableColumn<InviteListRow>[] = [
  {
    key: 'id',
    header: '#',
    width: '64px',
    render: (i) => <span className="font-mono text-xs text-slate-400">#{i.invitation_id}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    width: 'minmax(0,0.7fr)',
    render: (i) => <InvitationStatusBadge status={i.invitation_status} />,
  },
  {
    key: 'identity',
    header: 'Property · Invitee',
    width: 'minmax(0,1.5fr)',
    render: (i) => (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: `var(--color-property-${i.property_slug})` }} />
          <span className="text-sm font-semibold text-slate-900">
            {PROPERTY_LABELS[i.property_slug as keyof typeof PROPERTY_LABELS] ?? i.property_slug}
          </span>
        </div>
        <div className="text-xs text-slate-500 mt-1 truncate">
          {i.user_name ?? <span className="italic text-slate-400">no name</span>}
          {' '}<span className="text-slate-300">·</span>{' '}
          <span className="font-mono text-slate-400">{i.email}</span>
        </div>
      </div>
    ),
  },
  {
    key: 'dates',
    header: 'Dates',
    width: 'minmax(0,1.2fr)',
    render: (i) => <span className="text-sm text-slate-700 tabular-nums">{fmtDateRange(i.date_check_in, i.date_check_out)}</span>,
  },
  {
    key: 'custom',
    header: 'Custom',
    align: 'right',
    width: '100px',
    render: (i) => <span className="font-mono tabular-nums text-sm text-slate-900">{eur(i.agreed_total_cents)}</span>,
  },
  {
    key: 'default',
    header: 'Default',
    align: 'right',
    width: '100px',
    render: (i) =>
      i.default_property_cents != null && i.default_cleaning_cents != null
        ? <span className="font-mono tabular-nums text-sm text-slate-500">{eur(i.default_property_cents + i.default_cleaning_cents)}</span>
        : <span className="text-slate-300">—</span>,
  },
  {
    key: 'diff',
    header: 'Diff',
    align: 'right',
    width: 'minmax(0,0.9fr)',
    render: (i) => (
      <DiffPill
        customCents={i.agreed_total_cents}
        defaultCents={i.default_property_cents != null && i.default_cleaning_cents != null
          ? i.default_property_cents + i.default_cleaning_cents
          : null}
      />
    ),
  },
  {
    key: 'sent',
    header: 'Sent',
    align: 'right',
    width: '110px',
    render: (i) => <span className="text-xs text-slate-400">{fmtDate(i.invited_at)}</span>,
  },
  {
    key: 'action',
    header: '',
    align: 'right',
    width: '110px',
    render: (i) =>
      i.invitation_status === 'invited' ? (
        <form action={revokeInvitation} className="relative z-10 inline-flex">
          <input type="hidden" name="invitation_id" value={i.invitation_id} />
          <button
            type="submit"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono uppercase tracking-widest rounded bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 transition"
          >
            <X className="w-2.5 h-2.5" /> Revoke
          </button>
        </form>
      ) : (
        <span className="text-xs text-slate-300 font-mono">—</span>
      ),
  },
];

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
    <>
      <AdminSection eyebrow="Issue invitation">
        <Link
          href="/admin/invite/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-ocean text-white text-xs font-bold uppercase tracking-[0.2em] transition"
        >
          <Plus className="w-3.5 h-3.5" /> New invitation
        </Link>
      </AdminSection>

      <FiltersBar>
        <FilterChips paramKey="status"   label="Status"   options={STATUS_CHIPS} />
        <FilterChips paramKey="property" label="Property" options={PROPERTY_CHIPS} />
        <DateRangePicker label="Check-in" />
        <SearchInput placeholder="Email or guest name…" />
        <div className="ml-auto">
          <ResetButton />
        </div>
      </FiltersBar>

      <AdminSection eyebrow="All invitations" hint={`${total} matching${search ? ` · search "${search}"` : ''}`}>
        <AdminTable
          columns={COLUMNS}
          rows={rows}
          rowKey={(i) => i.invitation_id}
          rowHref={(i) => `/admin/bookings/${i.booking_id}`}
          emptyMessage="No invitations match these filters."
        />
        <Pagination total={total} limit={limit} />
      </AdminSection>
    </>
  );
}
