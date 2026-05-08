import PaymentsTable from '@/components/admin/PaymentsTable';
import FiltersBar from '@/components/admin/filters/FiltersBar';
import FilterChips from '@/components/admin/filters/FilterChips';
import DateRangePicker from '@/components/admin/filters/DateRangePicker';
import ResetButton from '@/components/admin/filters/ResetButton';
import Pagination from '@/components/admin/filters/Pagination';
import { listPayments } from '@/lib/payments';
import { asInt, asStringList, asDate, asBool, paginate, DEFAULT_PAGE_LIMIT } from '@/lib/searchParams';
import {
  PAYMENT_TYPES, type PaymentType,
  PAYMENT_METHODS, type PaymentMethod,
  PAYMENT_STATUSES, type PaymentStatus,
} from '@db/enums';
import { PROPERTY_SLUGS, PROPERTY_LABELS } from '@/lib/colors';

export const dynamic = 'force-dynamic';

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

const TYPE_CHIPS = PAYMENT_TYPES.map((t) => ({
  value: t,
  label: t.replace('_', ' '),
  activeClass: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  dotClass: 'bg-emerald-500',
}));

const PROPERTY_CHIPS = PROPERTY_SLUGS.map((slug) => ({
  value: slug,
  label: PROPERTY_LABELS[slug],
  activeClass: 'bg-slate-900 text-white ring-1 ring-slate-900',
  dotClass: `bg-[var(--color-property-${slug})]`,
}));

const REFUND_CHIPS = [
  {
    value: 'true',
    label: 'Has refund',
    activeClass: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    dotClass: 'bg-rose-400',
  },
];

const METHOD_CHIPS = PAYMENT_METHODS.map((m) => ({
  value: m,
  label: m,
  activeClass: m === 'cash'
    ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
    : 'bg-violet-50 text-violet-800 ring-1 ring-violet-200',
  dotClass: m === 'cash' ? 'bg-amber-500' : 'bg-violet-500',
}));

const STATUS_CHIPS = PAYMENT_STATUSES.map((s) => ({
  value: s,
  label: s,
  activeClass:
    s === 'succeeded' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    : s === 'pending' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  dotClass:
    s === 'succeeded' ? 'bg-emerald-500'
    : s === 'pending' ? 'bg-amber-500'
    : 'bg-rose-500',
}));

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const type = (asStringList(sp.type) ?? [])
    .filter((t): t is PaymentType => (PAYMENT_TYPES as readonly string[]).includes(t));
  const method = (asStringList(sp.method) ?? [])
    .filter((m): m is PaymentMethod => (PAYMENT_METHODS as readonly string[]).includes(m));
  const status = (asStringList(sp.status) ?? [])
    .filter((s): s is PaymentStatus => (PAYMENT_STATUSES as readonly string[]).includes(s));
  const property = asStringList(sp.property);
  const refund_only = asBool(sp.refund_only);
  const from = asDate(sp.from);
  const to = asDate(sp.to);
  const { limit, offset } = paginate({
    page: asInt(sp.page, 1),
    limit: DEFAULT_PAGE_LIMIT,
  });

  const { rows: payments, total } = await listPayments({
    type: type.length > 0 ? type : undefined,
    method: method.length > 0 ? method : undefined,
    status: status.length > 0 ? status : undefined,
    property,
    refund_only,
    from,
    to,
    limit,
    offset,
  });

  const grossCents = payments.reduce((sum, p) => sum + p.amount_cents - p.refunded_cents, 0);
  const refundedCents = payments.reduce((sum, p) => sum + p.refunded_cents, 0);

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Payments</h1>
        <p className="text-sm text-slate-500 mt-1">
          {total} matching · this page net {eur(grossCents)}
          {refundedCents > 0 && <> · {eur(refundedCents)} refunded</>}
        </p>
      </div>

      <FiltersBar>
        <FilterChips paramKey="method"   label="Method"   options={METHOD_CHIPS} />
        <FilterChips paramKey="status"   label="Status"   options={STATUS_CHIPS} />
        <FilterChips paramKey="type"     label="Type"     options={TYPE_CHIPS} />
        <FilterChips paramKey="property" label="Property" options={PROPERTY_CHIPS} />
        <FilterChips paramKey="refund_only" label="Refunds" options={REFUND_CHIPS} />
        <DateRangePicker label="Paid" />
        <div className="ml-auto">
          <ResetButton />
        </div>
      </FiltersBar>

      <PaymentsTable payments={payments} />

      <Pagination total={total} limit={limit} />
    </div>
  );
}
