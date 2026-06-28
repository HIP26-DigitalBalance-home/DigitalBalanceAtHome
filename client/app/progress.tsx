import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressRing } from '@/components/progress-ring';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { tabScreenPaddingBottom } from '@/constants/nav';
import { useAppTheme } from '@/lib/app-theme-context';
import { onboardingApi, progressApi, type FamilyProgress } from '@/lib/api';
import { getGermanErrorMessage } from '@/lib/utils/api-error';

export default function ProgressScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [progress, setProgress] = useState<FamilyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const familiesRes = await onboardingApi.getMyFamilies();
        const fid = familiesRes.data[0]?.id;
        if (!fid) return;
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
          <>
            {/* This Week */}
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>
                {t('progress.thisWeek')}
              </ThemedText>
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
            </View>

            {/* Your Streak */}
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>
                {t('progress.yourStreak')}
              </ThemedText>
              <ThemedText style={[styles.streakCount, { color: colors.onSurface }]}>
                🔥 {progress.streak.current_weeks === 1
                  ? t('progress.streakWeek')
                  : t('progress.streakWeeks', { count: progress.streak.current_weeks })}
              </ThemedText>
              {progress.streak.frozen_this_week && (
                <ThemedText style={[styles.frozenLabel, { color: colors.muted }]}>
                  {t('progress.frozenThisWeek')}
                </ThemedText>
              )}
              {progress.streak.last_weeks != null && progress.streak.last_weeks > 0 && (
                <ThemedText style={[styles.lastStreak, { color: colors.muted }]}>
                  {t('progress.lastStreak', { count: progress.streak.last_weeks })}
                </ThemedText>
              )}
              <ThemedText style={[styles.longestStreak, { color: colors.muted }]}>
                {t('progress.longestStreak', { count: progress.streak.longest_weeks })}
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
          </>
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
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
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
