import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { de } from './de';

// German-only app. Resources are inline so init is synchronous (no async load,
// no Suspense). Importing this module once (from app/_layout.tsx) is enough.
i18n.use(initReactI18next).init({
  resources: { de: { translation: de } },
  lng: 'de',
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
