import { Platform } from 'react-native';

const palette = {
  coral: '#F4845F',
  coralDark: '#D4604A',
  coralLight: '#F9B49A',
  green: '#4CAF82',
  greenDark: '#367A5C',
  cream: '#FFFBF5',
  warmDark: '#1C1917',
  warmMid: '#292524',
  warmGray: '#78716C',
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
    accent: palette.green,
    surface: palette.cream,
    onSurface: palette.warmDark,
    muted: palette.warmGray,
    destructive: palette.red,
    // legacy keys kept for template component compatibility
    text: palette.warmDark,
    background: palette.cream,
    tint: palette.coral,
    icon: palette.warmGray,
    tabIconDefault: palette.warmGray,
    tabIconSelected: palette.coral,
    border: palette.warmBorder,
    buttonBackground: palette.coral,
    buttonText: palette.white,
  },
  dark: {
    // semantic
    primary: palette.coral,
    primaryDark: palette.coralDark,
    accent: palette.green,
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
