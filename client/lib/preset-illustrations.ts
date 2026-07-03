import type { IllustrationName } from '@/components/ui/illustration';

// Preset names arrive from the API already localised, so both language variants
// map to the same artwork. Unknown presets fall back to the collage-grid stamp.
export const PRESET_ILLUSTRATIONS: Record<string, IllustrationName> = {
  'Outdoor-Abenteuer': 'stamp-outdoor',
  'Outdoor Adventures': 'stamp-outdoor',
  'Kreative Familie': 'stamp-creative',
  'Creative Family': 'stamp-creative',
  'Achtsame Momente': 'stamp-mindful',
  'Mindful Moments': 'stamp-mindful',
  'Gemeinsam in der Küche': 'stamp-kitchen',
  'Together in the Kitchen': 'stamp-kitchen',
  'Regentag-Entdecker': 'stamp-rainy',
  'Rainy-Day Explorers': 'stamp-rainy',
};
