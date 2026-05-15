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
// PropertyStickers — one consistent badge row used everywhere a property
// surfaces its at-a-glance stats:
//
//   - /finca cards         (under each property title)
//   - /finca/[slug]        (next to the FincaLead heading)
//   - PropertyShowcaseGrid (inside the modal on the homepage)
//   - /admin/properties    (the Spec column)
//
// Order (left → right):
//   sleeps · king · queen · single · sofa · bedrooms · baths ·
//   m² interior · m² terrace
//
// Bed-type stickers (king/queen/single/sofa) only render when the count is
// > 0 — a property without queens won't show "0 queen". m² terrace also
// auto-hides when 0. Pass `subset` to render an explicit subset / different
// order if a surface needs it.
//
// Two visual sizes:
//   size="sm"  — tight inline pills for list cards
//   size="md"  — generous boxed badges for the slug page + modal
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
  'sofa_beds'
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

export function PropertyStickers({
  property,
  size = 'md',
  subset,
}: {
  property: PropertyShape;
  size?: 'sm' | 'md';
  subset?: ReadonlyArray<StickerKey>;
}) {
  const stickers: Record<StickerKey, StickerProps | null> = {
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
        return <Sticker key={key} {...s} size={size} />;
      })}
    </ul>
  );
}

// Each bed-type sticker only renders when count > 0; otherwise we return
// `null` and the row skips it. Labels pluralise on >1 ("1 king" / "2 kings").
function bedSticker(
  count: number,
  type: 'king' | 'queen' | 'single' | 'sofa',
  icon: LucideIcon = BedDouble,
): StickerProps | null {
  if (count <= 0) return null;
  return {
    icon,
    value: count,
    label: count === 1 ? type : `${type}s`,
  };
}

type StickerProps = {
  icon: LucideIcon;
  value: number | string;
  label: string;
};

function Sticker({
  icon: Icon,
  value,
  label,
  size,
}: StickerProps & { size: 'sm' | 'md' }) {
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
