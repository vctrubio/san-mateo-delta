'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export type SortOption = { value: string; label: string };

export default function SortSelect({
  paramKey = 'sort',
  label = 'Sort',
  options,
}: {
  paramKey?: string;
  label?: string;
  options: SortOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const value = searchParams.get(paramKey) ?? options[0]?.value;

  function set(v: string) {
    const u = new URLSearchParams(searchParams.toString());
    if (v === options[0]?.value) u.delete(paramKey);
    else u.set(paramKey, v);
    u.delete('page');
    const qs = u.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <label className="inline-flex items-center gap-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => set(e.target.value)}
        className={`px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean ${isPending ? 'opacity-70' : ''}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
