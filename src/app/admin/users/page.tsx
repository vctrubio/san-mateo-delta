import Link from 'next/link';
import { ArrowDown, ArrowUp, Equal, X } from 'lucide-react';
import AdminSection from '@/components/admin/AdminSection';
import AdminTable, { type AdminTableColumn } from '@/components/admin/AdminTable';
import UserSignUpForm from '@/components/shared/UserSignUpForm';
import FiltersBar from '@/components/admin/filters/FiltersBar';
import SearchInput from '@/components/admin/filters/SearchInput';
import SortSelect from '@/components/admin/filters/SortSelect';
import ResetButton from '@/components/admin/filters/ResetButton';
import Pagination from '@/components/admin/filters/Pagination';
import { listUsers, type ListUsersSort, type UserWithStats } from '@/lib/users';
import { listLiveBookingsByUser } from '@/lib/bookings';
import { listInvitations, type InvitationRow } from '@/lib/invitations';
import { revokeInvitation } from '@/actions/invitations';
import { fmtDate, fmtDateRange } from '@/lib/dates';
import { asInt, asString, paginate, DEFAULT_PAGE_LIMIT } from '@/lib/searchParams';
import { PROPERTY_LABELS } from '@/lib/colors';
import type { InvitationStatus } from '@db/enums';
import { eur } from '@/lib/format';
import { UserBookingChips } from '@/components/admin/UserBookingChips';
import { toBookingChipSource, type BookingChipSource } from '@/lib/bookingAdapters';

export const dynamic = 'force-dynamic';

const SORT_OPTIONS: Array<{ value: ListUsersSort; label: string }> = [
  { value: 'recent',   label: 'Most recent' },
  { value: 'bookings', label: 'Most bookings' },
  { value: 'spend',    label: 'Lifetime spend' },
];

// ─── User table ────────────────────────────────────────────────────────────

// Columns are built from a closure over the bookings-by-user map so each
// row's Status cell can render this user's live bookings as clickable chips
// (via UserBookingChips). The map is keyed by user_id; missing entries mean
// no live bookings, which renders as "—".

function userColumns(
  bookingsByUser: Map<string, BookingChipSource[]>,
): AdminTableColumn<UserWithStats>[] {
  return [
    {
      key: 'identity',
      header: 'Name · Email',
      width: 'minmax(0,1.6fr)',
      render: (u) => (
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{u.name}</div>
          <div className="text-xs text-slate-500 mt-1 font-mono truncate">{u.email}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'minmax(0,1.6fr)',
      render: (u) => (
        <UserBookingChips bookings={bookingsByUser.get(u.id) ?? []} />
      ),
    },
    {
      key: 'bookings',
      header: 'Bookings',
      align: 'right',
      width: '90px',
      render: (u) => (
        <span className="font-mono tabular-nums text-sm text-slate-700">
          {u.total_bookings}
        </span>
      ),
    },
    {
      key: 'spend',
      header: 'Lifetime',
      align: 'right',
      width: '110px',
      render: (u) => (
        <span className="font-mono tabular-nums text-sm text-slate-900">
          {eur(u.lifetime_spend_cents)}
        </span>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      align: 'right',
      width: '120px',
      render: (u) => (
        <span className="text-xs text-slate-400">{fmtDate(u.created_at)}</span>
      ),
    },
  ];
}

// ─── Invitations table (embedded) ──────────────────────────────────────────
//
// Invitations no longer have their own route. They live as a section here
// because every invitation is tied to a guest user (or pending email), so
// /admin/users is the natural home. Click a row to jump to the booking
// detail; revoke inline.

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

const INVITATION_COLUMNS: AdminTableColumn<InvitationRow>[] = [
  {
    key: 'status',
    header: 'Status',
    width: 'minmax(0,0.7fr)',
    render: (i) => <InvitationStatusBadge status={i.invitation_status} />,
  },
  {
    key: 'identity',
    header: 'Property · Invitee',
    width: 'minmax(0,1.6fr)',
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
    render: (i) => (
      <span className="text-sm text-slate-700 tabular-nums">
        {fmtDateRange(i.date_check_in, i.date_check_out)}
      </span>
    ),
  },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    width: '110px',
    render: (i) => (
      <span className="font-mono tabular-nums text-sm text-slate-900">
        {eur(i.agreed_total_cents)}
      </span>
    ),
  },
  {
    key: 'diff',
    header: 'vs default',
    align: 'right',
    width: 'minmax(0,0.9fr)',
    render: (i) => (
      <DiffPill
        customCents={i.agreed_total_cents}
        defaultCents={
          i.default_property_cents != null && i.default_cleaning_cents != null
            ? i.default_property_cents + i.default_cleaning_cents
            : null
        }
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

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const search = asString(sp.q);
  const sort = (asString(sp.sort) as ListUsersSort | undefined) ?? 'recent';
  const { limit, offset } = paginate({ page: asInt(sp.page, 1), limit: DEFAULT_PAGE_LIMIT });

  // Users + the most recent batch of invitations in parallel. Invitations
  // table has no filters/pagination (yet) — small surface, recent slice is
  // enough for the embedded view.
  const [{ rows: users, total }, invitationsResult] = await Promise.all([
    listUsers({ search, sort, limit, offset }),
    listInvitations({ limit: 25 }),
  ]);

  // Live bookings per visible user — drives the Status column's chip strip.
  // Single SQL hop keyed on the page's user_ids; users with nothing live
  // render "—". Map each row through `toBookingChipSource` so the prop
  // payload sent to UserBookingChips excludes internal fields
  // (access_token, cancellation metadata, time stamps, etc.).
  const rawBookingsByUser = await listLiveBookingsByUser(users.map((u) => u.id));
  const bookingsByUser = new Map<string, BookingChipSource[]>();
  for (const [userId, rows] of rawBookingsByUser) {
    bookingsByUser.set(userId, rows.map(toBookingChipSource));
  }
  const USER_COLUMNS = userColumns(bookingsByUser);

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
          columns={USER_COLUMNS}
          rows={users}
          rowKey={(u) => u.id}
          rowHref={(u) => `/admin/users/${u.id}`}
          emptyMessage="No users match these filters."
        />
        <Pagination total={total} limit={limit} />
      </AdminSection>

      <AdminSection
        eyebrow="Invitations"
        hint={
          invitationsResult.total > invitationsResult.rows.length
            ? `${invitationsResult.rows.length} of ${invitationsResult.total} most recent`
            : `${invitationsResult.total} ${invitationsResult.total === 1 ? 'invitation' : 'invitations'}`
        }
      >
        <AdminTable
          columns={INVITATION_COLUMNS}
          rows={invitationsResult.rows}
          rowKey={(i) => i.invitation_id}
          rowHref={(i) => `/admin/bookings/${i.booking_id}`}
          emptyMessage="No invitations issued yet."
        />
      </AdminSection>
    </>
  );
}
