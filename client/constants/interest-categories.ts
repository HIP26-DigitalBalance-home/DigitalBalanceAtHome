import type { GlyphName } from '@/components/ui/illustration';

export interface InterestCategory {
  key: string;
  labelKey: string;
  icon: GlyphName;
}

export const INTEREST_CATEGORIES: InterestCategory[] = [
  { key: 'outdoor',  labelKey: 'interests.outdoor',  icon: 'int-nature' },
  { key: 'crafts',   labelKey: 'interests.crafts',   icon: 'int-crafts' },
  { key: 'cooking',  labelKey: 'interests.cooking',  icon: 'int-cooking' },
  { key: 'sports',   labelKey: 'interests.sports',   icon: 'int-sports' },
  { key: 'music',    labelKey: 'interests.music',    icon: 'int-music' },
  { key: 'reading',  labelKey: 'interests.reading',  icon: 'int-reading' },
  { key: 'building', labelKey: 'interests.building', icon: 'int-building' },
  { key: 'animals',  labelKey: 'interests.animals',  icon: 'int-animals' },
];

export const CATEGORY_KEY_SET = new Set(INTEREST_CATEGORIES.map((c) => c.key));
