import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII, THEMES, type ColorMode, type ThemeId } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import { useLanguage } from '@/lib/i18n/language-context';
import type { AppLanguage } from '@/lib/i18n/language-preloader';
import { useAuth } from '@/lib/auth';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { devApi } from '@/lib/api';
import { showAlert, confirmDestructive } from '@/lib/utils/alert';

export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { themeId, setTheme, colorMode, setColorMode } = useAppTheme();
  const { language, setLanguage } = useLanguage();
  const router = useRouter();
  const isOnline = useNetworkStatus();
  const [seeding, setSeeding] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  async function handleSeedDemo() {
    const confirmed = await confirmDestructive(
      t('profile.loadDemoTitle'),
      t('profile.loadDemoMsg'),
      t('profile.loadDemoConfirm'),
    );
    if (!confirmed) return;
    setSeeding(true);
    try {
      await devApi.seed();
      showAlert(t('profile.loadDemoSuccess'), t('profile.loadDemoSuccessMsg'));
      router.replace('/(tabs)/' as any);
    } catch {
      showAlert(t('common.error'), t('profile.loadDemoFailed'));
    } finally {
      setSeeding(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary, fontSize: 16 }}>‹ {t('common.back')}</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.title}>{t('settings.title')}</ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Privacy & data */}
        <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>{t('profile.privacyData')}</ThemedText>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            style={[styles.outlineButton, { borderColor: colors.border, marginTop: 0 }]}
            onPress={() => router.push('/privacy' as any)}>
            <ThemedText style={{ fontWeight: '600' }}>{t('profile.privacyData')}</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.outlineButton, { borderColor: colors.border }]}
            onPress={() => router.push('/privacy-policy' as any)}>
            <ThemedText style={{ fontWeight: '600' }}>{t('profile.privacyPolicy')}</ThemedText>
          </Pressable>
        </View>

        {/* Darstellung */}
        <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>{t('profile.displaySection')}</ThemedText>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

          {/* Color mode segmented control — one border on the container, hairlines inside */}
          <View style={[styles.modeToggle, { borderColor: colors.border }]}>
            {(['light', 'system', 'dark'] as ColorMode[]).map((mode, idx, arr) => {
              const labels: Record<ColorMode, string> = { light: t('themes.colorMode.light'), system: t('themes.colorMode.system'), dark: t('themes.colorMode.dark') };
              const isActive = mode === colorMode;
              const isLast = idx === arr.length - 1;
              return (
                <Pressable
                  key={mode}
                  style={[
                    styles.modeOption,
                    { backgroundColor: isActive ? colors.primary + '14' : 'transparent' },
                    !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                  onPress={() => setColorMode(mode)}
                  accessibilityRole="button"
                  accessibilityLabel={`${labels[mode]}${isActive ? `, ${t('themes.colorMode.active')}` : ''}`}
                >
                  <Text style={[
                    styles.modeChipText,
                    { color: isActive ? colors.primary : colors.muted, opacity: isActive ? 1 : 0.55 },
                  ]}>
                    {labels[mode]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Divider */}
          <View style={[styles.modeDivider, { backgroundColor: colors.border }]} />

          {/* Theme swatches — horizontal scroll so they never overflow */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.themeRow}
          >
            {Object.values(THEMES).map((th) => {
              const isActive = th.id === themeId;
              return (
                <Pressable
                  key={th.id}
                  style={styles.themeSwatch}
                  onPress={() => setTheme(th.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t(`themes.${th.id}` as `themes.${ThemeId}`)}${isActive ? `, ${t('themes.colorMode.active')}` : ''}`}
                >
                  {/* borderWidth is always 3 — only color changes, no layout shift */}
                  <View style={[
                    styles.swatchCircle,
                    { backgroundColor: th.preview.bg, borderColor: isActive ? th.preview.primary : th.preview.border },
                  ]}>
                    <View style={[styles.swatchDot, { backgroundColor: th.preview.primary }]} />
                  </View>
                  <Text style={[styles.swatchLabel, { color: isActive ? colors.primary : colors.muted, opacity: isActive ? 1 : 0.6 }]}>
                    {t(`themes.${th.id}` as `themes.${ThemeId}`)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Language / Sprache */}
        <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>{t('profile.languageSection')}</ThemedText>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.modeToggle, { borderColor: colors.border }]}>
            {(['de', 'en'] as AppLanguage[]).map((lng, idx, arr) => {
              const labels: Record<AppLanguage, string> = { de: t('language.german'), en: t('language.english') };
              const isActive = lng === language;
              const isLast = idx === arr.length - 1;
              return (
                <Pressable
                  key={lng}
                  style={[
                    styles.modeOption,
                    { backgroundColor: isActive ? colors.primary + '14' : 'transparent' },
                    !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                  onPress={() => setLanguage(lng)}
                  accessibilityRole="button"
                  accessibilityLabel={`${labels[lng]}${isActive ? `, ${t('themes.colorMode.active')}` : ''}`}
                >
                  <Text style={[
                    styles.modeChipText,
                    { color: isActive ? colors.primary : colors.muted, opacity: isActive ? 1 : 0.55 },
                  ]}>
                    {labels[lng]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Sign out */}
        <Pressable
          style={styles.destructiveLink}
          onPress={logout}>
          <ThemedText style={{ color: colors.destructiveMuted, fontSize: 13 }}>{t('profile.signOut')}</ThemedText>
        </Pressable>

        {/* Debug section — collapsed by default */}
        <Pressable onPress={() => setShowDebug((v) => !v)} style={styles.debugToggle}>
          <ThemedText style={[styles.debugToggleText, { color: colors.muted }]}>
            {showDebug ? '▴ debug' : '▾ debug'}
          </ThemedText>
        </Pressable>
        {showDebug && (
          <Pressable
            style={[styles.outlineButton, { borderColor: colors.border, opacity: (seeding || !isOnline) ? 0.6 : 1 }]}
            onPress={handleSeedDemo}
            disabled={seeding || !isOnline}>
            {seeding ? (
              <ActivityIndicator color={colors.muted} size="small" />
            ) : (
              <ThemedText style={{ color: colors.muted, fontWeight: '500' }}>{t('profile.loadDemo')}</ThemedText>
            )}
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { marginBottom: Spacing.xs },
  title: { fontSize: 28 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginTop: Spacing.sm },
  card: { borderRadius: DEFAULT_RADII.card, borderWidth: 1, padding: Spacing.md, gap: Spacing.xs },
  outlineButton: {
    height: 44,
    borderRadius: DEFAULT_RADII.button,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  destructiveLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  debugToggle: { alignItems: 'center', paddingVertical: Spacing.sm },
  debugToggleText: { fontSize: 11, letterSpacing: 0.5 },
  modeToggle: {
    borderWidth: 1,
    borderRadius: DEFAULT_RADII.button,
    overflow: 'hidden',
  },
  modeOption: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeChipText: { fontSize: 14, fontWeight: '700' },
  modeDivider: { height: 1, marginHorizontal: -Spacing.md, marginTop: Spacing.xs },
  themeRow: { flexDirection: 'row', gap: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  themeSwatch: { alignItems: 'center', gap: Spacing.xs },
  swatchCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,            // always 3 — active state changes color only, never width
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchDot: { width: 20, height: 20, borderRadius: 10 },
  swatchLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
});
