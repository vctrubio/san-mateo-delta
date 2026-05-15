import {
  Wifi,
  Tv,
  AirVent,
  TreePine,
  PawPrint,
  ParkingCircle,
  WashingMachine,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// Icon-name → lucide-component bridge.
//
// `config/finca.json#amenities` ships objects like { name, icon } so the
// data and its visual hook stay paired in one place (same pattern as
// socials.json). This module is the only string→component lookup the app
// needs. Unmapped names fall back to `Sparkles` so a new amenity in JSON
// never crashes the UI.
//
// To add a new amenity:
//   1. Pick a lucide icon (see lucide.dev) and add { name, icon } to
//      `config/finca.json#amenities`.
//   2. If the icon isn't in the map below, add the entry here too.
// ============================================================================

const ICONS_BY_NAME: Record<string, LucideIcon> = {
  wifi: Wifi,
  tv: Tv,
  'air-vent': AirVent,
  'tree-pine': TreePine,
  'paw-print': PawPrint,
  'parking-circle': ParkingCircle,
  'washing-machine': WashingMachine,
};

export const FALLBACK_AMENITY_ICON: LucideIcon = Sparkles;

/** Resolve an icon name (kebab-case lucide reference) to its component. */
export function iconByName(name: string): LucideIcon {
  return ICONS_BY_NAME[name] ?? FALLBACK_AMENITY_ICON;
}
