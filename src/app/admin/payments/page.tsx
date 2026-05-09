import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import AdminSection from '@/components/admin/AdminSection';
import AdminTable, { type AdminTableColumn } from '@/components/admin/AdminTable';
import FiltersBar from '@/components/admin/filters/FiltersBar';
import FilterChips from '@/components/admin/filters/FilterChips';
import DateRangePicker from '@/components/admin/filters/DateRangePicker';
import ResetButton from '@/components/admin/filters/ResetButton';
import Pagination from '@/components/admin/filters/Pagination';
import { listPayments, type PaymentRow } from '@/lib/payments';
import { fmtDateTime } from '@/lib/dates';
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

function MethodBadge({ method, intent }: { method: PaymentMethod; intent: string | null }) {
  if (method === 'stripe') {
    const href = intent ? `https://dashboard.stripe.com/test/payments/${intent}` : null;
    const inner = (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-xs bg-violet-50 text-violet-800 ring-1 ring-violet-200">
        stripe {href && <ExternalLink className="w-2.5 h-2.5" />}
      </span>
    );
    return href ? (
      <a href={href} target="_blank" rel="noreferrer noopener" className="relative z-10 hover:opacity-80">
        {inner}
      </a>
    ) : inner;
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-xs bg-amber-50 text-amber-800 ring-1 ring-amber-200">
      cash
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const cls =
    status === 'succeeded' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-200'
    : 'bg-rose-50 text-rose-700 ring-rose-200';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-xs ring-1 ${cls}`}>
      {status}
    </span>
  );
}

const COLUMNS: AdminTableColumn<PaymentRow>[] = [
  {
    key: 'id',
    header: '#',
    width: '64px',
    render: (p) => <span className="font-mono text-xs text-slate-400">#{p.id}</span>,
  },
  {
    key: 'identity',
    header: 'Property · Guest',
    width: 'minmax(0,1.5fr)',
    render: (p) => (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: `var(--color-property-${p.property_slug})` }} />
          <span className="text-sm font-semibold text-slate-900">
            {PROPERTY_LABELS[p.property_slug as keyof typeof PROPERTY_LABELS] ?? p.property_slug}
          </span>
        </div>
        <div className="text-xs text-slate-500 mt-1 truncate">
          {p.user_name ?? <span className="italic text-slate-400">—</span>}
          {' '}<span className="text-slate-300">·</span>{' '}
          <Link href={`/admin/bookings/${p.booking_id}`} className="relative z-10 font-mono text-ocean hover:underline">
            booking #{p.booking_id}
          </Link>
        </div>
      </div>
    ),
  },
  {
    key: 'type',
    header: 'Type',
    width: 'minmax(0,0.8fr)',
    render: (p) => <span className="font-mono text-xs text-slate-700">{p.type}</span>,
  },
  {
    key: 'method',
    header: 'Method',
    width: 'minmax(0,0.8fr)',
    render: (p) => <MethodBadge method={p.method} intent={p.stripe_payment_intent} />,
  },
  {
    key: 'status',
    header: 'Status',
    width: 'minmax(0,0.8fr)',
    render: (p) => <PaymentStatusBadge status={p.status} />,
  },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    width: '110px',
    render: (p) => <span className="font-mono tabular-nums text-sm text-slate-900">{eur(p.amount_cents)}</span>,
  },
  {
    key: 'refund',
    header: 'Refunded',
    align: 'right',
    width: '110px',
    render: (p) =>
      p.refunded_cents > 0
        ? <span className="font-mono tabular-nums text-sm text-rose-700">−{eur(p.refunded_cents)}</span>
        : <span className="text-slate-300">—</span>,
  },
  {
    key: 'when',
    header: 'When',
    align: 'right',
    width: '160px',
    render: (p) => <span className="text-xs text-slate-400">{fmtDateTime(p.paid_at)}</span>,
  },
];

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
  const { limit, offset } = paginate({ page: asInt(sp.page, 1), limit: DEFAULT_PAGE_LIMIT });

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
    <>
      <FiltersBar>
        <FilterChips paramKey="method"      label="Method"   options={METHOD_CHIPS} />
        <FilterChips paramKey="status"      label="Status"   options={STATUS_CHIPS} />
        <FilterChips paramKey="type"        label="Type"     options={TYPE_CHIPS} />
        <FilterChips paramKey="property"    label="Property" options={PROPERTY_CHIPS} />
        <FilterChips paramKey="refund_only" label="Refunds"  options={REFUND_CHIPS} />
        <DateRangePicker label="Paid" />
        <div className="ml-auto">
          <ResetButton />
        </div>
      </FiltersBar>

      <AdminSection eyebrow="All payments">
        <AdminTable
          columns={COLUMNS}
          rows={payments}
          rowKey={(p) => p.id}
          rowHref={(p) => `/admin/bookings/${p.booking_id}`}
          emptyMessage="No payments match these filters."
        />
        <Pagination total={total} limit={limit} />
      </AdminSection>
    </>
  );
}
