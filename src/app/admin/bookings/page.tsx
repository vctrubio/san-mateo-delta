import BookingsTable from '@/components/admin/BookingsTable';
import FiltersBar from '@/components/admin/filters/FiltersBar';
import FilterChips from '@/components/admin/filters/FilterChips';
import SearchInput from '@/components/admin/filters/SearchInput';
import DateRangePicker from '@/components/admin/filters/DateRangePicker';
import ResetButton from '@/components/admin/filters/ResetButton';
import Pagination from '@/components/admin/filters/Pagination';
import { listBookings } from '@/lib/bookings';
import { asInt, asStringList, asString, asDate, paginate, DEFAULT_PAGE_LIMIT } from '@/lib/searchParams';
import { BOOKING_STATUSES, type BookingStatus } from '@db/enums';
import { BOOKING_STATUS_STYLES, PROPERTY_SLUGS, PROPERTY_LABELS } from '@/lib/colors';

export const dynamic = 'force-dynamic';

const STATUS_CHIPS = BOOKING_STATUSES.map((s) => ({
  value: s,
  label: BOOKING_STATUS_STYLES[s].label,
  activeClass: BOOKING_STATUS_STYLES[s].chip,
  dotClass: BOOKING_STATUS_STYLES[s].dot,
}));

const PROPERTY_CHIPS = PROPERTY_SLUGS.map((slug) => ({
  value: slug,
  label: PROPERTY_LABELS[slug],
  activeClass: 'bg-slate-900 text-white ring-1 ring-slate-900',
  dotClass: `bg-[var(--color-property-${slug})]`,
}));

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const status = (asStringList(sp.status) ?? [])
    .filter((s): s is BookingStatus => (BOOKING_STATUSES as readonly string[]).includes(s));
  const property = asStringList(sp.property);
  const from = asDate(sp.from);
  const to = asDate(sp.to);
  const search = asString(sp.q);
  const { limit, offset } = paginate({
    page: asInt(sp.page, 1),
    limit: DEFAULT_PAGE_LIMIT,
  });

  const { rows: bookings, total } = await listBookings({
    status: status.length > 0 ? status : undefined,
    property,
    from,
    to,
    search,
    limit,
    offset,
  });

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bookings</h1>
        <p className="text-sm text-slate-500 mt-1">
          {total} matching · click a row for full detail · inline buttons run one-click status changes.
        </p>
      </div>

      <FiltersBar>
        <SearchInput placeholder="Search guest name or email…" />
        <FilterChips paramKey="status" label="Status" options={STATUS_CHIPS} />
        <FilterChips paramKey="property" label="Property" options={PROPERTY_CHIPS} />
        <DateRangePicker label="Check-in" />
        <div className="ml-auto">
          <ResetButton />
        </div>
      </FiltersBar>

      <BookingsTable bookings={bookings} />

      <Pagination total={total} limit={limit} />
    </div>
  );
}
