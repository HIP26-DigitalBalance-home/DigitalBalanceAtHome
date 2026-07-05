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

// Full-colour character artwork used for the home "Today's Suggestions" carousel.
// Distinct from the framed stamp artwork above so the home cards read as playful
// picture cards rather than collage stamps. Falls back to the creative crayon.
export const PRESET_SUGGEST_ILLUSTRATIONS: Record<string, IllustrationName> = {
  'Outdoor-Abenteuer': 'suggest-outdoor',
  'Outdoor Adventures': 'suggest-outdoor',
  'Kreative Familie': 'suggest-creative',
  'Creative Family': 'suggest-creative',
  'Achtsame Momente': 'suggest-mindful',
  'Mindful Moments': 'suggest-mindful',
  'Gemeinsam in der Küche': 'suggest-kitchen',
  'Together in the Kitchen': 'suggest-kitchen',
  'Regentag-Entdecker': 'suggest-rainy',
  'Rainy-Day Explorers': 'suggest-rainy',
};
