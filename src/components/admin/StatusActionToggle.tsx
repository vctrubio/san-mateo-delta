'use client';

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  CheckCircle2,
  LogIn,
  LogOut,
  XCircle,
  Loader2,
} from 'lucide-react';
import { transitionStatus, cancelBooking } from '@/actions/bookings';
import { BOOKING_STATUS_STYLES } from '@/lib/colors';
import { PickerTile } from '@/components/shared/modalKit';
import type { BookingStatus } from '@db/enums';

// ============================================================================
// StatusActionToggle — drops into table cells in /admin/bookings. The status
// chip itself is the affordance: clicking it opens a small popover anchored
// underneath, listing the available transitions as PickerTile buttons. Same
// design language as the modal kit; same server actions as the modal.
//
// Today-awareness for `confirmed`:
//   - today < check_in   → only [Cancel] (we can't check anyone in early
//                          on this UI; admin would do that from the modal)
//   - today ≥ check_in   → [Check-in] [Cancel]
//
// Terminal statuses (checked_out, cancelled) render a non-interactive chip.
//
// Portal'd to <body> so the popover escapes table overflow / row stacking.
// `relative z-10` on the trigger keeps it above the AdminTable stretched
// row-link.
// ============================================================================

type ActionItem =
  | { kind: 'transition'; to: BookingStatus; label: string; icon: 'confirm' | 'in' | 'out' }
  | { kind: 'cancel';     label: string };

function actionsFor(status: BookingStatus, dateCheckIn: string): ActionItem[] {
  const today = ymdToday();
  const checkInArrived = today >= dateCheckIn;
  switch (status) {
    case 'request':
    case 'invite':
      return [
        { kind: 'transition', to: 'confirmed', label: 'Confirm', icon: 'confirm' },
        { kind: 'cancel', label: 'Cancel' },
      ];
    case 'confirmed':
      return [
        ...(checkInArrived
          ? [{ kind: 'transition' as const, to: 'checked_in' as const, label: 'Check-in', icon: 'in' as const }]
          : []),
        { kind: 'cancel' as const, label: 'Cancel' },
      ];
    case 'checked_in':
      return [{ kind: 'transition', to: 'checked_out', label: 'Check-out', icon: 'out' }];
    case 'checked_out':
    case 'cancelled':
      return [];
  }
}

function ymdToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function StatusActionToggle({
  bookingId, status, dateCheckIn,
}: {
  bookingId: string;
  status: BookingStatus;
  dateCheckIn: string; // YYYY-MM-DD
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  const actions = actionsFor(status, dateCheckIn);
  const interactive = actions.length > 0;
  const style = BOOKING_STATUS_STYLES[status];

  // Close on outside click + Esc.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (popRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggleOpen(e: ReactMouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!interactive) return;
    if (open) {
      setOpen(false);
      return;
    }
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({
        top: r.bottom + window.scrollY + 6,
        left: r.left + window.scrollX,
        width: Math.max(r.width, 224),
      });
    }
    setError(null);
    setOpen(true);
  }

  function fireTransition(to: BookingStatus) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('booking_id', bookingId);
      fd.set('to', to);
      try {
        await transitionStatus(fd);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transition failed');
      }
    });
  }

  function fireCancel() {
    if (!confirm('Cancel this booking? The refund policy will run automatically.')) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('booking_id', bookingId);
      fd.set('cancelled_by', 'admin');
      try {
        await cancelBooking(fd);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Cancel failed');
      }
    });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        disabled={!interactive}
        aria-haspopup={interactive ? 'menu' : undefined}
        aria-expanded={open}
        className={[
          'relative z-10 inline-flex items-center gap-1 text-xs font-mono uppercase tracking-widest px-2.5 py-1 rounded-full',
          style.chip,
          interactive ? 'cursor-pointer hover:opacity-90' : 'cursor-default opacity-80',
        ].join(' ')}
      >
        {status.replace('_', ' ')}
        {interactive && <ChevronDown className="w-3 h-3 opacity-60" />}
      </button>

      {open && pos && createPortal(
        <div
          ref={popRef}
          style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width }}
          className="z-[1100] rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-300/30 p-2"
          role="menu"
        >
          {error && (
            <p className="px-2 py-1.5 text-xs text-rose-700 bg-rose-50 rounded-lg mb-2">
              {error}
            </p>
          )}
          <div className="grid gap-1.5">
            {actions.map((a) =>
              a.kind === 'transition' ? (
                <PickerTile
                  key={a.to}
                  active={false}
                  onClick={() => fireTransition(a.to)}
                  disabled={isPending}
                  icon={
                    a.icon === 'confirm' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                    a.icon === 'in'      ? <LogIn className="w-3.5 h-3.5" /> :
                                           <LogOut className="w-3.5 h-3.5" />
                  }
                  label={a.label}
                />
              ) : (
                <PickerTile
                  key="cancel"
                  active={false}
                  onClick={fireCancel}
                  disabled={isPending}
                  danger
                  icon={<XCircle className="w-3.5 h-3.5" />}
                  label="Cancel"
                  sub="Runs refund policy"
                />
              ),
            )}
          </div>
          {isPending && (
            <p className="text-xs text-slate-400 mt-2 inline-flex items-center gap-1.5 px-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Working…
            </p>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
