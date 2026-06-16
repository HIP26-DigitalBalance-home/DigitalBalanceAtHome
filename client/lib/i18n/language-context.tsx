import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import i18n from './index';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_KEY,
  languagePreloader,
  languageReadyPromise,
  rememberLanguage,
  type AppLanguage,
} from './language-preloader';

interface LanguageContextValue {
  language: AppLanguage;
  // false until the user has explicitly picked a language (first launch).
  chosen: boolean;
  setLanguage: (lng: AppLanguage) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  chosen: false,
  setLanguage: async () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => languagePreloader.getLanguage());
  const [chosen, setChosen] = useState<boolean>(() => languagePreloader.isChosen());
  const [ready, setReady] = useState(() => languagePreloader.isDone());

  // Resolve the stored preference once the AsyncStorage read finishes. It has
  // usually resolved by mount, but guard for the cold-start race.
  useEffect(() => {
    if (ready) return;
    languageReadyPromise.then(() => {
      setLanguageState(languagePreloader.getLanguage());
      setChosen(languagePreloader.isChosen());
      setReady(true);
    });
  }, [ready]);

  // Keep the i18n runtime aligned with the resolved app language. i18n.init may
  // have run with the default before the stored preference was known, so this
  // corrects it both on first resolve and on every explicit change.
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  const setLanguage = useCallback(async (lng: AppLanguage) => {
    // Update the module cache first so a remount (triggered by the language
    // change) re-initialises to this choice rather than the stale default.
    rememberLanguage(lng);
    setLanguageState(lng);
    setChosen(true);
    await i18n.changeLanguage(lng);
    await AsyncStorage.setItem(LANGUAGE_KEY, lng);
  }, []);

  if (!ready) return null;

  return (
    <LanguageContext.Provider value={{ language, chosen, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
