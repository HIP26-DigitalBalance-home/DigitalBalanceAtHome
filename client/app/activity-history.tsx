import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ErrorState } from '@/components/ui/error-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';
import { MOODS, MOOD_BY_KEY } from '@/constants/journal';
import { fadeIn } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { completionsApi, journalApi } from '@/lib/api';
import { weekRange } from '@/lib/journal-utils';
import { getGermanErrorMessage } from '@/lib/utils/api-error';
import type { CompletionHistoryItem, JournalEntry } from '@/lib/api';

const PAGE_SIZE = 20;
const CHART_HEIGHT = 140;

export default function ActivityHistoryScreen() {
  const { colors, radii } = useAppTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();

  const [tab, setTab] = useState<'history' | 'analyze'>(initialTab === 'analyze' ? 'analyze' : 'history');
  const [items, setItems] = useState<CompletionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const load = useCallback(async (reset = false) => {
    if (reset) {
      offsetRef.current = 0;
      setHasMore(true);
      setError(null);
    }
    const offset = offsetRef.current;
    try {
      const res = await completionsApi.getMyHistory(PAGE_SIZE, offset);
      const page = res.data;
      setItems((prev) => (reset ? page : [...prev, ...page]));
      offsetRef.current = offset + page.length;
      if (page.length < PAGE_SIZE) setHasMore(false);
    } catch (e) {
      setError(getGermanErrorMessage(e));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [i18n.language]);

  useEffect(() => { load(true); }, [load]);

  // Mood journal data for the analyze tab
  const [weekOffset, setWeekOffset] = useState(0);
  const [moodEntries, setMoodEntries] = useState<JournalEntry[]>([]);
  const [loadingMood, setLoadingMood] = useState(true);
  const [moodError, setMoodError] = useState<string | null>(null);
  const [moodReload, setMoodReload] = useState(0);
  const week = useMemo(() => weekRange(weekOffset), [weekOffset]);

  useEffect(() => {
    if (tab !== 'analyze') return;
    let cancelled = false;
    setLoadingMood(true);
    setMoodError(null);
    journalApi
      .getEntries(week.start, week.end)
      .then((res) => { if (!cancelled) setMoodEntries(res.data); })
      .catch((e) => { if (!cancelled) setMoodError(getGermanErrorMessage(e)); })
      .finally(() => { if (!cancelled) setLoadingMood(false); });
    return () => { cancelled = true; };
  }, [tab, week, i18n.language, moodReload]);

  const entriesByDay = useMemo(() => {
    const map: Record<string, JournalEntry> = {};
    for (const e of moodEntries) map[e.entry_date] = e;
    return map;
  }, [moodEntries]);

  const weekLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
    return `${fmt(week.dates[0])} – ${fmt(week.dates[6])}`;
  }, [week, i18n.language]);

  function handleEndReached() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    load(false);
  }

  function renderItem({ item }: { item: CompletionHistoryItem }) {
    const date = new Date(item.completed_at).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    const isPhoto = item.status === 'ready' && item.photo_url;

    return (
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.thumbnail, { backgroundColor: colors.border }]}>
          {isPhoto ? (
            <Image
              source={{ uri: item.photo_url! }}
              style={styles.thumbnailImage}
              accessibilityLabel={`Photo for ${item.activity_title}`}
            />
          ) : (
            <ThemedText style={styles.checkmark}>✓</ThemedText>
          )}
        </View>
        <View style={styles.rowInfo}>
          <ThemedText style={styles.activityTitle} numberOfLines={1}>{item.activity_title}</ThemedText>
          <ThemedText style={[styles.challengeTitle, { color: colors.muted }]} numberOfLines={1}>
            {item.challenge_title}
          </ThemedText>
          <ThemedText style={[styles.date, { color: colors.muted }]}>{date}</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary, fontSize: 16 }}>← {t('common.back')}</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.title}>{t('activityHistory.title')}</ThemedText>

        <View style={[styles.segment, { backgroundColor: colors.border + '55' }]}>
          {(['history', 'analyze'] as const).map((key) => {
            const selected = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={[styles.segmentButton, selected && { backgroundColor: colors.surface }]}>
                <ThemedText
                  style={[
                    styles.segmentLabel,
                    { color: selected ? colors.onSurface : colors.muted, fontWeight: selected ? '700' : '600' },
                  ]}>
                  {t(key === 'history' ? 'activityHistory.tabHistory' : 'activityHistory.tabAnalyze')}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {tab === 'analyze' ? (
        <ScrollView contentContainerStyle={styles.analyzeContent}>
          <View style={[styles.analyzeCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card }]}>
            <View style={styles.weekNav}>
              <ThemedText style={styles.moodTitle}>{t('activityHistory.moodTitle')}</ThemedText>
              <View style={styles.weekNavControls}>
                <Pressable
                  onPress={() => setWeekOffset((w) => w - 1)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('activityHistory.previousWeek')}
                >
                  <ThemedText style={[styles.weekNavArrow, { color: colors.primary }]}>‹</ThemedText>
                </Pressable>
                <ThemedText style={[styles.weekNavLabel, { color: colors.muted }]}>{weekLabel}</ThemedText>
                <Pressable
                  onPress={() => setWeekOffset((w) => Math.min(0, w + 1))}
                  disabled={weekOffset === 0}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('activityHistory.nextWeek')}
                >
                  <ThemedText style={[styles.weekNavArrow, { color: weekOffset === 0 ? colors.border : colors.primary }]}>›</ThemedText>
                </Pressable>
              </View>
            </View>

            {loadingMood ? (
              <SkeletonList count={4} rowHeight={36} />
            ) : moodError ? (
              <ErrorState message={moodError} onRetry={() => setMoodReload((n) => n + 1)} />
            ) : (
              // gap mirrors styles.analyzeCard so the wrapper doesn't collapse spacing
              <Animated.View entering={fadeIn()} style={{ gap: Spacing.md }}>
                <View style={styles.legend}>
                  {[...MOODS].reverse().map((m) => {
                    const count = moodEntries.filter((e) => e.mood === m.key).length;
                    return (
                      <View key={m.key} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: m.color }]} />
                        <ThemedText style={[styles.legendLabel, { color: colors.onSurface }]}>{t(m.labelKey)}</ThemedText>
                        <ThemedText style={[styles.legendCount, { color: colors.muted }]}>
                          {t('activityHistory.moodDays', { count })}
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>

                <View style={[styles.chart, { borderTopColor: colors.border }]}>
                  {week.dates.map((date, i) => {
                    const entry = entriesByDay[week.days[i]];
                    const mood = entry ? MOOD_BY_KEY[entry.mood] : null;
                    return (
                      <View
                        key={week.days[i]}
                        style={[styles.chartColumn, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }]}
                      >
                        <ThemedText style={[styles.chartDayLabel, { color: colors.muted }]}>
                          {date.toLocaleDateString(i18n.language, { weekday: 'short' })}
                        </ThemedText>
                        <View style={styles.chartBarArea}>
                          {mood && (
                            <View
                              style={[styles.chartBar, { height: (mood.score / 5) * CHART_HEIGHT, backgroundColor: mood.color }]}
                            />
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>

                {moodEntries.length === 0 && (
                  <ThemedText style={[styles.moodEmpty, { color: colors.muted }]}>
                    {t('activityHistory.moodEmptyWeek')}
                  </ThemedText>
                )}
              </Animated.View>
            )}
          </View>

          <ThemedText style={[styles.moreSoon, { color: colors.muted }]}>
            {t('activityHistory.moodMoreSoon')}
          </ThemedText>
        </ScrollView>
      ) : loading ? (
        <View style={styles.skeletonContainer}><SkeletonList count={8} rowHeight={68} /></View>
      ) : error ? (
        <View style={styles.center}><ErrorState message={error} onRetry={() => load(true)} /></View>
      ) : (
        // Animated.View wraps the fade — Animated.FlatList's `entering` throws
        // (FlatList has no `children` for Reanimated's layout clone to walk).
        <Animated.View entering={fadeIn()} style={{ flex: 1 }}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              <ThemedText style={[styles.empty, { color: colors.muted }]}>
                {t('activityHistory.empty')}
              </ThemedText>
            }
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.md }} /> : null
            }
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { marginBottom: Spacing.xs, minHeight: 44, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  skeletonContainer: { flex: 1, padding: Spacing.md },
  title: { fontSize: 24 },
  segment: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginTop: Spacing.md,
  },
  segmentButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: { fontSize: 14 },
  analyzeContent: { padding: Spacing.md, gap: Spacing.md },
  analyzeCard: { borderWidth: 1, padding: Spacing.md, gap: Spacing.md },
  moodTitle: { fontSize: 22, fontWeight: '700' },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekNavControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  weekNavArrow: { fontSize: 24, fontWeight: '600', lineHeight: 26, paddingHorizontal: Spacing.xs },
  weekNavLabel: { fontSize: 13, fontVariant: ['tabular-nums'] },
  legend: { gap: Spacing.xs },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 24 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { fontSize: 14, flex: 1 },
  legendCount: { fontSize: 13, fontVariant: ['tabular-nums'] },
  chart: { flexDirection: 'row', borderTopWidth: 1, paddingTop: Spacing.sm },
  chartColumn: { flex: 1, alignItems: 'center', gap: Spacing.xs },
  chartDayLabel: { fontSize: 12, fontWeight: '600' },
  chartBarArea: { height: CHART_HEIGHT, justifyContent: 'flex-end' },
  chartBar: { width: 16, borderRadius: 5 },
  moodEmpty: { fontSize: 13, textAlign: 'center' },
  moreSoon: { fontSize: 13, textAlign: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.sm,
    gap: Spacing.md,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailImage: { width: 56, height: 56 },
  checkmark: { fontSize: 24, fontWeight: '700' },
  rowInfo: { flex: 1, gap: 2 },
  activityTitle: { fontSize: 15, fontWeight: '600' },
  challengeTitle: { fontSize: 13 },
  date: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: Spacing.xl, fontSize: 15 },
});
