'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

// Debounced URL-driven search input. Shows a clear (X) button when populated.

export default function SearchInput({
  paramKey = 'q',
  placeholder = 'Search…',
  debounceMs = 250,
}: {
  paramKey?: string;
  placeholder?: string;
  debounceMs?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const initial = searchParams.get(paramKey) ?? '';
  const [value, setValue] = useState(initial);

  // Sync state when URL changes externally (e.g. clicking Reset).
  useEffect(() => {
    setValue(searchParams.get(paramKey) ?? '');
  }, [paramKey, searchParams]);

  // Debounced URL update
  useEffect(() => {
    const t = setTimeout(() => {
      const current = searchParams.get(paramKey) ?? '';
      if (value === current) return;
      const u = new URLSearchParams(searchParams.toString());
      if (value.trim() === '') u.delete(paramKey);
      else u.set(paramKey, value.trim());
      u.delete('page');
      const qs = u.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      });
    }, debounceMs);
    return () => clearTimeout(t);
  }, [value, paramKey, debounceMs, pathname, router, searchParams]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={`pl-9 pr-9 py-2 rounded-lg border border-slate-200 bg-white text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean ${isPending ? 'opacity-70' : ''}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 text-slate-400"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
