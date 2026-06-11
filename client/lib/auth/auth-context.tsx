import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { apiClient, registerAuthHandlers } from '@/lib/api';
import { tokenStore } from './token-store';

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  profile_photo_url: string | null;
  points_balance: number;
  deletion_pending_at?: string | null;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  currentUser: AuthUser | null;
  login: (payload: Record<string, string | null | undefined>) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  updateCurrentUser: (user: AuthUser) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const accessTokenRef = useRef<string | null>(null);

  // Restore session from storage on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [accessToken, user] = await Promise.all([
        tokenStore.getAccessToken(),
        tokenStore.getUser<AuthUser>(),
      ]);
      if (!cancelled) {
        if (accessToken && user) {
          accessTokenRef.current = accessToken;
          setCurrentUser(user);
        }
        setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refreshTokens = useCallback(async () => {
    const refreshToken = await tokenStore.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token stored');

    const response = await apiClient.post('/auth/refresh', { refresh_token: refreshToken });
    const { access_token, refresh_token: newRefresh, user } = response.data;

    await tokenStore.setAccessToken(access_token);
    await tokenStore.setRefreshToken(newRefresh);
    await tokenStore.setUser(user);
    accessTokenRef.current = access_token;
    setCurrentUser(user);
  }, []);

  const login = useCallback(async (
    payload: Record<string, string | null | undefined>,
  ) => {
    const response = await apiClient.post('/auth/google/callback', payload);
    const { access_token, refresh_token, user } = response.data;

    await tokenStore.setAccessToken(access_token);
    await tokenStore.setRefreshToken(refresh_token);
    await tokenStore.setUser(user);
    accessTokenRef.current = access_token;
    setCurrentUser(user);
  }, []);

  const logout = useCallback(async () => {
    await apiClient.delete('/auth/logout').catch(() => {});
    await tokenStore.clear();
    accessTokenRef.current = null;
    setCurrentUser(null);
  }, []);

  // Wire the API client auth handlers once on mount
  useEffect(() => {
    registerAuthHandlers({
      getAccessToken: () => accessTokenRef.current,
      refreshTokens,
      // Force logout when refresh fails (stale token after DB wipe, expiry, etc.)
      onRefreshFailed: () => {
        tokenStore.clear();
        accessTokenRef.current = null;
        setCurrentUser(null);
      },
    });
  }, [refreshTokens]);

  const updateCurrentUser = useCallback(async (user: AuthUser) => {
    await tokenStore.setUser(user);
    setCurrentUser(user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: currentUser !== null,
      isLoading,
      currentUser,
      login,
      logout,
      refreshTokens,
      updateCurrentUser,
    }),
    [currentUser, isLoading, login, logout, refreshTokens, updateCurrentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
