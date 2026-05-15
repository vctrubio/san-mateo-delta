import { updateProperty } from '@/actions/properties';
import type { Property } from '@/lib/properties';

export default function PropertyEditForm({ property }: { property: Property }) {
  return (
    <form action={updateProperty} className="rounded-2xl bg-white border border-slate-100 p-5 space-y-4">
      <input type="hidden" name="slug" value={property.slug} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Title" name="title" defaultValue={property.title} required />
        <Field label="Cleaning fee (€) — goes to Tano" name="cleaning_fee_eur" type="number" min={0} defaultValue={property.cleaning_fee_cents / 100} required />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Description</span>
        <textarea
          name="description"
          defaultValue={property.description}
          rows={3}
          required
          className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
          Features (one per line · per-property highlights, not estate-wide amenities)
        </span>
        <textarea
          name="features"
          defaultValue={property.features.join('\n')}
          rows={4}
          className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
        />
      </label>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Bedrooms"    name="bedrooms"    type="number" min={0} defaultValue={property.bedrooms} required />
        <Field label="Bathrooms"   name="bathrooms"   type="number" min={0} defaultValue={property.bathrooms} required />
        <Field label="Max guests"  name="max_guests"  type="number" min={1} defaultValue={property.max_guests} required />
        <Field label="m² interior" name="m2_interior" type="number" min={1} defaultValue={property.m2_interior} required />
        <Field label="m² terrace"  name="m2_terrace"  type="number" min={0} defaultValue={property.m2_terrace} required />
        <Field label="King beds"   name="king_beds"   type="number" min={0} defaultValue={property.king_beds} required />
        <Field label="Queen beds"  name="queen_beds"  type="number" min={0} defaultValue={property.queen_beds} required />
        <Field label="Single beds" name="single_beds" type="number" min={0} defaultValue={property.single_beds} required />
        <Field label="Sofa beds"   name="sofa_beds"   type="number" min={0} defaultValue={property.sofa_beds} required />
      </div>

      <button
        type="submit"
        className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-mono uppercase tracking-widest hover:bg-ocean transition-colors"
      >
        Save changes
      </button>
      <p className="text-xs text-slate-400">
        Changes apply to <span className="font-bold">new bookings only</span>. Existing bookings keep their snapshotted prices.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  required,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
  min?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={min}
        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/30 focus:border-ocean"
      />
    </label>
  );
}
