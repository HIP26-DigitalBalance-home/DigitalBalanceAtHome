import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface FeatureCardProps {
  icon: string;
  title: string;
  body: string;
}

export function FeatureCard({ icon, title, body }: FeatureCardProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  return (
    <View style={styles.card}>
      <ThemedText style={styles.icon}>{icon}</ThemedText>
      <ThemedText type="title" style={[styles.title, { color: colors.onSurface }]}>
        {title}
      </ThemedText>
      <ThemedText style={[styles.body, { color: colors.muted }]}>{body}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  icon: { fontSize: 64 },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', fontSize: 16, lineHeight: 24 },
});
