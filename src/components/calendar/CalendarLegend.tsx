import type { BookingStatus } from '@db/enums';
import { BOOKING_STATUS_STYLES, PROPERTY_BLOCK_STYLE } from '@/lib/colors';

// Public (admin=false) shows a minimal "Selected / Available / Held" legend.
// Admin shows the full status palette + the block treatment.

export default function CalendarLegend({ admin }: { admin: boolean }) {
  if (!admin) {
    return (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
        <Item dot="bg-ocean" label="Selected" />
        <Item dot="bg-slate-100 ring-1 ring-slate-200" label="Available" />
        <Item
          dot="bg-slate-700 [background-image:repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(255,255,255,0.4)_2px,rgba(255,255,255,0.4)_4px)]"
          label="Unavailable"
        />
      </div>
    );
  }

  // admin: every status + block
  const orderedStatuses: BookingStatus[] = [
    'request',
    'invite',
    'confirmed',
    'checked_in',
    'checked_out',
    'cancelled',
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
      {orderedStatuses.map((s) => (
        <Item key={s} dot={BOOKING_STATUS_STYLES[s].dot} label={BOOKING_STATUS_STYLES[s].label} />
      ))}
      <Item dot={PROPERTY_BLOCK_STYLE.dot} label={PROPERTY_BLOCK_STYLE.label} />
      <span className="text-slate-300">·</span>
      <Item dot="bg-ocean" label="Selecting" />
    </div>
  );
}

function Item({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
      <span>{label}</span>
    </span>
  );
}
