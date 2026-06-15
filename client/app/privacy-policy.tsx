import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type React from 'react';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import type { ThemeColors } from '@/constants/themes';
import PrivacyDe from '@/assets/legal/privacy-de';
import PrivacyEn from '@/assets/legal/privacy-en';

const POLICY_CONTENT: Record<string, React.ComponentType<{ colors: ThemeColors }>> = {
  de: PrivacyDe,
  en: PrivacyEn,
};

export default function PrivacyPolicyScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const PolicyContent = POLICY_CONTENT[i18n.language] ?? POLICY_CONTENT.de;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={styles.backButton}
        >
          <ThemedText style={[styles.backText, { color: colors.primary }]}>← {t('common.back')}</ThemedText>
        </Pressable>
        <ThemedText style={styles.headerTitle}>{t('profile.privacyPolicy')}</ThemedText>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        <PolicyContent colors={colors} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingBottom: 12,
  },
  backButton: { paddingVertical: 4, marginBottom: 4 },
  backText: { fontSize: 15, fontWeight: '500' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },
});
