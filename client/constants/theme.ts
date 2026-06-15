import { Platform } from 'react-native';

// Colors and Radii are per-theme — see constants/themes.ts and lib/app-theme-context.tsx.
// This file retains only layout constants that are theme-independent.

export const Spacing = {
  screenHorizontal: 24,
  screenTop: 60,
  sectionGap: 24,
  elementGap: 12,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'Georgia',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Palatino Linotype', Palatino, 'Book Antiqua', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
