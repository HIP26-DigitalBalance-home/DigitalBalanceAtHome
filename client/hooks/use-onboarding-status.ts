import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { onboardingApi } from '@/lib/api';

const KEY = '@dba_onboarding_v1';

export function useOnboardingStatus(isAuthenticated: boolean): boolean | null {
  const [status, setStatus] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const local = await AsyncStorage.getItem(KEY);
      if (local === 'true') {
        if (!cancelled) setStatus(true);
        return;
      }

      if (!isAuthenticated) {
        if (!cancelled) setStatus(false);
        return;
      }

      // Local flag absent but user is authenticated — verify against backend so
      // clearing site data doesn't force a repeat onboarding for existing users.
      try {
        const [consentRes, familiesRes, childrenRes] = await Promise.all([
          onboardingApi.getConsent(),
          onboardingApi.getMyFamilies(),
          onboardingApi.getChildren(),
        ]);

        const hasConsent = consentRes.data != null;
        const hasFamilies = Array.isArray(familiesRes.data)
          ? familiesRes.data.length > 0
          : familiesRes.data != null;
        const hasChildren = Array.isArray(childrenRes.data) && childrenRes.data.length > 0;

        if (hasConsent && hasFamilies && hasChildren) {
          await AsyncStorage.setItem(KEY, 'true');
          if (!cancelled) setStatus(true);
        } else {
          if (!cancelled) setStatus(false);
        }
      } catch {
        if (!cancelled) setStatus(false);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return status;
}

export async function markOnboardingCompleted(): Promise<void> {
  await AsyncStorage.setItem(KEY, 'true');
}

export async function resetOnboardingStatus(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
