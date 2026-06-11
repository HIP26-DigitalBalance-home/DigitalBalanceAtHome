import { Platform } from 'react-native';

const palette = {
  coral: '#F4845F',
  coralDark: '#B84E3C',   // darkened from #D4604A — passes AA (4.6:1) for white button text
  coralLight: '#F9B49A',
  green: '#4CAF82',
  greenDark: '#2E7D57',   // darkened from #367A5C — passes AA (4.7:1) on cream for text use
  cream: '#FFFBF5',
  warmDark: '#1C1917',
  warmMid: '#292524',
  warmGray: '#6B6460',    // darkened from #78716C — passes AA (4.6:1) on cream for body text
  warmBorder: '#E7E0D6',
  warmBorderDark: '#3D3530',
  offWhite: '#F5F0EB',
  red: '#DC2626',
  white: '#FFFFFF',
};

export const Colors = {
  light: {
    // semantic
    primary: palette.coral,
    primaryDark: palette.coralDark,
    accent: palette.greenDark,       // darkened for AA text contrast on cream
    surface: palette.cream,
    onSurface: palette.warmDark,
    muted: palette.warmGray,         // darkened for AA on cream
    destructive: palette.red,
    // legacy keys kept for template component compatibility
    text: palette.warmDark,
    background: palette.cream,
    tint: palette.coral,
    icon: palette.warmGray,
    tabIconDefault: palette.warmGray,
    tabIconSelected: palette.coral,
    border: palette.warmBorder,
    buttonBackground: palette.coralDark,  // darkened so white text passes AA (4.6:1)
    buttonText: palette.white,
  },
  dark: {
    // semantic
    primary: palette.coral,
    primaryDark: palette.coralDark,
    accent: palette.green,            // original green passes on dark surfaces
    surface: palette.warmMid,
    onSurface: palette.offWhite,
    muted: palette.warmGray,
    destructive: palette.red,
    // legacy keys
    text: palette.offWhite,
    background: palette.warmDark,
    tint: palette.coral,
    icon: palette.warmGray,
    tabIconDefault: palette.warmGray,
    tabIconSelected: palette.coral,
    border: palette.warmBorderDark,
    buttonBackground: palette.coral,
    buttonText: palette.white,
  },
};

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
    serif: 'ui-serif',
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
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
