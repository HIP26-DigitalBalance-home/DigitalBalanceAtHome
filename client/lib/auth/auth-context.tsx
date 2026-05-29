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
}

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  currentUser: AuthUser | null;
  login: (code: string, redirectUri: string, codeVerifier: string | null) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
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
    code: string,
    redirectUri: string,
    codeVerifier: string | null,
  ) => {
    const response = await apiClient.post('/auth/google/callback', {
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });
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
    });
  }, [refreshTokens]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: currentUser !== null,
      isLoading,
      currentUser,
      login,
      logout,
      refreshTokens,
    }),
    [currentUser, isLoading, login, logout, refreshTokens],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
