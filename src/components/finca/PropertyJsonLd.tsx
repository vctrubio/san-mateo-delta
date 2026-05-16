import { absoluteUrl, propertyImageUrl } from '@/lib/site';
import type { Property } from '@/lib/properties';
import finca from '@config/finca.json';

// Per-property structured data — `House` is the schema.org subtype eligible
// for Google's vacation-rental rich results. The estate-wide
// `LodgingBusiness` schema is rendered on the homepage; this fills in the
// per-unit detail (bedrooms, occupancy, floorSize, amenities) and points
// back at the estate via `containedInPlace`.
//
// Geo coordinates inherit from the estate (we don't surface a separate
// per-cottage location — they're all within the same compound).
export function PropertyJsonLd({ property }: { property: Property }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'House',
    name: property.title,
    description: property.description,
    url: absoluteUrl(`/finca/${property.slug}`),
    image: propertyImageUrl(property.slug),
    numberOfBedrooms: property.bedrooms,
    numberOfBathroomsTotal: property.bathrooms,
    occupancy: {
      '@type': 'QuantitativeValue',
      maxValue: property.max_guests,
    },
    floorSize: {
      '@type': 'QuantitativeValue',
      value: property.m2_interior + property.m2_terrace,
      unitCode: 'MTK',
    },
    amenityFeature: property.features.map((feature) => ({
      '@type': 'LocationFeatureSpecification',
      name: feature,
    })),
    petsAllowed: finca.amenities.some((a) => a.name === 'Pets Allowed'),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: finca.location.coords.lat,
      longitude: finca.location.coords.lon,
    },
    containedInPlace: {
      '@type': 'LodgingBusiness',
      name: `Finca ${finca.name}`,
      url: absoluteUrl('/'),
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  );
}
