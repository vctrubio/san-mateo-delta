import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { sql } from '@db/client';

export const dynamic = 'force-dynamic';

export default async function CancelPage(props: { searchParams: Promise<{ booking_id?: string }> }) {
  const { booking_id } = await props.searchParams;

  let userId: string | null = null;
  let propertyTitle: string | null = null;

  if (booking_id) {
    const rows = await sql<{ user_id: string | null; property_title: string }>(
      `SELECT b.user_id::text AS user_id, p.title AS property_title
         FROM bookings b
         JOIN properties p ON p.id = b.property_id
        WHERE b.id = $1`,
      [booking_id],
    );
    if (rows[0]) {
      userId = rows[0].user_id;
      propertyTitle = rows[0].property_title;
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 grid place-items-center px-4">
      <div className="max-w-lg w-full bg-white rounded-3xl border border-amber-200 p-8">
        <div className="flex items-start gap-4">
          <span className="shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-amber-100 text-amber-700">
            <AlertCircle className="w-6 h-6" />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Checkout cancelled</h1>
            <p className="text-sm text-slate-700 leading-relaxed">
              You backed out of the Stripe payment.{' '}
              {propertyTitle ? (
                <>Your booking for <strong>{propertyTitle}</strong> is still saved as <span className="font-mono">request</span> — </>
              ) : (
                <>Your booking is still saved — </>
              )}
              you can retry payment from your dashboard or pay cash on arrival.
            </p>
            <div className="flex gap-2 mt-5">
              {userId ? (
                <Link href={`/user/${userId}`} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-ocean text-white text-xs font-bold uppercase tracking-[0.2em] transition">
                  Open my dashboard
                </Link>
              ) : null}
              <Link href="/finca" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-[0.2em] transition">
                <ArrowLeft className="w-3.5 h-3.5" /> Browse properties
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
