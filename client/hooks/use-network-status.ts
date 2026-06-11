import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Network.getNetworkStateAsync().then((state) => {
      if (!cancelled) setIsOnline(state.isConnected ?? true);
    });

    const sub = Network.addNetworkStateListener((state) => {
      if (!cancelled) setIsOnline(state.isConnected ?? true);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return isOnline;
}
