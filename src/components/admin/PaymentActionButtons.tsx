import { recordPayment } from '@/actions/payments';
import type { BookingStatus } from '@db/enums';

export default function PaymentActionButtons({
  bookingId,
  agreedCents,
  paidCents,
  status,
  size = 'md',
}: {
  bookingId: string;
  agreedCents: number;
  paidCents: number;
  status: BookingStatus;
  size?: 'sm' | 'md';
}) {
  if (status === 'cancelled') {
    return <span className="text-[10px] font-mono text-slate-300 uppercase">no payments on cancelled</span>;
  }
  if (paidCents >= agreedCents) {
    return <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-widest">fully paid</span>;
  }
  const padding = size === 'sm' ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2.5 text-[12px]';
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {paidCents === 0 && (
        <PayButton bookingId={bookingId} type="deposit" label="Pay deposit (30%)" padding={padding} variant="outline" />
      )}
      <PayButton
        bookingId={bookingId}
        type={paidCents === 0 ? 'reservation' : 'balance'}
        label={paidCents === 0 ? 'Pay full' : 'Pay balance'}
        padding={padding}
        variant="primary"
      />
    </div>
  );
}

function PayButton({
  bookingId,
  type,
  label,
  padding,
  variant,
}: {
  bookingId: string;
  type: 'deposit' | 'balance' | 'reservation';
  label: string;
  padding: string;
  variant: 'primary' | 'outline';
}) {
  const cls =
    variant === 'primary'
      ? `${padding} rounded-lg bg-emerald-600 text-white font-mono uppercase tracking-widest hover:bg-emerald-700 transition-colors`
      : `${padding} rounded-lg bg-white border border-slate-200 text-slate-700 font-mono uppercase tracking-widest hover:border-emerald-300 hover:text-emerald-700 transition-colors`;
  return (
    <form action={recordPayment}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="type" value={type} />
      <button type="submit" className={cls}>{label}</button>
    </form>
  );
}
