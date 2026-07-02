import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Illustration, type IllustrationName } from '@/components/ui/illustration';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';

interface FeatureCardProps {
  illustration: IllustrationName;
  title: string;
  body: string;
}

export function FeatureCard({ illustration, title, body }: FeatureCardProps) {
  const { colors, radii } = useAppTheme();
  return (
    <View style={styles.card}>
      <Illustration name={illustration} size={180} />
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
  title: { textAlign: 'center' },
  body: { textAlign: 'center', fontSize: 16, lineHeight: 24 },
});
