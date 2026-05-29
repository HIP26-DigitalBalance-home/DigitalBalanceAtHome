import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiClient } from '@/lib/api';

type ServerStatus = 'checking' | 'connected' | 'unreachable';

export default function HomeScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get('/healthz')
      .then(() => {
        if (!cancelled) setServerStatus('connected');
      })
      .catch(() => {
        if (!cancelled) setServerStatus('unreachable');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <ThemedText type="title">DigitalBalance @home</ThemedText>
        <ThemedText style={{ color: colors.muted }}>Collage screen coming in Milestone 6</ThemedText>

        <View style={styles.statusRow}>
          {serverStatus === 'checking' && (
            <>
              <ActivityIndicator size="small" color={colors.muted} />
              <ThemedText style={[styles.statusText, { color: colors.muted }]}>
                Connecting to server…
              </ThemedText>
            </>
          )}
          {serverStatus === 'connected' && (
            <ThemedText style={[styles.statusText, { color: colors.accent }]}>
              ✓ Server connected
            </ThemedText>
          )}
          {serverStatus === 'unreachable' && (
            <ThemedText style={[styles.statusText, { color: colors.destructive }]}>
              ✗ Server unreachable — is Docker Compose running?
            </ThemedText>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.screenHorizontal,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  statusText: { fontSize: 14 },
});
