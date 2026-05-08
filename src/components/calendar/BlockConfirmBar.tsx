'use client';

import { useState, useTransition } from 'react';
import { CalendarX, Loader2 } from 'lucide-react';
import { createBlock } from '@/actions/blocks';
import { differenceInDays, ymd } from './dateUtils';
import { fmtDateRange } from '@/lib/dates';

// Appears at the bottom of the admin calendar once the host has selected a
// valid (no held overlaps) date range. Two-click flow per the design:
//   1) click start day  → range opens
//   2) click end day    → this bar appears with reason input + Block button
// The action does the real overlap check too — we surface its error in-bar.

export type BlockConfirmBarProps = {
  slug: string;
  start: Date;
  end: Date;
  onClear: () => void;
  onSuccess: () => void;
};

export default function BlockConfirmBar({ slug, start, end, onClear, onSuccess }: BlockConfirmBarProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const nights = differenceInDays(end, start);

  function submit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('slug', slug);
      fd.set('date_check_in', ymd(start));
      fd.set('date_check_out', ymd(end));
      if (reason.trim()) fd.set('reason', reason.trim());
      const result = await createBlock(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess();
    });
  }

  return (
    <div className="rounded-2xl bg-slate-900 text-white p-5 mt-4 shadow-2xl shadow-slate-900/20 border border-slate-800">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/50 mb-1">
            Block dates · {nights} night{nights === 1 ? '' : 's'}
          </p>
          <p className="text-base font-bold tracking-tight">
            {fmtDateRange(start, end)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] font-mono uppercase tracking-widest text-white/50 hover:text-white"
        >
          Clear
        </button>
      </div>

      <div className="mt-4">
        <label className="block text-[10px] font-mono uppercase tracking-[0.3em] text-white/50 mb-1">
          Reason (optional)
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Owner stay · Maintenance · Pause listing"
          className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-ocean focus:ring-2 focus:ring-ocean/30"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-rose-500/15 border border-rose-500/40 px-4 py-3 text-sm text-rose-100">
          <CalendarX className="inline w-4 h-4 mr-1.5 -mt-0.5" />
          {error}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="flex-1 py-3 rounded-xl bg-white text-slate-900 font-bold uppercase tracking-[0.2em] text-xs hover:bg-ocean hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarX className="w-4 h-4" />}
          {isPending ? 'Blocking…' : `Block ${nights} night${nights === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}

