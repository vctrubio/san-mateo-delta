'use server';

import { revalidatePath } from 'next/cache';
import { pool } from '@db/client';
import { MONTHS, type Month } from '@db/enums';

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function int(form: FormData, key: string): number | null {
  const v = form.get(key);
  if (typeof v !== 'string') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function featuresFromForm(form: FormData): string[] {
  const raw = form.get('features');
  if (typeof raw !== 'string') return [];
  return raw.split('\n').map((s) => s.trim()).filter(Boolean);
}

function revalidateForSlug(slug: string) {
  revalidatePath('/admin');
  revalidatePath('/admin/properties');
  revalidatePath(`/admin/properties/${slug}`);
  revalidatePath('/finca');
  revalidatePath(`/finca/${slug}`);
  revalidatePath('/');
}

// ---------------------------------------------------------------------------
// updateProperty — title, description, features, characteristics, cleaning fee
// (everything except slug, which is the identifier).

export async function updateProperty(formData: FormData): Promise<void> {
  const slug = str(formData, 'slug');
  const title = str(formData, 'title');
  const description = str(formData, 'description');
  const bedrooms = int(formData, 'bedrooms');
  const bathrooms = int(formData, 'bathrooms');
  const m2_interior = int(formData, 'm2_interior');
  const m2_terrace = int(formData, 'm2_terrace');
  const max_guests = int(formData, 'max_guests');
  const king_beds = int(formData, 'king_beds');
  const queen_beds = int(formData, 'queen_beds');
  const single_beds = int(formData, 'single_beds');
  const sofa_beds = int(formData, 'sofa_beds');
  const cleaning_fee_eur = int(formData, 'cleaning_fee_eur');
  const features = featuresFromForm(formData);

  if (!slug)        throw new Error('slug missing');
  if (!title)       throw new Error('title required');
  if (!description) throw new Error('description required');
  if (bedrooms == null || bedrooms < 0)         throw new Error('bedrooms must be ≥ 0');
  if (bathrooms == null || bathrooms < 0)       throw new Error('bathrooms must be ≥ 0');
  if (m2_interior == null || m2_interior <= 0)  throw new Error('m² interior must be > 0');
  if (m2_terrace == null || m2_terrace < 0)     throw new Error('m² terrace must be ≥ 0');
  if (max_guests == null || max_guests <= 0)    throw new Error('max_guests must be > 0');
  if (king_beds   == null || king_beds   < 0)   throw new Error('king_beds must be ≥ 0');
  if (queen_beds  == null || queen_beds  < 0)   throw new Error('queen_beds must be ≥ 0');
  if (single_beds == null || single_beds < 0)   throw new Error('single_beds must be ≥ 0');
  if (sofa_beds   == null || sofa_beds   < 0)   throw new Error('sofa_beds must be ≥ 0');
  if (cleaning_fee_eur == null || cleaning_fee_eur < 0) throw new Error('cleaning fee must be ≥ 0');

  await pool.query(
    `UPDATE properties
     SET title = $1, description = $2, features = $3::jsonb,
         bedrooms = $4, bathrooms = $5,
         m2_interior = $6, m2_terrace = $7, max_guests = $8,
         king_beds = $9, queen_beds = $10, single_beds = $11, sofa_beds = $12,
         cleaning_fee_cents = $13
     WHERE slug = $14`,
    [
      title, description, JSON.stringify(features),
      bedrooms, bathrooms,
      m2_interior, m2_terrace, max_guests,
      king_beds, queen_beds, single_beds, sofa_beds,
      cleaning_fee_eur * 100,
      slug,
    ],
  );

  revalidateForSlug(slug);
}

// ---------------------------------------------------------------------------
// updatePropertyRates — admin sets the per-night rate for each calendar
// month, in EUR cents. The form posts twelve `rate_<month>_eur` fields
// (Jan-Dec). Validation: every month required, non-negative integer; we
// rebuild the JSONB object from scratch and write it. The Postgres CHECK on
// `properties.rates` will also reject anything missing a month — the
// validation here is just for nicer error messages.
// ---------------------------------------------------------------------------

export async function updatePropertyRates(formData: FormData): Promise<void> {
  const slug = str(formData, 'slug');
  if (!slug) throw new Error('slug missing');

  const rates: Record<string, number> = {};
  for (const m of MONTHS as readonly Month[]) {
    const eur = int(formData, `rate_${m}_eur`);
    if (eur == null || eur < 0) {
      throw new Error(`Rate for month ${m} must be a non-negative integer.`);
    }
    rates[String(m)] = eur * 100;
  }

  await pool.query(
    `UPDATE properties SET rates = $1::jsonb WHERE slug = $2`,
    [JSON.stringify(rates), slug],
  );

  revalidateForSlug(slug);
}
