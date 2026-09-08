// ── Domain constants ────────────────────────────────────────────────────────
// Categories are stored as slugs. Labels/icons live here so the DB stays clean.

export type CategorySlug =
  | 'transport' | 'food' | 'groceries' | 'rent'
  | 'wifi' | 'water' | 'electric' | 'custom';

export interface CategoryDef {
  slug: CategorySlug;
  label: string;
  icon: string;
  /** Stable categories repeat near-exactly, so they get the full 3-chip row. */
  stable: boolean;
  /** Bills that make sense as one-tap monthly templates. */
  recurring: boolean;
}

export const CATEGORIES: CategoryDef[] = [
  { slug: 'transport', label: 'Transport', icon: '🚗', stable: true,  recurring: false },
  { slug: 'food',      label: 'Food',      icon: '🍜', stable: false, recurring: false },
  { slug: 'groceries', label: 'Groceries', icon: '🛒', stable: true,  recurring: false },
  { slug: 'rent',      label: 'Rent',      icon: '🏠', stable: true,  recurring: true  },
  { slug: 'wifi',      label: 'WiFi',      icon: '📶', stable: true,  recurring: true  },
  { slug: 'water',     label: 'Water',     icon: '💧', stable: true,  recurring: true  },
  { slug: 'electric',  label: 'Electric',  icon: '⚡', stable: true,  recurring: true  },
  { slug: 'custom',    label: 'Other',     icon: '✨', stable: false, recurring: false },
];

export const CATEGORY_MAP: Record<string, CategoryDef> =
  Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));

/** Food splits into two subtypes; Delivery is the deliberately "fuzzy" one. */
export type FoodSubtype = 'delivery' | 'cooked';

export const FOOD_SUBTYPES: { slug: FoodSubtype; label: string; icon: string }[] = [
  { slug: 'delivery', label: 'Delivery', icon: '🛵' },
  { slug: 'cooked',   label: 'Cooked',   icon: '🍳' },
];

/**
 * Which (category, subtype) pairs get the full 3-chip amount row vs. a single
 * "~" starting-point chip.
 *
 * Food → Delivery totals shift every order (fees, promos, different items), so
 * three precise-looking chips would imply accuracy that isn't there and invite
 * saving a stale number. It gets one chip, prefixed "~", meaning "edit me".
 */
export function chipModeFor(category: string, subtype: string | null): 'full' | 'approx' {
  if (category === 'food') {
    // Delivery totals drift every order; Cooked repeats like a stable category.
    return subtype === 'delivery' ? 'approx' : 'full';
  }
  return CATEGORY_MAP[category]?.stable ? 'full' : 'approx';
}

export const MAX_CHIPS_FULL = 3;
export const MAX_CHIPS_APPROX = 1;
