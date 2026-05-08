'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTransition } from 'react';

// Reads `page` from the URL, defaults to 1. Disables Prev/Next at the bounds.
// Always shows "Showing X–Y of Z" so the user knows what they're looking at.

export default function Pagination({
  total,
  limit,
  paramKey = 'page',
}: {
  total: number;
  limit: number;
  paramKey?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const page = Math.max(1, parseInt(searchParams.get(paramKey) ?? '1', 10) || 1);
  const lastPage = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);

  function goto(p: number) {
    if (p < 1 || p > lastPage || p === page) return;
    const u = new URLSearchParams(searchParams.toString());
    if (p === 1) u.delete(paramKey);
    else u.set(paramKey, String(p));
    const qs = u.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between mt-5 px-2">
      <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1 || isPending}
          onClick={() => goto(page - 1)}
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-3 py-1.5 text-[11px] font-mono text-slate-500 tabular-nums">
          {page} / {lastPage}
        </span>
        <button
          type="button"
          disabled={page >= lastPage || isPending}
          onClick={() => goto(page + 1)}
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
