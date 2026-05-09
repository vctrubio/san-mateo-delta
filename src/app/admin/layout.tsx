import AdminNavigation from '@/components/admin/AdminNavigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid grid-cols-1 2xl:grid-cols-[1fr_minmax(0,1536px)_1fr]">
        <Gutter side="left" />
        <div className="min-w-0">
          <AdminNavigation />
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
