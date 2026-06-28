export interface InterestCategory {
  key: string;
  labelKey: string;
  icon: string;
}

export const INTEREST_CATEGORIES: InterestCategory[] = [
  { key: 'outdoor',  labelKey: 'interests.outdoor',  icon: 'nature' },
  { key: 'crafts',   labelKey: 'interests.crafts',   icon: 'brush' },
  { key: 'cooking',  labelKey: 'interests.cooking',  icon: 'restaurant' },
  { key: 'sports',   labelKey: 'interests.sports',   icon: 'directions-run' },
  { key: 'music',    labelKey: 'interests.music',    icon: 'music-note' },
  { key: 'reading',  labelKey: 'interests.reading',  icon: 'menu-book' },
  { key: 'building', labelKey: 'interests.building', icon: 'construction' },
  { key: 'animals',  labelKey: 'interests.animals',  icon: 'pets' },
];

export const CATEGORY_KEY_SET = new Set(INTEREST_CATEGORIES.map((c) => c.key));
