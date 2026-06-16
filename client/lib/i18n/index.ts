import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { de } from './de';
import { en } from './en';
import { languagePreloader } from './language-preloader';

// English + German. Resources are inline so init is synchronous (no async load,
// no Suspense). The initial language comes from the preloader (a stored
// preference); if it hasn't resolved yet we fall back to the default and the
// LanguageProvider corrects it once the AsyncStorage read finishes.
// Importing this module once (from app/_layout.tsx) is enough.
i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    en: { translation: en },
  },
  lng: languagePreloader.getLanguage(),
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
