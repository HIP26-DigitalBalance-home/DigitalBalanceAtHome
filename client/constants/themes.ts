import { Platform } from 'react-native';

export type ThemeId = 'inkwell' | 'riso' | 'cork' | 'gartenlaube' | 'sage' | 'tocoBlue' | 'tocoWarm';
export type ColorMode = 'light' | 'dark' | 'system';
export const DEFAULT_COLOR_MODE: ColorMode = 'system';

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  accent: string;
  surface: string;
  onSurface: string;
  muted: string;
  destructive: string;
  destructiveMuted: string;
  text: string;
  background: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  border: string;
  buttonBackground: string;
  buttonText: string;
}

export interface ThemeRadii {
  card: number;
  button: number;
  input: number;
  badge: number;
  sm: number;
}

export interface AppThemeDef {
  id: ThemeId;
  titleFont: string;
  bodyFont?: string;    // undefined = system default (Salmon, Cork)
  preview: { bg: string; primary: string; border: string };
  colors: { light: ThemeColors; dark: ThemeColors };
  radii: ThemeRadii;
  // Optional overrides for the collage grid — defaults applied at usage site.
  cardShadowColor?: string;   // default '#1C1208'
  cardShadowOpacity?: number; // default 0.12
  completedSlotBg?: string;   // default '#E8DCC8'
}

const serifFont = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  web: "Georgia, 'Palatino Linotype', Palatino, serif",
  default: 'serif',
}) as string;

const systemFont = Platform.select({
  ios: 'system-ui',
  android: 'normal',
  web: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  default: 'normal',
}) as string;

const monoFont = Platform.select({
  ios: 'ui-monospace',
  android: 'monospace',
  web: "'Courier New', Courier, 'Lucida Console', monospace",
  default: 'monospace',
}) as string;

const roundedFont = Platform.select({
  ios: 'ui-rounded',
  android: 'normal',
  web: "system-ui, -apple-system, sans-serif",
  default: 'normal',
}) as string;

const scriptFont = Platform.select({
  ios: 'Snell Roundhand',
  android: 'cursive',
  web: "'Brush Script MT', 'Segoe Script', cursive",
  default: 'cursive',
}) as string;

export const THEMES: Record<ThemeId, AppThemeDef> = {
  inkwell: {
    id: 'inkwell',
    titleFont: serifFont,
    bodyFont: serifFont,
    preview: { bg: '#EDE5D3', primary: '#B83820', border: '#C9B99A' },
    radii: { card: 6, button: 4, input: 6, badge: 20, sm: 3 },
    colors: {
      light: {
        primary: '#B83820',
        primaryDark: '#8B2415',
        accent: '#3D6345',
        surface: '#F7F3EA',
        onSurface: '#1C1208',
        muted: '#7A6B5C',
        destructive: '#DC2626',
        destructiveMuted: '#8C3A2A',
        text: '#1C1208',
        background: '#EDE5D3',
        tint: '#B83820',
        icon: '#6A5A4C',            // stone #7A6B5C → 4.10:1 on parchment; #6A5A4C passes 5.27:1
        tabIconDefault: '#6A5A4C',  // same
        tabIconSelected: '#B83820',
        border: '#C9B99A',
        buttonBackground: '#8B2415',
        buttonText: '#FFFFFF',
      },
      dark: {
        primary: '#D4613F',
        primaryDark: '#B84B2E',
        accent: '#5A8F6A',
        surface: '#2A1F14',
        onSurface: '#F0E8DC',
        muted: '#9A8A7A',
        destructive: '#DC2626',
        destructiveMuted: '#8C3A2A',
        text: '#F0E8DC',
        background: '#1C1208',
        tint: '#D4613F',
        icon: '#9A8A7A',
        tabIconDefault: '#9A8A7A',
        tabIconSelected: '#D4613F',
        border: '#3D3028',
        buttonBackground: '#D4613F',
        buttonText: '#FFFFFF',
      },
    },
  },

  riso: {
    id: 'riso',
    titleFont: monoFont,
    bodyFont: monoFont,
    preview: { bg: '#F4F1EB', primary: '#1A6B5A', border: '#DADAD8' },
    radii: { card: 2, button: 2, input: 2, badge: 20, sm: 1 },
    cardShadowOpacity: 0,
    completedSlotBg: '#D6EDE7',
    colors: {
      light: {
        primary: '#1A6B5A',
        primaryDark: '#124D41',
        accent: '#D95030',
        surface: '#FFFFFF',
        onSurface: '#0F1A18',
        muted: '#8A8A8A',
        destructive: '#C82020',
        destructiveMuted: '#8C3A2A',
        text: '#0F1A18',
        background: '#F4F1EB',
        tint: '#1A6B5A',
        icon: '#686868',            // neutral #8A8A8A → 3.06:1 on off-white; #686868 passes 4.94:1
        tabIconDefault: '#686868',  // same
        tabIconSelected: '#1A6B5A',
        border: '#DADAD8',
        buttonBackground: '#124D41',
        buttonText: '#FFFFFF',
      },
      dark: {
        primary: '#3EA88A',
        primaryDark: '#2A8870',
        accent: '#E8704A',
        surface: '#22302E',
        onSurface: '#EEF5F3',
        muted: '#7A9090',
        destructive: '#E04040',
        destructiveMuted: '#B85040',
        text: '#EEF5F3',
        background: '#1A2020',
        tint: '#3EA88A',
        icon: '#7A9090',
        tabIconDefault: '#7A9090',
        tabIconSelected: '#3EA88A',
        border: '#2E3E3C',
        buttonBackground: '#3EA88A',
        buttonText: '#0F1A18',
      },
    },
  },

  cork: {
    id: 'cork',
    titleFont: roundedFont,
    preview: { bg: '#C4A882', primary: '#5C7A35', border: '#D8CCBA' },
    radii: { card: 20, button: 18, input: 16, badge: 999, sm: 12 },
    cardShadowColor: '#2A1F10',
    cardShadowOpacity: 0.18,
    completedSlotBg: '#EDE4D0',
    colors: {
      light: {
        primary: '#5C7A35',
        primaryDark: '#425A25',
        accent: '#A0522D',
        surface: '#FAFAF6',
        onSurface: '#1E1408',
        muted: '#8A7060',
        destructive: '#C82020',
        destructiveMuted: '#8C3A2A',
        text: '#1E1408',
        background: '#C4A882',
        tint: '#5C7A35',
        icon: '#4A3018',            // mid-brown #8A7060 → 2.03:1 on cork; #4A3018 passes 5.37:1
        tabIconDefault: '#4A3018',  // same
        tabIconSelected: '#2A4510', // olive #5C7A35 → 2.16:1 on cork; #2A4510 passes 4.74:1
        border: '#D8CCBA',
        buttonBackground: '#425A25',
        buttonText: '#FFFFFF',
      },
      dark: {
        primary: '#7DAA4A',
        primaryDark: '#5C8035',
        accent: '#C07040',
        surface: '#3A2D1E',
        onSurface: '#F5EEE4',
        muted: '#9A8878',
        destructive: '#E04040',
        destructiveMuted: '#B85040',
        text: '#F5EEE4',
        background: '#2A1F10',
        tint: '#7DAA4A',
        icon: '#9A8878',
        tabIconDefault: '#9A8878',
        tabIconSelected: '#7DAA4A',
        border: '#4A3A28',
        buttonBackground: '#7DAA4A',
        buttonText: '#1E1408',
      },
    },
  },
  gartenlaube: {
    id: 'gartenlaube',
    titleFont: scriptFont,
    bodyFont: serifFont,
    preview: { bg: '#EEE8F0', primary: '#7A4E82', border: '#D8CEDC' },
    radii: { card: 16, button: 14, input: 12, badge: 999, sm: 10 },
    cardShadowColor: '#2E1840',
    cardShadowOpacity: 0.10,
    completedSlotBg: '#E4D8E8',
    colors: {
      light: {
        primary: '#7A4E82',
        primaryDark: '#5C3862',
        accent: '#5C7E5A',
        surface: '#FAF8FB',
        onSurface: '#1E1422',
        muted: '#7A6E7E',
        destructive: '#C82020',
        destructiveMuted: '#8C3A2A',
        text: '#1E1422',
        background: '#EEE8F0',
        tint: '#7A4E82',
        icon: '#6A5E6E',            // muted #7A6E7E → 4.00:1 on lavender bg; #6A5E6E passes 5.07:1
        tabIconDefault: '#6A5E6E',  // same
        tabIconSelected: '#7A4E82', // plum — 5.38:1 ✓
        border: '#D8CEDC',
        buttonBackground: '#5C3862',
        buttonText: '#FFFFFF',
      },
      dark: {
        primary: '#C49AC8',
        primaryDark: '#A878B0',
        accent: '#8AAF88',
        surface: '#231428',
        onSurface: '#F0E8F4',
        muted: '#9A8A9E',
        destructive: '#E04040',
        destructiveMuted: '#B85040',
        text: '#F0E8F4',
        background: '#160E1C',
        tint: '#C49AC8',
        icon: '#9A8A9E',            // 5.84:1 on dark plum bg ✓
        tabIconDefault: '#9A8A9E',  // same
        tabIconSelected: '#C49AC8', // light mauve — 7.90:1 ✓
        border: '#3A2840',
        buttonBackground: '#A878B0',
        buttonText: '#FFFFFF',
      },
    },
  },

  // Bond palettes — navy/cream base with a [coral, orange, yellow, teal]
  // accent set. Light mode rests on Bond cream (#FEFAF1); dark mode on the
  // signature Bond navy (#003364) with raised navy-card surfaces (#0A3F73).
  // "Sage" is the soft/muted accent set (first Bond palette).
  sage: {
    id: 'sage',
    titleFont: systemFont,
    preview: { bg: '#FEFAF1', primary: '#E47A5C', border: '#E7E0D6' },
    radii: { card: 18, button: 14, input: 12, badge: 999, sm: 10 },
    cardShadowColor: '#001A33',
    cardShadowOpacity: 0.18,
    completedSlotBg: '#DCEDE4',
    colors: {
      light: {
        primary: '#E47A5C',
        primaryDark: '#B0502F',
        accent: '#2C7D67',          // sage teal, 4.76:1 on cream ✓
        surface: '#FFFFFF',
        onSurface: '#1A1A1A',
        muted: '#6B6460',
        destructive: '#DC2626',
        destructiveMuted: '#8C3A2A',
        text: '#1A1A1A',
        background: '#FEFAF1',      // Bond cream
        tint: '#E47A5C',
        icon: '#6B6460',            // 5.57:1 on cream ✓
        tabIconDefault: '#6B6460',  // same
        tabIconSelected: '#B0502F', // soft coral #E47A5C is low-contrast; primaryDark passes 5.00:1
        border: '#E7E0D6',
        buttonBackground: '#B0502F',
        buttonText: '#FFFFFF',      // 5.21:1 on button ✓
      },
      dark: {
        primary: '#EA8366',
        primaryDark: '#D26A4E',
        accent: '#7FD0B3',          // sage teal, 6.98:1 on navy ✓
        surface: '#0A3F73',         // Bond navy-card
        onSurface: '#FEFEFE',       // 10.56:1 on surface ✓
        muted: '#93A6BD',           // 5.09:1 on navy ✓
        destructive: '#E04040',
        destructiveMuted: '#B85040',
        text: '#FEFEFE',
        background: '#003364',      // Bond navy
        tint: '#EA8366',
        icon: '#9DB0C8',            // 5.72:1 on navy ✓
        tabIconDefault: '#9DB0C8',  // same
        tabIconSelected: '#EA8366', // 4.79:1 on navy ✓
        border: '#18497B',
        buttonBackground: '#EA8366',
        buttonText: '#06243F',      // deep navy, 5.96:1 on coral button ✓
      },
    },
  },

  // hiToco brand palette (hitoco.com) — deep hiToco blue (#002692) on the
  // light blue tint scale (#f0f6fa/#d4e7f2/#006ba7), with the site's warm
  // orange/beige accents. Dark mode derives from hitoco-blue-dark (#000E33).
  // Two light variants: "Blue" rests on color-theme-hitoco-blue (#F0F6FA),
  // "Warm" on the hitoco beige (#FEF7F1). Both share the same dark mode.
  tocoBlue: {
    id: 'tocoBlue',
    titleFont: systemFont,
    preview: { bg: '#F0F6FA', primary: '#002692', border: '#D4E7F2' },
    radii: { card: 12, button: 12, input: 10, badge: 999, sm: 6 },
    cardShadowColor: '#000E33',
    cardShadowOpacity: 0.12,
    completedSlotBg: '#FFE7CE',   // hitoco-orange-dark
    colors: {
      light: {
        primary: '#002692',         // hitoco-blue-primary
        primaryDark: '#001A66',
        accent: '#006BA7',          // adhs-kids-primary-400, 4.55:1 on #F0F6FA ✓
        surface: '#FFFFFF',
        onSurface: '#323232',       // site --black
        muted: '#4D4D4D',           // site --gray
        destructive: '#DC1616',     // site --error
        destructiveMuted: '#8C3A2A',
        text: '#323232',
        background: '#F0F6FA',      // color-theme-hitoco-blue
        tint: '#002692',
        icon: '#4D4D4D',            // 7.79:1 on #F0F6FA ✓
        tabIconDefault: '#4D4D4D',  // same
        tabIconSelected: '#002692', // 13.55:1 ✓
        border: '#D4E7F2',          // adhs-kids-primary-200
        buttonBackground: '#002692',
        buttonText: '#FFFFFF',
      },
      dark: {
        primary: '#7FA3FF',
        primaryDark: '#5C85F0',
        accent: '#FFBF36',          // site --orange, 9.65:1 on navy ✓
        surface: '#0A2050',
        onSurface: '#EFF4FA',
        muted: '#93A6BD',
        destructive: '#E04040',
        destructiveMuted: '#B85040',
        text: '#EFF4FA',
        background: '#000E33',      // hitoco-blue-dark (opaque)
        tint: '#7FA3FF',
        icon: '#9DB0C8',            // 7.86:1 on #000E33 ✓
        tabIconDefault: '#9DB0C8',  // same
        tabIconSelected: '#7FA3FF', // 6.36:1 ✓
        border: '#1A3060',
        buttonBackground: '#7FA3FF',
        buttonText: '#000E33',
      },
    },
  },

  tocoWarm: {
    id: 'tocoWarm',
    titleFont: systemFont,
    preview: { bg: '#FEF7F1', primary: '#002692', border: '#E4D5C8' },
    radii: { card: 12, button: 12, input: 10, badge: 999, sm: 6 },
    cardShadowColor: '#000E33',
    cardShadowOpacity: 0.12,
    completedSlotBg: '#FFE7CE',   // hitoco-orange-dark
    colors: {
      light: {
        primary: '#002692',         // hitoco-blue-primary
        primaryDark: '#001A66',
        accent: '#006BA7',          // adhs-kids-primary-400, 4.83:1 on #FEF7F1 ✓
        surface: '#FFFFFF',
        onSurface: '#323232',       // site --black
        muted: '#4D4D4D',           // site --gray
        destructive: '#DC1616',     // site --error
        destructiveMuted: '#8C3A2A',
        text: '#323232',
        background: '#FEF7F1',      // warm hitoco beige (rgb 254 247 241)
        tint: '#002692',
        icon: '#4D4D4D',            // 8.28:1 on #FEF7F1 ✓
        tabIconDefault: '#4D4D4D',  // same
        tabIconSelected: '#002692', // 13.55:1 ✓
        border: '#E4D5C8',          // color-theme-beige-dark
        buttonBackground: '#002692',
        buttonText: '#FFFFFF',
      },
      dark: {
        primary: '#7FA3FF',
        primaryDark: '#5C85F0',
        accent: '#FFBF36',          // site --orange, 9.65:1 on navy ✓
        surface: '#0A2050',
        onSurface: '#EFF4FA',
        muted: '#93A6BD',
        destructive: '#E04040',
        destructiveMuted: '#B85040',
        text: '#EFF4FA',
        background: '#000E33',      // hitoco-blue-dark (opaque)
        tint: '#7FA3FF',
        icon: '#9DB0C8',            // 7.86:1 on #000E33 ✓
        tabIconDefault: '#9DB0C8',  // same
        tabIconSelected: '#7FA3FF', // 6.36:1 ✓
        border: '#1A3060',
        buttonBackground: '#7FA3FF',
        buttonText: '#000E33',
      },
    },
  },

};

export const DEFAULT_THEME_ID: ThemeId = 'sage';

// For use inside StyleSheet.create() which runs at module level (before any theme is known).
// JSX inline styles should use `radii` from `useAppTheme()` for live theme switching.
export const DEFAULT_RADII: ThemeRadii = THEMES.sage.radii;
