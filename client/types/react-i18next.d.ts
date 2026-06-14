import 'react-i18next';

import type { de } from '@/lib/i18n/de';

// Type-checks t('…') keys against the German bundle so tsc catches typos /
// missing keys.
declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof de };
  }
}
