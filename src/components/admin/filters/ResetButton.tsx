'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { useTransition } from 'react';

// Reset button — clears every search param except optional `keepKeys`.
// Renders nothing if there's nothing to reset (keeps the bar tidy).

export default function ResetButton({ keepKeys = [] }: { keepKeys?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const params = Array.from(searchParams.entries()).filter(([k]) => !keepKeys.includes(k));
  if (params.length === 0) return null;

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        const u = new URLSearchParams();
        for (const k of keepKeys) {
          const v = searchParams.get(k);
          if (v) u.set(k, v);
        }
        const qs = u.toString();
        startTransition(() => {
          router.replace(qs ? `${pathname}?${qs}` : pathname);
        });
      }}
      className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-50"
    >
      <RotateCcw className="w-3 h-3" />
      Reset
    </button>
  );
}
