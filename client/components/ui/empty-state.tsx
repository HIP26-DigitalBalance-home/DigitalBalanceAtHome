import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Illustration, type IllustrationName } from '@/components/ui/illustration';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';

interface EmptyStateProps {
  illustration: IllustrationName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ illustration, title, body, actionLabel, onAction }: EmptyStateProps) {
  const { colors, radii } = useAppTheme();

  return (
    <View style={styles.container} accessibilityRole="none">
      <Illustration name={illustration} size={120} style={styles.icon} />
      <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
      {body ? <Text style={[styles.body, { color: colors.muted }]}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          style={[styles.button, { backgroundColor: colors.buttonBackground }]}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.buttonText, { color: colors.buttonText }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  icon: {
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    height: 44,
    borderRadius: DEFAULT_RADII.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
