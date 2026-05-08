'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

// Two-input from/to date range. Native <input type=date> — no extra deps.

export default function DateRangePicker({
  fromKey = 'from',
  toKey = 'to',
  label = 'Dates',
}: {
  fromKey?: string;
  toKey?: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const from = searchParams.get(fromKey) ?? '';
  const to = searchParams.get(toKey) ?? '';

  function update(key: string, value: string) {
    const u = new URLSearchParams(searchParams.toString());
    if (value === '') u.delete(key);
    else u.set(key, value);
    u.delete('page');
    const qs = u.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{label}</span>
      <input
        type="date"
        value={from}
        onChange={(e) => update(fromKey, e.target.value)}
        className={`px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean ${isPending ? 'opacity-70' : ''}`}
        aria-label="From"
      />
      <span className="text-slate-300">→</span>
      <input
        type="date"
        value={to}
        onChange={(e) => update(toKey, e.target.value)}
        className={`px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean ${isPending ? 'opacity-70' : ''}`}
        aria-label="To"
      />
    </div>
  );
}
