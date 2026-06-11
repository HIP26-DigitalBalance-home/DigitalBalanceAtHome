import { AxiosError } from 'axios';

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

export function getGermanErrorMessage(error: unknown): string {
  if (!(error instanceof AxiosError)) {
    return 'Ein unbekannter Fehler ist aufgetreten.';
  }

  if (error.code === 'ECONNABORTED') {
    return 'Zeitüberschreitung. Bitte Verbindung prüfen.';
  }

  if (!error.response) {
    return 'Keine Verbindung zum Server. Bitte Internetverbindung prüfen.';
  }

  const status = error.response.status;
  const code = getErrorCode(error);

  if (status === 401) return 'Bitte erneut anmelden.';
  if (status === 403 && code === 'consent_version_mismatch') return 'Bitte Datenschutzerklärung erneut bestätigen.';
  if (status === 403) return 'Keine Berechtigung für diese Aktion.';
  if (status === 404) return 'Inhalt nicht gefunden.';
  if (status === 429) return 'Zu viele Anfragen. Bitte kurz warten.';
  if (status === 500) return 'Serverfehler. Bitte später erneut versuchen.';

  return 'Ein unbekannter Fehler ist aufgetreten.';
}
