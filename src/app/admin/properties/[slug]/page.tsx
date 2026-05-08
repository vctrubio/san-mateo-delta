import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import PropertyEditForm from '@/components/admin/PropertyEditForm';
import RatesAdmin from '@/components/admin/RatesAdmin';
import PropertyBookingSummary from '@/components/admin/PropertyBookingSummary';
import { getPropertyBySlug, listPropertyStats } from '@/lib/properties';
import { listBookingsForProperty } from '@/lib/bookings';

export const dynamic = 'force-dynamic';

function displayName(slug: string) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export default async function AdminPropertyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPropertyBySlug(slug);
  if (!data) notFound();
  const { property, rates } = data;

  const [bookings, allStats] = await Promise.all([
    listBookingsForProperty(property.id),
    listPropertyStats(),
  ]);
  const stats = allStats.find((s) => s.property_id === property.id);

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href="/admin/properties"
        className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-slate-400 hover:text-ocean mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> back
      </Link>

      <div className="mb-8">
        <span className="text-xs font-mono text-ocean uppercase tracking-[0.4em]">{property.title}</span>
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight mt-1">{displayName(property.slug)}</h1>
        <p className="text-[11px] font-mono text-slate-400 mt-1">slug: {property.slug}</p>
      </div>

      <section className="mb-10">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3">
          Booking summary
        </h2>
        <PropertyBookingSummary
          bookings={bookings}
          cleaningTotalCents={stats?.cleaning_total_cents ?? 0}
          grossCollectedCents={stats?.gross_collected_cents ?? 0}
        />
      </section>

      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
            Property details
          </h2>
          <span className="text-[10px] font-mono text-slate-300">edits affect new bookings only · snapshots</span>
        </div>
        <PropertyEditForm property={property} />
      </section>

      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
            Rates · {rates.length}
          </h2>
          <span className="text-[10px] font-mono text-slate-300">see db/rates.md</span>
        </div>
        <RatesAdmin slug={property.slug} rates={rates} />
      </section>
    </div>
  );
}
