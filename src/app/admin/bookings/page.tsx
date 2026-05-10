import AdminSection from '@/components/admin/AdminSection';
import AdminTable, { type AdminTableColumn } from '@/components/admin/AdminTable';
import StatusBadge from '@/components/admin/StatusBadge';
import BookingActionButtons from '@/components/admin/BookingActionButtons';
import FiltersBar from '@/components/admin/filters/FiltersBar';
import FilterChips from '@/components/admin/filters/FilterChips';
import SearchInput from '@/components/admin/filters/SearchInput';
import DateRangePicker from '@/components/admin/filters/DateRangePicker';
import ResetButton from '@/components/admin/filters/ResetButton';
import Pagination from '@/components/admin/filters/Pagination';
import { listBookings, type BookingRow } from '@/lib/bookings';
import { fmtDateRange } from '@/lib/dates';
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

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

const COLUMNS: AdminTableColumn<BookingRow>[] = [
  {
    key: 'id',
    header: '#',
    width: '72px',
    render: (b) => <span className="font-mono text-xs text-slate-400">#{b.id}</span>,
  },
  {
    key: 'identity',
    header: 'Property · Guest',
    width: 'minmax(0,1.6fr)',
    render: (b) => (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: `var(--color-property-${b.property_slug})` }} />
          <span className="text-sm font-semibold text-slate-900">
            {PROPERTY_LABELS[b.property_slug as keyof typeof PROPERTY_LABELS] ?? b.property_slug}
          </span>
        </div>
        <div className="text-xs text-slate-500 mt-1 truncate">
          {b.user_name ?? <span className="italic text-slate-400">no user</span>}
          {b.user_email && <> <span className="text-slate-300">·</span> <span className="font-mono text-slate-400">{b.user_email}</span></>}
        </div>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: 'minmax(0,0.9fr)',
    render: (b) => <StatusBadge status={b.status} />,
  },
  {
    key: 'dates',
    header: 'Dates',
    width: 'minmax(0,1.3fr)',
    render: (b) => (
      <div className="text-sm text-slate-700 tabular-nums">
        {fmtDateRange(b.date_check_in, b.date_check_out)}
      </div>
    ),
  },
  {
    key: 'agreed',
    header: 'Agreed',
    align: 'right',
    width: '100px',
    render: (b) => <span className="font-mono tabular-nums text-sm text-slate-900">{eur(b.agreed_total_cents)}</span>,
  },
  {
    key: 'paid',
    header: 'Paid',
    align: 'right',
    width: '100px',
    render: (b) => {
      const fullyPaid = b.paid_cents >= b.agreed_total_cents;
      const tone = fullyPaid ? 'text-emerald-700' : b.paid_cents === 0 ? 'text-slate-300' : 'text-amber-700';
      return <span className={`font-mono tabular-nums text-sm ${tone}`}>{eur(b.paid_cents)}</span>;
    },
  },
  {
    key: 'actions',
    header: '',
    width: '200px',
    render: (b) => (
      <div className="relative z-10 inline-flex">
        <BookingActionButtons bookingId={b.id} currentStatus={b.status} />
      </div>
    ),
  },
];

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
    <>
      {/* <FiltersBar>
        <SearchInput placeholder="Search guest name or email…" />
        <FilterChips paramKey="status" label="Status" options={STATUS_CHIPS} />
        <FilterChips paramKey="property" label="Property" options={PROPERTY_CHIPS} />
        <DateRangePicker label="Check-in" />
        <div className="ml-auto">
          <ResetButton />
        </div>
      </FiltersBar> */}

      <AdminSection eyebrow="All bookings">
        <AdminTable
          columns={COLUMNS}
          rows={bookings}
          rowKey={(b) => b.id}
          rowHref={(b) => `/admin/bookings/${b.id}`}
          emptyMessage="No bookings match these filters."
        />
        <Pagination total={total} limit={limit} />
      </AdminSection>
    </>
  );
}
