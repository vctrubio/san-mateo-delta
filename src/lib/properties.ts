import 'server-only';
import { sql } from '@db/client';

export type Property = {
  id: string;
  slug: string;
  title: string;
  description: string;
  features: string[];
  bedrooms: number;
  bathrooms: number;
  m2: number;
  max_guests: number;
};

export type PropertyRate = {
  id: string;
  name: string;
  active: boolean;
  public: boolean;
  min_nights: number;
  months: number[];
  night_rate_cents: number;
};

export type PropertyCleaningFee = {
  id: string;
  fee_cents: number;
  active: boolean;
};

export type PropertyDetails = {
  property: Property;
  rates: PropertyRate[];
  cleaning_fee: PropertyCleaningFee | null;
};

export async function listProperties(): Promise<Property[]> {
  return sql<Property>(
    `SELECT id::text, slug, title, description, features,
            bedrooms, bathrooms, m2, max_guests
     FROM properties
     ORDER BY id`,
  );
}

export async function getPropertyBySlug(slug: string): Promise<PropertyDetails | null> {
  const props = await sql<Property>(
    `SELECT id::text, slug, title, description, features,
            bedrooms, bathrooms, m2, max_guests
     FROM properties
     WHERE slug = $1`,
    [slug],
  );
  const property = props[0];
  if (!property) return null;

  const rates = await sql<PropertyRate>(
    `SELECT id::text, name, active, public, min_nights, months, night_rate_cents::int
     FROM property_rates
     WHERE property_id = $1
     ORDER BY active DESC, min_nights DESC, night_rate_cents ASC`,
    [property.id],
  );

  const fees = await sql<PropertyCleaningFee>(
    `SELECT id::text, fee_cents::int, active
     FROM property_cleaning_fee
     WHERE property_id = $1 AND active = TRUE
     LIMIT 1`,
    [property.id],
  );

  return { property, rates, cleaning_fee: fees[0] ?? null };
}
