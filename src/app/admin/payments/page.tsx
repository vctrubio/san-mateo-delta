import PaymentsTable from '@/components/admin/PaymentsTable';
import { listPayments } from '@/lib/payments';

export const dynamic = 'force-dynamic';

function eur(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function AdminPaymentsPage() {
  const payments = await listPayments();
  const grossCents = payments.reduce((sum, p) => sum + p.amount_cents - p.refunded_cents, 0);
  const refundedCents = payments.reduce((sum, p) => sum + p.refunded_cents, 0);

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Payments</h1>
        <p className="text-sm text-slate-500 mt-1">
          {payments.length} payments · net collected {eur(grossCents)}
          {refundedCents > 0 && <> · {eur(refundedCents)} refunded</>}
        </p>
      </div>
      <PaymentsTable payments={payments} />
    </div>
  );
}
