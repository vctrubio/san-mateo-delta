import type { Property } from '@/lib/properties';
import { listFolder } from '@/lib/cloudinary';
import { PropertyPhotosSpread, type PhotoSection } from './PropertyPhotosSpread';

// ============================================================================
// PropertyPhotosWireframe — server component. Derives candidate sections
// from the property's DB columns, fetches every candidate's Cloudinary
// folder in parallel, drops empty sections, and hands the filled set to
// the client `<PropertyPhotosSection>` for rendering.
//
// The split is required because `<CldImage>` (from next-cloudinary) calls
// React hooks internally — it can only render inside a Client Component.
// Keeping the fetch here means `listFolder()` (server-only Cloudinary
// admin API) runs at request time and we don't pay a client-bundle cost
// for the SDK.
//
// Section rules — see `docs/cloudinary.md`:
//   - interior / exterior          → always candidates
//   - bedroom/{1..bedrooms}        → candidates for each numbered room
//   - bathroom/{1..bathrooms}      → same
//   - terrace                      → candidate only when m2_terrace > 0
//   - any candidate with 0 photos in Cloudinary is dropped (so studios
//     like Cala or odd shapes like Estrecho work without per-property
//     flags).
// ============================================================================

type Candidate = {
  /** Cloudinary path segment under `san-mateo/finca/{slug}/`. */
  id: string;
  /** Eyebrow label rendered inside the divider. */
  label: string;
};

function deriveSections(property: Property): Candidate[] {
  const out: Candidate[] = [
    { id: 'interior', label: 'Interior' },
    { id: 'exterior', label: 'Exterior' },
  ];
  for (let i = 1; i <= property.bedrooms; i++) {
    out.push({ id: `bedroom/${i}`, label: `Bedroom ${i}` });
  }
  for (let i = 1; i <= property.bathrooms; i++) {
    out.push({ id: `bathroom/${i}`, label: `Bathroom ${i}` });
  }
  if (property.m2_terrace > 0) {
    out.push({ id: 'terrace', label: 'Terrace' });
  }
  return out;
}

export async function PropertyPhotosWireframe({ property }: { property: Property }) {
  const candidates = deriveSections(property);
  const prefix = `san-mateo/finca/${property.slug}`;

  const fetched = await Promise.all(
    candidates.map(async (c) => ({
      id: c.id,
      label: c.label,
      photos: await listFolder(`${prefix}/${c.id}`),
    })),
  );
  const sections: PhotoSection[] = fetched.filter((s) => s.photos.length > 0);

  if (sections.length === 0) return null;

  return <PropertyPhotosSpread sections={sections} />;
}
