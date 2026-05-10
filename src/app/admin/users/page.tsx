import AdminSection from '@/components/admin/AdminSection';
import AdminTable, { type AdminTableColumn } from '@/components/admin/AdminTable';
import UserSignUpForm from '@/components/shared/UserSignUpForm';
import FiltersBar from '@/components/admin/filters/FiltersBar';
import SearchInput from '@/components/admin/filters/SearchInput';
import SortSelect from '@/components/admin/filters/SortSelect';
import ResetButton from '@/components/admin/filters/ResetButton';
import Pagination from '@/components/admin/filters/Pagination';
import { listUsers, type ListUsersSort, type UserWithStats } from '@/lib/users';
import { fmtDate } from '@/lib/dates';
import { asInt, asString, paginate, DEFAULT_PAGE_LIMIT } from '@/lib/searchParams';
import { eur } from '@/lib/format';

export const dynamic = 'force-dynamic';

const SORT_OPTIONS: Array<{ value: ListUsersSort; label: string }> = [
  { value: 'recent',   label: 'Most recent' },
  { value: 'bookings', label: 'Most bookings' },
  { value: 'spend',    label: 'Lifetime spend' },
];

const COLUMNS: AdminTableColumn<UserWithStats>[] = [
  {
    key: 'id',
    header: '#',
    width: '64px',
    render: (u) => <span className="font-mono text-xs text-slate-400">#{u.id}</span>,
  },
  {
    key: 'identity',
    header: 'Name · Email',
    width: 'minmax(0,2fr)',
    render: (u) => (
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">{u.name}</div>
        <div className="text-xs text-slate-500 mt-1 font-mono truncate">{u.email}</div>
      </div>
    ),
  },
  {
    key: 'nationality',
    header: 'Nationality',
    width: 'minmax(0,0.7fr)',
    render: (u) => <span className="text-xs text-slate-500">{u.nationality ?? '—'}</span>,
  },
  {
    key: 'bookings',
    header: 'Bookings',
    align: 'right',
    width: '100px',
    render: (u) => <span className="font-mono tabular-nums text-sm text-slate-700">{u.total_bookings}</span>,
  },
  {
    key: 'spend',
    header: 'Lifetime',
    align: 'right',
    width: '120px',
    render: (u) => <span className="font-mono tabular-nums text-sm text-slate-900">{eur(u.lifetime_spend_cents)}</span>,
  },
  {
    key: 'joined',
    header: 'Joined',
    align: 'right',
    width: '140px',
    render: (u) => <span className="text-xs text-slate-400">{fmtDate(u.created_at)}</span>,
  },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const search = asString(sp.q);
  const sort = (asString(sp.sort) as ListUsersSort | undefined) ?? 'recent';
  const { limit, offset } = paginate({ page: asInt(sp.page, 1), limit: DEFAULT_PAGE_LIMIT });

  const { rows: users, total } = await listUsers({ search, sort, limit, offset });

  return (
    <>
      <AdminSection eyebrow="Add new">
        <UserSignUpForm variant="card" />
      </AdminSection>

      <FiltersBar>
        <SearchInput placeholder="Search name or email…" />
        <SortSelect options={SORT_OPTIONS} />
        <div className="ml-auto">
          <ResetButton />
        </div>
      </FiltersBar>

      <AdminSection eyebrow="All users">
        <AdminTable
          columns={COLUMNS}
          rows={users}
          rowKey={(u) => u.id}
          rowHref={(u) => `/admin/users/${u.id}`}
          emptyMessage="No users match these filters."
        />
        <Pagination total={total} limit={limit} />
      </AdminSection>
    </>
  );
}
