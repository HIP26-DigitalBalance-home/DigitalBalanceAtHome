import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Spacing } from '@/constants/theme';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.container}>
      <Text style={[styles.message, { color: colors.destructive }]}>{message}</Text>
      {onRetry ? (
        <Pressable
          style={[styles.button, { borderColor: colors.destructive }]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Erneut versuchen"
        >
          <Text style={[styles.buttonText, { color: colors.destructive }]}>Erneut versuchen</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    height: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
