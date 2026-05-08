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

function bool(form: FormData, key: string): boolean {
  return form.get(key) === 'on' || form.get(key) === 'true';
}

function monthsFromForm(form: FormData): number[] {
  const out: number[] = [];
  for (const m of MONTHS) {
    if (form.get(`month_${m}`) === 'on') out.push(m);
  }
  return out;
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
  const m2 = int(formData, 'm2');
  const max_guests = int(formData, 'max_guests');
  const cleaning_fee_eur = int(formData, 'cleaning_fee_eur');
  const features = featuresFromForm(formData);

  if (!slug)        throw new Error('slug missing');
  if (!title)       throw new Error('title required');
  if (!description) throw new Error('description required');
  if (bedrooms == null || bedrooms < 0)   throw new Error('bedrooms must be ≥ 0');
  if (bathrooms == null || bathrooms < 0) throw new Error('bathrooms must be ≥ 0');
  if (m2 == null || m2 <= 0)              throw new Error('m² must be > 0');
  if (max_guests == null || max_guests <= 0) throw new Error('max_guests must be > 0');
  if (cleaning_fee_eur == null || cleaning_fee_eur < 0) throw new Error('cleaning fee must be ≥ 0');

  await pool.query(
    `UPDATE properties
     SET title = $1, description = $2, features = $3::jsonb,
         bedrooms = $4, bathrooms = $5, m2 = $6, max_guests = $7,
         cleaning_fee_cents = $8
     WHERE slug = $9`,
    [
      title, description, JSON.stringify(features),
      bedrooms, bathrooms, m2, max_guests,
      cleaning_fee_eur * 100,
      slug,
    ],
  );

  revalidateForSlug(slug);
}

// ---------------------------------------------------------------------------
// upsertRate — create a new rate or update an existing one. delete is separate.

export async function upsertRate(formData: FormData): Promise<void> {
  const slug = str(formData, 'slug');
  const rateId = str(formData, 'rate_id'); // null for create
  const name = str(formData, 'name');
  const active = bool(formData, 'active');
  const isPublic = bool(formData, 'public');
  const min_nights = int(formData, 'min_nights');
  const night_rate_eur = int(formData, 'night_rate_eur');
  const months = monthsFromForm(formData) as Month[];

  if (!slug) throw new Error('slug missing');
  if (!name) throw new Error('rate name required');
  if (min_nights == null || min_nights <= 0) throw new Error('min_nights must be > 0');
  if (night_rate_eur == null || night_rate_eur < 0) throw new Error('night rate must be ≥ 0');
  if (months.length === 0) throw new Error('select at least one month');

  const propRows = await pool.query<{ id: string }>(
    `SELECT id::text FROM properties WHERE slug = $1`,
    [slug],
  );
  const propertyId = propRows.rows[0]?.id;
  if (!propertyId) throw new Error(`property ${slug} not found`);

  const night_rate_cents = night_rate_eur * 100;

  if (rateId) {
    await pool.query(
      `UPDATE property_rates
       SET name = $1, active = $2, public = $3, min_nights = $4, months = $5::int[], night_rate_cents = $6
       WHERE id = $7 AND property_id = $8`,
      [name, active, isPublic, min_nights, months, night_rate_cents, rateId, propertyId],
    );
  } else {
    await pool.query(
      `INSERT INTO property_rates (property_id, name, active, public, min_nights, months, night_rate_cents)
       VALUES ($1, $2, $3, $4, $5, $6::int[], $7)`,
      [propertyId, name, active, isPublic, min_nights, months, night_rate_cents],
    );
  }

  revalidateForSlug(slug);
}

export async function deleteRate(formData: FormData): Promise<void> {
  const slug = str(formData, 'slug');
  const rateId = str(formData, 'rate_id');
  if (!slug || !rateId) throw new Error('slug + rate_id required');
  await pool.query(`DELETE FROM property_rates WHERE id = $1`, [rateId]);
  revalidateForSlug(slug);
}
