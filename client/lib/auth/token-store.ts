import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  accessToken: 'dba_access_token',
  refreshToken: 'dba_refresh_token',
  user: 'dba_user',
} as const;

export const tokenStore = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.accessToken);
  },
  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.accessToken, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.refreshToken);
  },
  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.refreshToken, token);
  },

  async getUser<T>(): Promise<T | null> {
    const raw = await AsyncStorage.getItem(KEYS.user);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  async setUser(user: unknown): Promise<void> {
    await AsyncStorage.setItem(KEYS.user, JSON.stringify(user));
  },

  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.accessToken),
      SecureStore.deleteItemAsync(KEYS.refreshToken),
      AsyncStorage.removeItem(KEYS.user),
    ]);
  },
};
