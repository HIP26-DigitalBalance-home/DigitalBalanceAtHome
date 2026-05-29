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

// Injected by AuthContext once tokens are available (M2)
let getAccessToken: (() => string | null) | null = null;
let refreshTokens: (() => Promise<void>) | null = null;

export function registerAuthHandlers(handlers: {
  getAccessToken: () => string | null;
  refreshTokens: () => Promise<void>;
}) {
  getAccessToken = handlers.getAccessToken;
  refreshTokens = handlers.refreshTokens;
}

// Attach Authorization header
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken?.();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Retry once on 401 after refreshing tokens
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !originalRequest._retry && refreshTokens) {
      originalRequest._retry = true;
      try {
        await refreshTokens();
        const token = getAccessToken?.();
        if (token) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return apiClient(originalRequest);
      } catch {
        // refresh failed — caller will handle the 401
      }
    }
    return Promise.reject(error);
  }
);
