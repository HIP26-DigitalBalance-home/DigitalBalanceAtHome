import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * expo-secure-store requires a native development build.
 * In Expo Go or web we fall back to AsyncStorage so the auth flow
 * still works during development. Tokens are less secure in this mode
 * but the app remains functional.
 */
const canUseSecureStore = Platform.OS !== 'web';

async function secureGet(key: string): Promise<string | null> {
  if (canUseSecureStore) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // native module unavailable (e.g. Expo Go version mismatch) — fall through
    }
  }
  return AsyncStorage.getItem(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (canUseSecureStore) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      // fall through
    }
  }
  await AsyncStorage.setItem(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (canUseSecureStore) {
    try {
      await SecureStore.deleteItemAsync(key);
      return;
    } catch {
      // fall through
    }
  }
  await AsyncStorage.removeItem(key);
}

const KEYS = {
  accessToken: 'dba_access_token',
  refreshToken: 'dba_refresh_token',
  user: 'dba_user',
} as const;

export const tokenStore = {
  async getAccessToken(): Promise<string | null> {
    return secureGet(KEYS.accessToken);
  },
  async setAccessToken(token: string): Promise<void> {
    await secureSet(KEYS.accessToken, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return secureGet(KEYS.refreshToken);
  },
  async setRefreshToken(token: string): Promise<void> {
    await secureSet(KEYS.refreshToken, token);
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
      secureDelete(KEYS.accessToken),
      secureDelete(KEYS.refreshToken),
      AsyncStorage.removeItem(KEYS.user),
    ]);
  },
};
