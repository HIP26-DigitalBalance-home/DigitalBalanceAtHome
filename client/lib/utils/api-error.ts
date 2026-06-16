import { AxiosError } from 'axios';

import i18n from '@/lib/i18n';

function getErrorCode(error: unknown): string | undefined {
  if (error instanceof AxiosError) {
    return (error.response?.data as Record<string, unknown> | undefined)?.code as string | undefined;
  }
  return undefined;
}

export function isConsentVersionMismatch(error: unknown): boolean {
  return getErrorCode(error) === 'consent_version_mismatch';
}

export function isOfflineError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || !error.response;
  }
  return false;
}

// Localised via i18n (key group `errors`). Name kept for back-compat with the
// many call sites; the returned message follows the active app language.
export function getGermanErrorMessage(error: unknown): string {
  const t = i18n.t.bind(i18n);

  if (!(error instanceof AxiosError)) {
    return t('errors.unknown');
  }

  if (error.code === 'ECONNABORTED') {
    return t('errors.timeout');
  }

  if (!error.response) {
    return t('errors.noServer');
  }

  const status = error.response.status;
  const code = getErrorCode(error);

  if (status === 401) return t('errors.unauthorized');
  if (status === 403 && code === 'consent_version_mismatch') return t('errors.consentMismatch');
  if (status === 403) return t('errors.forbidden');
  if (status === 404) return t('errors.notFound');
  if (status === 429) return t('errors.tooManyRequests');
  if (status === 500) return t('errors.server');

  return t('errors.unknown');
}
