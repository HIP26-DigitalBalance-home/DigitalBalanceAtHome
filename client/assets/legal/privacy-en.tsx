import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ThemeColors } from '@/constants/themes';

// TODO: Replace with the full English privacy policy before launching the English locale.
export default function PrivacyEn({ colors }: { colors: ThemeColors }) {
  return (
    <ThemedText style={[styles.placeholder, { color: colors.muted }]}>
      Privacy policy not yet available in English.
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  placeholder: { fontSize: 15, textAlign: 'center', marginTop: Spacing.xl },
});
