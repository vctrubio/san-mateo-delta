import { sql } from '@db/client';

type CountRow = { table_name: string; n: string };
type BookingRow = {
  id: string;
  access_token: string;
  status: string;
  date_check_in: string;
  date_check_out: string;
  agreed_property_cents: string;
  agreed_cleaning_cents: string;
  agreed_total_cents: string;
  guests: { adults: number; children: number; infants: number; pets: number };
  property_slug: string;
  property_title: string;
  user_name: string | null;
  user_email: string | null;
  payment_total_cents: string;
};

const TABLES = [
  'users',
  'properties',
  'property_rates',
  'bookings',
  'booking_invitations',
  'booking_service_fees',
  'booking_cancellations',
  'booking_payments',
  'payment_refunds',
  'booking_events',
];

function eur(cents: string | number) {
  const n = typeof cents === 'string' ? Number(cents) : cents;
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n / 100);
}

async function fetchCounts(): Promise<CountRow[]> {
  // UNION ALL of count(*) from each table, ordered by the original list.
  const parts = TABLES.map((t, i) => `SELECT '${t}' AS table_name, ${i} AS ord, count(*)::text AS n FROM ${t}`);
  const rows = await sql<CountRow & { ord: number }>(`${parts.join(' UNION ALL ')} ORDER BY ord`);
  return rows.map(({ table_name, n }) => ({ table_name, n }));
}

async function fetchDemoBooking(): Promise<BookingRow | null> {
  const rows = await sql<BookingRow>(`
    SELECT
      b.id::text                AS id,
      b.access_token::text      AS access_token,
      b.status::text            AS status,
      b.date_check_in::text     AS date_check_in,
      b.date_check_out::text    AS date_check_out,
      b.agreed_property_cents::text AS agreed_property_cents,
      b.agreed_cleaning_cents::text AS agreed_cleaning_cents,
      (b.agreed_property_cents + b.agreed_cleaning_cents)::text AS agreed_total_cents,
      b.guests                  AS guests,
      p.slug                    AS property_slug,
      p.title                   AS property_title,
      u.name                    AS user_name,
      u.email                   AS user_email,
      COALESCE(SUM(bp.amount_cents), 0)::text AS payment_total_cents
    FROM bookings b
    JOIN properties p          ON p.id = b.property_id
    LEFT JOIN users u          ON u.id = b.user_id
    LEFT JOIN booking_payments bp ON bp.booking_id = b.id
    GROUP BY b.id, p.slug, p.title, u.name, u.email
    ORDER BY b.created_at DESC
    LIMIT 1
  `);
  return rows[0] ?? null;
}

function CountsTable({ counts }: { counts: CountRow[] }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-mono text-[12px] uppercase tracking-widest text-slate-400">Row counts</h3>
        <span className="text-[10px] font-mono text-slate-300">live · uncached</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {counts.map((c) => (
            <tr key={c.table_name} className="border-b border-slate-50 last:border-0">
              <td className="px-5 py-2 font-mono text-[12px] text-slate-700">{c.table_name}</td>
              <td className="px-5 py-2 text-right font-mono text-[12px] text-slate-900 tabular-nums">{c.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DemoBookingCard({ b }: { b: BookingRow }) {
  return (
    <div className="rounded-2xl bg-slate-900 text-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-[12px] uppercase tracking-widest text-white/40">Most recent booking · joined</h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-ocean/20 text-ocean uppercase tracking-widest">
          {b.status}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[12px]">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-white/40">Booking</dt>
          <dd className="font-mono">#{b.id}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-white/40">Property</dt>
          <dd className="font-mono">{b.property_title} <span className="text-white/40">({b.property_slug})</span></dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-white/40">Guest</dt>
          <dd className="font-mono">{b.user_name ?? '— (invited only)'} {b.user_email && <span className="text-white/40">{b.user_email}</span>}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-white/40">Dates</dt>
          <dd className="font-mono">{b.date_check_in} → {b.date_check_out}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-white/40">Guests</dt>
          <dd className="font-mono">
            {b.guests.adults}A · {b.guests.children}C · {b.guests.infants}I · {b.guests.pets}🐾
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-white/40">Agreed (total)</dt>
          <dd className="font-mono">{eur(b.agreed_total_cents)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-white/40">Property / Cleaning</dt>
          <dd className="font-mono text-[11px]">{eur(b.agreed_property_cents)} <span className="text-white/40">(David)</span> + {eur(b.agreed_cleaning_cents)} <span className="text-white/40">(Tano)</span></dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-white/40">Paid</dt>
          <dd className="font-mono">{eur(b.payment_total_cents)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-widest text-white/40">Access token</dt>
          <dd className="font-mono text-[10px] truncate">{b.access_token}</dd>
        </div>
      </dl>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-red-50 border border-red-200 p-5">
      <h3 className="font-mono text-[12px] uppercase tracking-widest text-red-700 mb-1">Database error</h3>
      <p className="text-[12px] text-red-900 font-mono break-all">{message}</p>
      <p className="text-[11px] text-red-700 mt-2">
        Run <code className="font-mono px-1 bg-red-100 rounded">bun db:init</code> to create + seed the schema.
      </p>
    </div>
  );
}

export default async function DebugDatabasePanel() {
  let counts: CountRow[] = [];
  let demo: BookingRow | null = null;
  let error: string | null = null;

  try {
    [counts, demo] = await Promise.all([fetchCounts(), fetchDemoBooking()]);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <section className="p-8 bg-slate-50 border-t border-slate-200">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-sm font-mono uppercase tracking-widest text-slate-400 mb-1">
          Debug Database
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          Live read of Neon project <span className="font-mono">aged-dream-86824639</span>.
        </p>

        {error ? (
          <ErrorCard message={error} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CountsTable counts={counts} />
            {demo ? (
              <DemoBookingCard b={demo} />
            ) : (
              <div className="rounded-2xl bg-white border border-slate-100 p-5 text-[12px] text-slate-500">
                No bookings yet. Run <code className="font-mono">bun db:seed</code>.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
