import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { InsightsRow } from '@/components/insights-row';
import { ProgressRing } from '@/components/progress-ring';
import { TimeSpentChart } from '@/components/time-spent-chart';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { fadeIn } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { tabScreenPaddingBottom } from '@/constants/nav';
import { useAppTheme } from '@/lib/app-theme-context';
import { onboardingApi, progressApi, type FamilyProgress } from '@/lib/api';
import { getGermanErrorMessage } from '@/lib/utils/api-error';
import { showAlert } from '@/lib/utils/alert';

const GOAL_OPTIONS = [1, 2, 3, 4] as const;

export default function ProgressScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [progress, setProgress] = useState<FamilyProgress | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  useFocusEffect(useCallback(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const familiesRes = await onboardingApi.getMyFamilies();
        const fid = familiesRes.data[0]?.id;
        if (!fid) return;
        if (!cancelled) setFamilyId(fid);
        const progressRes = await progressApi.getProgress(fid);
        if (!cancelled) setProgress(progressRes.data);
      } catch (e) {
        if (!cancelled) setError(getGermanErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []));

  async function handleGoalSelect(goal: number) {
    if (!familyId || savingGoal) return;
    setSavingGoal(true);
    try {
      await progressApi.updateSettings(familyId, { weekly_goal: goal });
      setProgress((prev) => (prev ? { ...prev, weekly_goal: goal } : prev));
      setEditingGoal(false);
    } catch (e) {
      showAlert(t('common.error'), getGermanErrorMessage(e));
    } finally {
      setSavingGoal(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <IconSymbol name="chevron.right" size={22} color={colors.primary} style={{ transform: [{ scaleX: -1 }] }} />
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>{t('progress.title')}</ThemedText>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabScreenPaddingBottom(insets.bottom) }]}>
        {loading ? (
          <SkeletonList count={3} rowHeight={100} />
        ) : error ? (
          <ErrorState message={error} />
        ) : progress ? (
          // gap mirrors styles.content so the wrapper doesn't collapse spacing
          <Animated.View entering={fadeIn()} style={{ gap: Spacing.lg }}>
            <TimeSpentChart />

            <InsightsRow />

            {/* This Week */}
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>
                  {t('progress.thisWeek')}
                </ThemedText>
                <Pressable
                  onPress={() => setEditingGoal((v) => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('progress.editGoal')}
                >
                  <View style={styles.editGoalButton}>
                    <IconSymbol name="pencil" size={14} color={colors.primary} />
                    <ThemedText style={[styles.editGoalLabel, { color: colors.primary }]}>
                      {t('progress.editGoal')}
                    </ThemedText>
                  </View>
                </Pressable>
              </View>
              <View style={styles.weekRow}>
                <ProgressRing value={progress.this_week.activities} goal={progress.weekly_goal} size={72} strokeWidth={6} style={{ marginTop: 12 }} />
                <View style={styles.weekStats}>
                  <ThemedText style={[styles.statValue, { color: colors.onSurface }]}>
                    {t('progress.activitiesOfGoal', { value: progress.this_week.activities, goal: progress.weekly_goal })}
                  </ThemedText>
                  <ThemedText style={[styles.statValue, { color: colors.muted }]}>
                    {t('progress.photos', { count: progress.this_week.photos })}
                  </ThemedText>
                </View>
              </View>
              {editingGoal && (
                <View style={styles.goalOptions}>
                  <ThemedText style={[styles.goalOptionsLabel, { color: colors.muted }]}>
                    {t('progress.weeklyGoal')}
                  </ThemedText>
                  <View style={styles.goalOptionsRow}>
                    {GOAL_OPTIONS.map((n) => {
                      const isSelected = progress.weekly_goal === n;
                      return (
                        <Pressable
                          key={n}
                          style={[
                            styles.goalOption,
                            {
                              borderColor: isSelected ? colors.primary : colors.border,
                              backgroundColor: isSelected ? colors.primary + '18' : colors.background,
                              opacity: savingGoal ? 0.6 : 1,
                            },
                          ]}
                          onPress={() => handleGoalSelect(n)}
                          disabled={savingGoal}
                          accessibilityRole="button"
                          accessibilityLabel={t('onboardingGoal.perWeek', { count: n })}
                        >
                          <ThemedText style={[styles.goalOptionText, { color: isSelected ? colors.primary : colors.onSurface }]}>
                            {n}×
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* Your Streak */}
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>
                {t('progress.yourStreak')}
              </ThemedText>
              <ThemedText style={[styles.streakCount, { color: colors.onSurface }]}>
                🔥 {progress.streak.current_days === 1
                  ? t('progress.streakDay')
                  : t('progress.streakDays', { count: progress.streak.current_days })}
              </ThemedText>
              {progress.streak.frozen_today && (
                <ThemedText style={[styles.frozenLabel, { color: colors.muted }]}>
                  {t('progress.frozenToday')}
                </ThemedText>
              )}
              {progress.streak.last_days != null && progress.streak.last_days > 0 && (
                <ThemedText style={[styles.lastStreak, { color: colors.muted }]}>
                  {t('progress.lastStreak', { count: progress.streak.last_days })}
                </ThemedText>
              )}
              <ThemedText style={[styles.longestStreak, { color: colors.muted }]}>
                {t('progress.longestStreak', { count: progress.streak.longest_days })}
              </ThemedText>
            </View>

            {/* All Time */}
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>
                {t('progress.allTime')}
              </ThemedText>
              <View style={styles.allTimeGrid}>
                <View style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <ThemedText style={[styles.statCardValue, { color: colors.onSurface }]}>
                    {progress.all_time.activities}
                  </ThemedText>
                  <ThemedText style={[styles.statCardLabel, { color: colors.muted }]}>
                    {t('progress.activities', { count: progress.all_time.activities })}
                  </ThemedText>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <ThemedText style={[styles.statCardValue, { color: colors.onSurface }]}>
                    {progress.all_time.photos}
                  </ThemedText>
                  <ThemedText style={[styles.statCardLabel, { color: colors.muted }]}>
                    {t('progress.photos', { count: progress.all_time.photos })}
                  </ThemedText>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <ThemedText style={[styles.statCardValue, { color: colors.onSurface }]}>
                    {progress.all_time.challenges}
                  </ThemedText>
                  <ThemedText style={[styles.statCardLabel, { color: colors.muted }]}>
                    {t('progress.challenges', { count: progress.all_time.challenges })}
                  </ThemedText>
                </View>
              </View>
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.screenHorizontal, paddingVertical: Spacing.md, borderBottomWidth: 0.5 },
  headerTitle: { flex: 1 },
  content: { padding: Spacing.screenHorizontal, gap: Spacing.lg, paddingTop: Spacing.lg },
  section: { borderRadius: DEFAULT_RADII.card, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  editGoalButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editGoalLabel: { fontSize: 12, fontWeight: '600' },
  goalOptions: { gap: Spacing.xs, paddingTop: Spacing.sm },
  goalOptionsLabel: { fontSize: 12 },
  goalOptionsRow: { flexDirection: 'row', gap: Spacing.sm },
  goalOption: { flex: 1, height: 44, borderWidth: 1.5, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  goalOptionText: { fontSize: 16, fontWeight: '600' },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.sm },
  weekStats: { flex: 1, gap: 6, justifyContent: 'center' },
  statValue: { fontSize: 15 },
  streakCount: { fontSize: 32, fontWeight: '700' },
  frozenLabel: { fontSize: 13 },
  lastStreak: { fontSize: 13 },
  longestStreak: { fontSize: 13 },
  allTimeGrid: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, borderRadius: DEFAULT_RADII.card, borderWidth: 1, padding: Spacing.sm, alignItems: 'center', gap: 2 },
  statCardValue: { fontSize: 24, fontWeight: '700' },
  statCardLabel: { fontSize: 11, textAlign: 'center' },
});
