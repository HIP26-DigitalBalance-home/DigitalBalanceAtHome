import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';

const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Injected by AuthContext once tokens are available
let getAccessToken: (() => string | null) | null = null;
let refreshTokens: (() => Promise<void>) | null = null;
let onRefreshFailed: (() => void) | null = null;
let onConsentMismatch: (() => void) | null = null;

export function registerAuthHandlers(handlers: {
  getAccessToken: () => string | null;
  refreshTokens: () => Promise<void>;
  onRefreshFailed: () => void;
  onConsentMismatch?: () => void;
}) {
  getAccessToken = handlers.getAccessToken;
  refreshTokens = handlers.refreshTokens;
  onRefreshFailed = handlers.onRefreshFailed;
  onConsentMismatch = handlers.onConsentMismatch ?? null;
}

// Attach Authorization header
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken?.();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Retry once on 401 after refreshing tokens.
// Auth endpoints (/auth/*) are excluded — they must not trigger another refresh cycle.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const isAuthEndpoint = originalRequest.url?.startsWith('/auth/') ?? false;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint &&
      refreshTokens
    ) {
      originalRequest._retry = true;
      try {
        await refreshTokens();
        const token = getAccessToken?.();
        if (token) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return apiClient(originalRequest);
      } catch {
        // Refresh failed (stale token, DB wipe, etc.) — force logout so the
        // user lands on the sign-in screen instead of looping.
        onRefreshFailed?.();
      }
    }

    const code = (error.response?.data as Record<string, unknown> | undefined)?.code;
    if (code === 'consent_version_mismatch') {
      onConsentMismatch?.();
    }

    return Promise.reject(error);
  }
);
