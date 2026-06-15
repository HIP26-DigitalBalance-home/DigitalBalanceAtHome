import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import {
  DEFAULT_COLOR_MODE,
  DEFAULT_THEME_ID,
  THEMES,
  type AppThemeDef,
  type ColorMode,
  type ThemeColors,
  type ThemeId,
  type ThemeRadii,
} from '@/constants/themes';
import { COLOR_MODE_KEY, themePreloader, themeReadyPromise, THEME_STORAGE_KEY } from '@/lib/theme-preloader';

interface AppThemeContextValue {
  themeId: ThemeId;
  theme: AppThemeDef;
  colors: ThemeColors;
  radii: ThemeRadii;
  colorMode: ColorMode;
  effectiveScheme: 'light' | 'dark';
  setTheme: (id: ThemeId) => Promise<void>;
  setColorMode: (mode: ColorMode) => Promise<void>;
}

const AppThemeContext = createContext<AppThemeContextValue>({
  themeId: DEFAULT_THEME_ID,
  theme: THEMES[DEFAULT_THEME_ID],
  colors: THEMES[DEFAULT_THEME_ID].colors.light,
  radii: THEMES[DEFAULT_THEME_ID].radii,
  colorMode: DEFAULT_COLOR_MODE,
  effectiveScheme: 'light',
  setTheme: async () => {},
  setColorMode: async () => {},
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(() => themePreloader.getThemeId());
  const [colorMode, setColorModeState] = useState<ColorMode>(() => themePreloader.getColorMode());
  const [ready, setReady] = useState(() => themePreloader.isDone());

  const osScheme = useColorScheme() ?? 'light';

  useEffect(() => {
    if (!ready) {
      themeReadyPromise.then(() => {
        setThemeId(themePreloader.getThemeId());
        setColorModeState(themePreloader.getColorMode());
        setReady(true);
      });
    }
  }, [ready]);

  const setTheme = useCallback(async (id: ThemeId) => {
    setThemeId(id);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, id);
  }, []);

  const setColorMode = useCallback(async (mode: ColorMode) => {
    setColorModeState(mode);
    await AsyncStorage.setItem(COLOR_MODE_KEY, mode);
  }, []);

  if (!ready) return null;

  const effectiveScheme: 'light' | 'dark' = colorMode === 'system' ? osScheme : colorMode;
  const theme = THEMES[themeId];
  const value: AppThemeContextValue = {
    themeId,
    theme,
    colors: theme.colors[effectiveScheme],
    radii: theme.radii,
    colorMode,
    effectiveScheme,
    setTheme,
    setColorMode,
  };

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme(): AppThemeContextValue {
  return useContext(AppThemeContext);
}
