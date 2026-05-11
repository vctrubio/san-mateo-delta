'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

// ============================================================================
// Multi-select chip group, URL-driven. Reads its current value from the
// `paramKey` search param (comma-separated list), writes back via
// router.replace on click. Resets `page` to 1 on any change so the user
// doesn't end up on an empty page after filtering.
// ============================================================================

export type ChipOption = {
  value: string;
  label: string;
  /** Tailwind classes for the active chip (background + text + ring). */
  activeClass?: string;
  /** Optional small dot in the chip. */
  dotClass?: string;
};

export default function FilterChips({
  paramKey,
  label,
  options,
}: {
  paramKey: string;
  label: string;
  options: ChipOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const current = (searchParams.get(paramKey)?.split(',').filter(Boolean) ?? []) as string[];

  function toggle(value: string) {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];

    const u = new URLSearchParams(searchParams.toString());
    if (next.length === 0) {
      u.delete(paramKey);
    } else {
      u.set(paramKey, next.join(','));
    }
    u.delete('page'); // reset pagination
    const qs = u.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-mono uppercase tracking-widest text-slate-400 mr-1">
        {label}
      </span>
      {options.map((opt) => {
        const active = current.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            disabled={isPending}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-widest transition-colors',
              active
                ? opt.activeClass ?? 'bg-slate-900 text-white ring-1 ring-slate-900'
                : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-slate-300',
              isPending ? 'opacity-60' : '',
            ].join(' ')}
          >
            {opt.dotClass && (
              <span className={`w-2 h-2 rounded-full ${opt.dotClass}`} />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
