import UsersTable from '@/components/admin/UsersTable';
import UserSignUpForm from '@/components/shared/UserSignUpForm';
import FiltersBar from '@/components/admin/filters/FiltersBar';
import SearchInput from '@/components/admin/filters/SearchInput';
import SortSelect from '@/components/admin/filters/SortSelect';
import ResetButton from '@/components/admin/filters/ResetButton';
import Pagination from '@/components/admin/filters/Pagination';
import { listUsers, type ListUsersSort } from '@/lib/users';
import { asInt, asString, paginate, DEFAULT_PAGE_LIMIT } from '@/lib/searchParams';

export const dynamic = 'force-dynamic';

const SORT_OPTIONS: Array<{ value: ListUsersSort; label: string }> = [
  { value: 'recent',   label: 'Most recent' },
  { value: 'bookings', label: 'Most bookings' },
  { value: 'spend',    label: 'Lifetime spend' },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const search = asString(sp.q);
  const sort = (asString(sp.sort) as ListUsersSort | undefined) ?? 'recent';
  const { limit, offset } = paginate({
    page: asInt(sp.page, 1),
    limit: DEFAULT_PAGE_LIMIT,
  });

  const { rows: users, total } = await listUsers({ search, sort, limit, offset });

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Users</h1>
        <p className="text-sm text-slate-500 mt-1">{total} users matching</p>
      </div>

      <div className="mb-6">
        <UserSignUpForm variant="card" />
      </div>

      <FiltersBar>
        <SearchInput placeholder="Search name or email…" />
        <SortSelect options={SORT_OPTIONS} />
        <div className="ml-auto">
          <ResetButton />
        </div>
      </FiltersBar>

      <UsersTable users={users} />

      <Pagination total={total} limit={limit} />
    </div>
  );
}
