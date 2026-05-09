import AdminNavigation from '@/components/admin/AdminNavigation';

// Admin shell. Wraps every /admin/* route.
//
// `actions` is a Next.js parallel-route slot (folder: src/app/admin/@actions).
// The default fallback is `@actions/default.tsx` (two circles: notifications
// + account). Any specific admin route can override the slot by adding a
// sibling page under `@actions/<segment>/page.tsx` and rendering its own
// buttons.
//
// Layout grid:
//   < 2xl:  single column. Gutters are display:none, so the middle column
//           takes everything. Content is constrained by `<main>` padding only.
//   ≥ 2xl:  three columns — `1fr | minmax(0,1536px) | 1fr`. Middle is capped
//           at 1536px (max-w-screen-2xl), gutters split the rest. Earlier
//           attempts used `flex-1` everywhere which turned the middle into
//           1/3 of the viewport — exactly the squash the user spotted.
//
// `<main>` owns the per-page padding (`px-4 sm:px-6 pb-12`) so individual
// pages don't repeat that boilerplate.
export default function AdminLayout({
  children,
  actions,
}: {
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid grid-cols-1 2xl:grid-cols-[1fr_minmax(0,1536px)_1fr]">
        <Gutter side="left" />
        <div className="min-w-0">
          <AdminNavigation>{actions}</AdminNavigation>
          <main className="px-4 sm:px-6 pb-12">{children}</main>
        </div>
        <Gutter side="right" />
      </div>
    </div>
  );
}

function Gutter({ side }: { side: 'left' | 'right' }) {
  const text = side === 'left' ? 'finca · san · mateo' : 'admin · console · v0.4';
  return (
    <div className="hidden 2xl:flex items-center justify-center py-12 min-w-0">
      <span
        className="text-xs font-mono uppercase tracking-[0.45em] text-slate-300 whitespace-nowrap"
        style={{
          writingMode: 'vertical-rl',
          transform: side === 'left' ? 'rotate(180deg)' : undefined,
        }}
      >
        {text}
      </span>
    </div>
  );
}
