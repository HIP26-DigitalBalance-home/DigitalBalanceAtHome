import AsyncStorage from '@react-native-async-storage/async-storage';

export const LANGUAGE_KEY = '@dba_language';

export type AppLanguage = 'de' | 'en';

export const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ['de', 'en'];

// Underlying default used by i18n until the user has made a choice. The
// first-launch picker is always shown (and rendered in English) before any
// other screen, so this value only matters for the brief moment before it.
export const DEFAULT_LANGUAGE: AppLanguage = 'de';

// Fire at module evaluation time — before any React component renders. By the
// time the component tree mounts, this promise is almost always resolved.
// `_chosen` distinguishes "no stored preference yet" (show the picker) from a
// user who has already picked a language.
let _language: AppLanguage = DEFAULT_LANGUAGE;
let _chosen = false;
let _done = false;

export const languageReadyPromise: Promise<void> = AsyncStorage.getItem(LANGUAGE_KEY)
  .then((v) => {
    if (v === 'de' || v === 'en') {
      _language = v;
      _chosen = true;
    }
  })
  .catch(() => {})
  .finally(() => {
    _done = true;
  });

export const languagePreloader = {
  isDone: () => _done,
  getLanguage: () => _language,
  isChosen: () => _chosen,
};

// Update the module-level cache when the user picks a language. The provider
// subtree remounts on a language change (react-i18next re-render churn), and on
// remount the provider re-initialises its state from this cache — so without
// this the freshly chosen language would be lost. Keeps cache and storage in sync.
export function rememberLanguage(lng: AppLanguage): void {
  _language = lng;
  _chosen = true;
  _done = true;
}
