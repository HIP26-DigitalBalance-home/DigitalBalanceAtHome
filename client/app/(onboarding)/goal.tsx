import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { onboardingApi, progressApi } from '@/lib/api';

const GOAL_OPTIONS = [1, 2, 3, 4] as const;

export default function GoalScreen() {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();
  const [selected, setSelected] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    setIsSubmitting(true);
    try {
      const familiesRes = await onboardingApi.getMyFamilies();
      const fid = familiesRes.data[0]?.id;
      if (fid) {
        await progressApi.updateSettings(fid, { weekly_goal: selected });
      }
    } catch {
      // best-effort — default of 2 is already in DB
    } finally {
      router.replace('/(tabs)');
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <ThemedText type="title">{t('onboardingGoal.title')}</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
          {t('onboardingGoal.subtitle')}
        </ThemedText>

        <View style={styles.options}>
          {GOAL_OPTIONS.map((n) => (
            <Pressable
              key={n}
              style={[
                styles.option,
                {
                  borderColor: selected === n ? colors.primary : colors.border,
                  backgroundColor: selected === n ? colors.primary + '18' : colors.surface,
                },
              ]}
              onPress={() => setSelected(n)}
            >
              <ThemedText
                style={[styles.optionText, { color: selected === n ? colors.primary : colors.onSurface }]}
              >
                {t('onboardingGoal.perWeek', { count: n })}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]}
          onPress={handleConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>
              {t('onboardingGoal.confirm')}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: Spacing.screenHorizontal, paddingTop: Spacing.xl, gap: Spacing.xl },
  subtitle: { fontSize: 15, lineHeight: 22 },
  options: { gap: Spacing.sm },
  option: { height: 56, borderWidth: 1.5, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionText: { fontSize: 16, fontWeight: '600' },
  footer: { padding: Spacing.screenHorizontal, paddingBottom: Spacing.xl },
  button: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
