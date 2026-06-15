import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';

interface FeatureCardProps {
  icon: string;
  title: string;
  body: string;
}

export function FeatureCard({ icon, title, body }: FeatureCardProps) {
  const { colors, radii } = useAppTheme();
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
