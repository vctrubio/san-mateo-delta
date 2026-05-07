import {
  BOOKING_STATUSES,
  INVITATION_STATUSES,
  SERVICE_FEE_TYPES,
  PAYMENT_TYPES,
} from '@db/enums';

type Column = {
  name: string;
  type: string;
  pk?: boolean;
  fk?: string;
  unique?: boolean;
  nullable?: boolean;
  enum?: string;
  note?: string;
};

type Table = {
  name: string;
  domain: 'identity' | 'property' | 'booking' | 'payment' | 'audit';
  summary: string;
  columns: Column[];
};

const ENUMS: { name: string; values: readonly string[] }[] = [
  { name: 'booking_status',    values: BOOKING_STATUSES },
  { name: 'invitation_status', values: INVITATION_STATUSES },
  { name: 'service_fee_type',  values: SERVICE_FEE_TYPES },
  { name: 'payment_type',      values: PAYMENT_TYPES },
];

const TABLES: Table[] = [
  {
    name: 'users',
    domain: 'identity',
    summary: 'Identity profile. Auth deferred — no password column yet.',
    columns: [
      { name: 'id', type: 'BIGSERIAL', pk: true },
      { name: 'name', type: 'TEXT' },
      { name: 'email', type: 'TEXT', unique: true },
      { name: 'tif', type: 'TEXT', nullable: true, note: 'Spanish tax ID (NIF/NIE)' },
      { name: 'nationality', type: 'TEXT', nullable: true },
      { name: 'dob', type: 'DATE', nullable: true },
    ],
  },
  {
    name: 'properties',
    domain: 'property',
    summary: 'The four units inside Finca San Mateo. Characteristics inlined (1:1, no join).',
    columns: [
      { name: 'id', type: 'BIGSERIAL', pk: true },
      { name: 'slug', type: 'TEXT', unique: true },
      { name: 'title', type: 'TEXT' },
      { name: 'description', type: 'TEXT' },
      { name: 'features', type: 'JSONB', note: 'Per-property highlights array' },
      { name: 'bedrooms', type: 'INT' },
      { name: 'bathrooms', type: 'INT' },
      { name: 'm2', type: 'INT' },
      { name: 'max_guests', type: 'INT' },
    ],
  },
  {
    name: 'property_rates',
    domain: 'property',
    summary: 'Per-night pricing. Selected at quote time by month + min_nights. See db/rates.md.',
    columns: [
      { name: 'id', type: 'BIGSERIAL', pk: true },
      { name: 'property_id', type: 'BIGINT', fk: 'properties.id' },
      { name: 'name', type: 'TEXT', note: 'Low Season / High Season / Long-Stay …' },
      { name: 'active', type: 'BOOLEAN' },
      { name: 'public', type: 'BOOLEAN', note: 'false = invite-only' },
      { name: 'min_nights', type: 'INT', note: 'minimum stay required to qualify' },
      { name: 'months', type: 'INT[]', note: 'months 1-12 when this rate applies' },
      { name: 'night_rate_cents', type: 'BIGINT' },
    ],
  },
  {
    name: 'property_cleaning_fee',
    domain: 'property',
    summary: 'Per-property cleaning fee. Only one row active at a time.',
    columns: [
      { name: 'id', type: 'BIGSERIAL', pk: true },
      { name: 'property_id', type: 'BIGINT', fk: 'properties.id' },
      { name: 'fee_cents', type: 'BIGINT' },
      { name: 'active', type: 'BOOLEAN' },
    ],
  },
  {
    name: 'bookings',
    domain: 'booking',
    summary: 'Core reservation. Exclusion constraint blocks overlapping confirmed dates.',
    columns: [
      { name: 'id', type: 'BIGSERIAL', pk: true },
      { name: 'access_token', type: 'UUID', unique: true, note: 'Public link for unauthenticated viewing' },
      { name: 'property_id', type: 'BIGINT', fk: 'properties.id' },
      { name: 'user_id', type: 'BIGINT', fk: 'users.id', nullable: true },
      { name: 'date_check_in', type: 'DATE' },
      { name: 'date_check_out', type: 'DATE' },
      { name: 'agreed_price_cents', type: 'BIGINT' },
      { name: 'status', type: 'ENUM', enum: 'booking_status' },
      { name: 'guests', type: 'JSONB', note: 'adults / children / infants / pets' },
      { name: 'time_check_in', type: 'TIMESTAMPTZ', nullable: true },
      { name: 'time_check_out', type: 'TIMESTAMPTZ', nullable: true },
      { name: 'cancelled_at', type: 'TIMESTAMPTZ', nullable: true },
      { name: 'cancellation_reason', type: 'TEXT', nullable: true },
    ],
  },
  {
    name: 'booking_invitations',
    domain: 'booking',
    summary: '1:1 with bookings of status=invite. Tracks the email invite flow.',
    columns: [
      { name: 'id', type: 'BIGSERIAL', pk: true },
      { name: 'booking_id', type: 'BIGINT', fk: 'bookings.id', unique: true },
      { name: 'email', type: 'TEXT' },
      { name: 'status', type: 'ENUM', enum: 'invitation_status' },
      { name: 'accepted_user_id', type: 'BIGINT', fk: 'users.id', nullable: true },
      { name: 'invited_at', type: 'TIMESTAMPTZ' },
      { name: 'responded_at', type: 'TIMESTAMPTZ', nullable: true },
    ],
  },
  {
    name: 'booking_service_fees',
    domain: 'booking',
    summary: 'Extras charged per booking: late checkout, extra cleaning, commission.',
    columns: [
      { name: 'id', type: 'BIGSERIAL', pk: true },
      { name: 'booking_id', type: 'BIGINT', fk: 'bookings.id' },
      { name: 'type', type: 'ENUM', enum: 'service_fee_type' },
      { name: 'amount_cents', type: 'BIGINT' },
      { name: 'note', type: 'TEXT', nullable: true },
    ],
  },
  {
    name: 'booking_payments',
    domain: 'payment',
    summary: 'Each payment slice for a booking. cash=true while Stripe is deferred.',
    columns: [
      { name: 'id', type: 'BIGSERIAL', pk: true },
      { name: 'booking_id', type: 'BIGINT', fk: 'bookings.id' },
      { name: 'type', type: 'ENUM', enum: 'payment_type' },
      { name: 'amount_cents', type: 'BIGINT' },
      { name: 'cash', type: 'BOOLEAN' },
      { name: 'paid_at', type: 'TIMESTAMPTZ' },
    ],
  },
  {
    name: 'payment_refunds',
    domain: 'payment',
    summary: 'Refunds against a payment row. Multiple per payment allowed.',
    columns: [
      { name: 'id', type: 'BIGSERIAL', pk: true },
      { name: 'payment_id', type: 'BIGINT', fk: 'booking_payments.id' },
      { name: 'amount_cents', type: 'BIGINT' },
      { name: 'note', type: 'TEXT', nullable: true },
    ],
  },
  {
    name: 'booking_events',
    domain: 'audit',
    summary: 'Append-only audit log of state transitions and host actions.',
    columns: [
      { name: 'id', type: 'BIGSERIAL', pk: true },
      { name: 'booking_id', type: 'BIGINT', fk: 'bookings.id' },
      { name: 'event_type', type: 'TEXT', note: "'booking.created' / 'booking.confirmed' / …" },
      { name: 'payload', type: 'JSONB' },
    ],
  },
];

const DOMAIN_STYLES: Record<
  Table['domain'],
  { label: string; chip: string; ring: string; dot: string; description: string }
> = {
  identity: {
    label: 'Identity',
    chip: 'bg-sky text-ocean',
    ring: 'ring-sky-200',
    dot: 'bg-sky-400',
    description: 'Who is using the system: guests and (eventually) hosts/admins.',
  },
  property: {
    label: 'Property',
    chip: 'bg-sand text-slate-700',
    ring: 'ring-amber-200',
    dot: 'bg-amber-400',
    description: 'The four units in Finca San Mateo and their per-property pricing/cleaning.',
  },
  booking: {
    label: 'Booking',
    chip: 'bg-ocean/10 text-ocean',
    ring: 'ring-ocean/30',
    dot: 'bg-ocean',
    description: 'Reservations and everything attached to them: invitations, service fees.',
  },
  payment: {
    label: 'Payment',
    chip: 'bg-emerald-50 text-emerald-700',
    ring: 'ring-emerald-200',
    dot: 'bg-emerald-500',
    description: 'Money in (booking_payments) and money out (payment_refunds).',
  },
  audit: {
    label: 'Audit',
    chip: 'bg-slate-100 text-slate-600',
    ring: 'ring-slate-200',
    dot: 'bg-slate-400',
    description: 'Append-only event log of state transitions and host actions.',
  },
};

function DomainLegend() {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-4 mb-6">
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-3">
        Domain colors
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {Object.entries(DOMAIN_STYLES).map(([key, style]) => (
          <div key={key} className="flex items-start gap-2.5">
            <span className={`w-3 h-3 rounded-full mt-1 shrink-0 ${style.dot}`} />
            <div>
              <div className="font-mono text-[12px] font-bold text-slate-900">{style.label}</div>
              <div className="text-[11px] text-slate-500 leading-snug">{style.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColumnBadge({ col }: { col: Column }) {
  const flags: string[] = [];
  if (col.pk) flags.push('PK');
  if (col.unique && !col.pk) flags.push('UNIQUE');
  if (col.nullable) flags.push('NULL');

  return (
    <li className="flex flex-col gap-0.5 py-1.5 border-b border-slate-100 last:border-0">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`font-mono text-[12px] ${col.pk ? 'font-bold text-slate-900' : 'text-slate-700'}`}>
          {col.name}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          {col.enum ?? col.type}
        </span>
        {flags.map((f) => (
          <span key={f} className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
            {f}
          </span>
        ))}
        {col.fk && (
          <span className="text-[10px] font-mono text-ocean">→ {col.fk}</span>
        )}
      </div>
      {col.note && (
        <span className="text-[10px] text-slate-400 italic pl-0.5">{col.note}</span>
      )}
    </li>
  );
}

function TableCard({ table }: { table: Table }) {
  const style = DOMAIN_STYLES[table.domain];
  return (
    <div className={`rounded-2xl bg-white border border-slate-100 ring-1 ${style.ring} p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-mono text-sm font-bold text-slate-900">{table.name}</h3>
        <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full ${style.chip}`}>
          {style.label}
        </span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed mb-3">{table.summary}</p>
      <ul className="text-[12px]">
        {table.columns.map((c) => (
          <ColumnBadge key={c.name} col={c} />
        ))}
      </ul>
    </div>
  );
}

function EnumStrip() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {ENUMS.map((e) => (
        <div key={e.name} className="rounded-xl bg-slate-50 border border-slate-100 p-4">
          <h4 className="font-mono text-[12px] font-bold text-slate-900 mb-2">{e.name}</h4>
          <div className="flex flex-wrap gap-1.5">
            {e.values.map((v) => (
              <span
                key={v}
                className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600"
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RelationsLegend() {
  const groups: Record<string, string[]> = {
    'properties → ': ['property_rates', 'property_cleaning_fee'],
    'bookings → ': ['booking_invitations', 'booking_service_fees', 'booking_payments', 'booking_events'],
    'booking_payments → ': ['payment_refunds'],
    'users → ': ['bookings.user_id', 'booking_invitations.accepted_user_id'],
  };
  return (
    <div className="rounded-xl bg-slate-900 text-white p-5">
      <h4 className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3">Relations</h4>
      <ul className="space-y-1.5">
        {Object.entries(groups).map(([parent, children]) => (
          <li key={parent} className="font-mono text-[11px]">
            <span className="text-ocean">{parent}</span>
            <span className="text-white/70">{children.join(', ')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DebugSchemaPanel() {
  return (
    <section className="p-8 bg-white border-t border-slate-200">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-sm font-mono uppercase tracking-widest text-slate-400 mb-1">
          Debug Schema
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          10 tables · 4 enums · EUR cents everywhere · double-booking blocked by exclusion constraint.
        </p>

        <DomainLegend />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {TABLES.map((t) => (
            <TableCard key={t.name} table={t} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <h3 className="text-xs font-mono uppercase text-slate-400 mb-3">Enums</h3>
            <EnumStrip />
          </div>
          <RelationsLegend />
        </div>
      </div>
    </section>
  );
}
