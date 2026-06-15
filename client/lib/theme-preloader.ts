import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_COLOR_MODE, DEFAULT_THEME_ID, THEMES, type ColorMode, type ThemeId } from '@/constants/themes';

export const THEME_STORAGE_KEY = '@dba_theme_id';
export const COLOR_MODE_KEY = '@dba_color_mode';

// Fire at module evaluation time — before any React component renders.
// By the time the component tree mounts, this promise is almost always resolved.
let _themeId: ThemeId = DEFAULT_THEME_ID;
let _colorMode: ColorMode = DEFAULT_COLOR_MODE;
let _done = false;

export const themeReadyPromise: Promise<void> = Promise.all([
  AsyncStorage.getItem(THEME_STORAGE_KEY),
  AsyncStorage.getItem(COLOR_MODE_KEY),
])
  .then(([tv, mv]) => {
    if (tv && tv in THEMES) _themeId = tv as ThemeId;
    if (mv === 'light' || mv === 'dark' || mv === 'system') _colorMode = mv;
  })
  .catch(() => {})
  .finally(() => { _done = true; });

export const themePreloader = {
  isDone: () => _done,
  getValue: () => _themeId,   // keep for back-compat
  getThemeId: () => _themeId,
  getColorMode: () => _colorMode,
};
