import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = '@dba_onboarding_v1';

export function useOnboardingStatus(): boolean | null {
  const [status, setStatus] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY).then((value) => {
      if (!cancelled) setStatus(value === 'true');
    });
    return () => { cancelled = true; };
  }, []);

  return status;
}

export async function markOnboardingCompleted(): Promise<void> {
  await AsyncStorage.setItem(KEY, 'true');
}

export async function resetOnboardingStatus(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
