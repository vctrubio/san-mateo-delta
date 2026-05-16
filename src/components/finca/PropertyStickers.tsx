import {
  Users,
  BedDouble,
  BedSingle,
  Sofa,
  DoorOpen,
  Bath,
  Maximize,
  TreePine,
  type LucideIcon,
} from 'lucide-react';
import type { Property } from '@/lib/properties';

// ============================================================================
// PropertyStickers — the consistent sticker row used everywhere a property
// surfaces its at-a-glance facts:
//
//   - /finca cards         (under each property title)
//   - /finca/[slug]        (next to the FincaLead heading)
//   - PropertyShowcaseGrid (inside the modal on the homepage)
//
// Two flavours of sticker, selected via the `kind` prop:
//
//   - characteristics  → physical facts the database owns: sleeps, beds,
//                        bedrooms, baths, m². Slate pills, icon + value.
//   - features         → per-property highlights (`property.features` jsonb):
//                        "Master Suite", "Jacuzzi", etc. Ocean pills, text
//                        only — matches the FincaLead title accent so the
//                        page reads in one voice.
//   - both             → characteristics row, then features row stacked.
//
// Default is `characteristics` so every existing caller stays unchanged;
// the slug page opts into `both`.
//
// Two visual sizes:
//   size="sm"  → tight inline pills for list cards
//   size="md"  → generous boxed badges for the slug page + modal
// ============================================================================

type PropertyShape = Pick<
  Property,
  'max_guests' |
  'bedrooms' |
  'bathrooms' |
  'm2_interior' |
  'm2_terrace' |
  'king_beds' |
  'queen_beds' |
  'single_beds' |
  'sofa_beds' |
  'features'
>;

type StickerKey =
  | 'sleeps'
  | 'king'
  | 'queen'
  | 'single'
  | 'sofa'
  | 'bedrooms'
  | 'bathrooms'
  | 'm2_interior'
  | 'm2_terrace';

const DEFAULT_ORDER: readonly StickerKey[] = [
  'sleeps',
  'king',
  'queen',
  'single',
  'sofa',
  'bedrooms',
  'bathrooms',
  'm2_interior',
  'm2_terrace',
];

type Size = 'sm' | 'md';
type Kind = 'characteristics' | 'features' | 'both';

export function PropertyStickers({
  property,
  size = 'md',
  kind = 'characteristics',
  subset,
}: {
  property: PropertyShape;
  size?: Size;
  kind?: Kind;
  /** Optional subset/order of characteristic stickers. Ignored when kind='features'. */
  subset?: ReadonlyArray<StickerKey>;
}) {
  if (kind === 'features') {
    return <FeatureRow property={property} size={size} />;
  }
  if (kind === 'both') {
    return (
      <div className={size === 'sm' ? 'space-y-1.5' : 'space-y-2'}>
        <CharacteristicsRow property={property} size={size} subset={subset} />
        <FeatureRow property={property} size={size} />
      </div>
    );
  }
  return <CharacteristicsRow property={property} size={size} subset={subset} />;
}

// ─── Characteristics row ────────────────────────────────────────────────────
// Slate pills with icon + value. Each entry is conditional (e.g. queen beds
// only renders if count > 0) — see below.

function CharacteristicsRow({
  property,
  size,
  subset,
}: {
  property: PropertyShape;
  size: Size;
  subset?: ReadonlyArray<StickerKey>;
}) {
  const stickers: Record<StickerKey, CharacteristicProps | null> = {
    sleeps: {
      icon: Users,
      value: property.max_guests,
      label: 'sleeps',
    },
    king:    bedSticker(property.king_beds,   'king'),
    queen:   bedSticker(property.queen_beds,  'queen'),
    single:  bedSticker(property.single_beds, 'single', BedSingle),
    sofa:    bedSticker(property.sofa_beds,   'sofa',   Sofa),
    bedrooms: {
      icon: DoorOpen,
      value: property.bedrooms,
      label: property.bedrooms === 1 ? 'bedroom' : 'bedrooms',
    },
    bathrooms: {
      icon: Bath,
      value: property.bathrooms,
      label: property.bathrooms === 1 ? 'bath' : 'baths',
    },
    m2_interior: {
      icon: Maximize,
      value: property.m2_interior,
      label: 'm² interior',
    },
    m2_terrace: property.m2_terrace > 0
      ? { icon: TreePine, value: property.m2_terrace, label: 'm² terrace' }
      : null,
  };
  const order = subset ?? DEFAULT_ORDER;
  return (
    <ul className={size === 'sm' ? 'flex flex-wrap gap-1.5' : 'flex flex-wrap gap-2'}>
      {order.map((key) => {
        const s = stickers[key];
        if (!s) return null;
        return <CharacteristicSticker key={key} {...s} size={size} />;
      })}
    </ul>
  );
}

// ─── Features row ───────────────────────────────────────────────────────────
// Ocean pills, text only. Matches the FincaLead title accent — a property
// title says "The Villa" with the noun in ocean italic; the feature pills
// continue that same accent. Renders nothing if the property has no
// features.

function FeatureRow({ property, size }: { property: PropertyShape; size: Size }) {
  if (property.features.length === 0) return null;
  return (
    <ul className={size === 'sm' ? 'flex flex-wrap gap-1.5' : 'flex flex-wrap gap-2'}>
      {property.features.map((f) => (
        <FeatureSticker key={f} label={f} size={size} />
      ))}
    </ul>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function bedSticker(
  count: number,
  type: 'king' | 'queen' | 'single' | 'sofa',
  icon: LucideIcon = BedDouble,
): CharacteristicProps | null {
  if (count <= 0) return null;
  return {
    icon,
    value: count,
    label: count === 1 ? type : `${type}s`,
  };
}

type CharacteristicProps = {
  icon: LucideIcon;
  value: number | string;
  label: string;
};

function CharacteristicSticker({
  icon: Icon,
  value,
  label,
  size,
}: CharacteristicProps & { size: Size }) {
  const base =
    size === 'sm'
      ? 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-mono'
      : 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-mono';
  const iconClass = size === 'sm' ? 'w-3 h-3 text-slate-400' : 'w-3.5 h-3.5 text-slate-500';
  return (
    <li className={base}>
      <Icon className={iconClass} />
      <span>
        <span className="font-semibold text-slate-900">{value}</span> {label}
      </span>
    </li>
  );
}

function FeatureSticker({ label, size }: { label: string; size: Size }) {
  const base =
    size === 'sm'
      ? 'inline-flex items-center px-2.5 py-1 rounded-full bg-ocean/5 text-ocean text-[11px] font-mono'
      : 'inline-flex items-center px-3 py-1.5 rounded-full bg-ocean/5 text-ocean text-xs font-mono';
  return <li className={base}>{label}</li>;
}
