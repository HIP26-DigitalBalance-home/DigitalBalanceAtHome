import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { timeSpentApi, type TimeSpentInsight, type TimeSpentPeriod } from '@/lib/api';
import { elapsedDayCount, formatMinutes, isCurrentOrFuturePeriod, localDateString, parseLocalDate, shiftPeriod } from '@/lib/time-spent-utils';
import { getGermanErrorMessage } from '@/lib/utils/api-error';

const CHART_HEIGHT = 140;
// Same semantic scale as the journal mood chart (top "super" green), not themed
const BAR_COLOR = '#4C9F5A';

export function TimeSpentChart() {
  const { colors, radii } = useAppTheme();
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<TimeSpentPeriod>('weekly');
  const [anchor, setAnchor] = useState(localDateString());
  const [insight, setInsight] = useState<TimeSpentInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    timeSpentApi.getInsight(period, anchor)
      .then((response) => { if (!cancelled) setInsight(response.data); })
      .catch((reason) => { if (!cancelled) setError(getGermanErrorMessage(reason)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period, anchor, reload]);

  // Bars are regenerated per period/anchor, so a stale selection would point at nothing
  useEffect(() => { setSelectedKey(null); }, [period, anchor]);

  const bars = useMemo(() => {
    if (!insight) return [];
    if (period === 'weekly') {
      return insight.daily_totals.map((item) => ({
        key: item.date,
        label: parseLocalDate(item.date).toLocaleDateString(i18n.language, { weekday: 'short' }),
        accessibleLabel: t('timeSpent.dailyBar', {
          date: parseLocalDate(item.date).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }),
          value: formatMinutes(item.total_minutes, i18n.language),
        }),
        minutes: item.total_minutes,
      }));
    }
    // Monthly bars show the average time per day within each calendar week. The server
    // always returns every week in the month (even ones still partly or fully in the
    // future), so divide only by days that have actually happened to avoid diluting
    // the average with not-yet-elapsed days — a future bucket then correctly shows 0.
    return insight.weekly_totals.map((item, index) => {
      const days = elapsedDayCount(item.start_date, item.end_date, insight.elapsed_end);
      const average = days > 0 ? Math.round(item.total_minutes / days) : 0;
      return {
        key: item.start_date,
        label: `${index + 1}`,
        accessibleLabel: t('timeSpent.weeklyBar', {
          start: parseLocalDate(item.start_date).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }),
          end: parseLocalDate(item.end_date).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }),
          value: formatMinutes(average, i18n.language),
        }),
        minutes: average,
      };
    });
  }, [insight, period, i18n.language, t]);

  const selectedBar = useMemo(() => bars.find((bar) => bar.key === selectedKey) ?? null, [bars, selectedKey]);

  const monthAveragePerDay = useMemo(() => {
    if (!insight || period !== 'monthly') return null;
    const total = insight.weekly_totals.reduce((sum, item) => sum + item.total_minutes, 0);
    if (total === 0) return null;
    const days = elapsedDayCount(insight.range_start, insight.range_end, insight.elapsed_end);
    return days > 0 ? Math.round(total / days) : null;
  }, [insight, period]);

  const maxMinutes = Math.max(1, ...bars.map((bar) => bar.minutes));
  const rangeLabel = insight
    ? period === 'monthly'
      ? parseLocalDate(insight.range_start).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
      : `${parseLocalDate(insight.range_start).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })} – ${parseLocalDate(insight.range_end).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}`
    : '';
  const noData = bars.every((bar) => bar.minutes === 0);
  const atCurrentPeriod = isCurrentOrFuturePeriod(anchor, period);

  function changePeriod(next: TimeSpentPeriod) {
    setPeriod(next);
    setAnchor(localDateString());
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card }]}>
      <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>{t('timeSpent.sectionLabel')}</ThemedText>
      <View style={[styles.segment, { backgroundColor: colors.border + '55' }]}>
        {(['weekly', 'monthly'] as const).map((option) => {
          const selected = option === period;
          return (
            <Pressable
              key={option}
              onPress={() => changePeriod(option)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.segmentButton, selected && { backgroundColor: colors.surface }]}
            >
              <ThemedText
                style={[
                  styles.segmentLabel,
                  { color: selected ? colors.onSurface : colors.muted, fontWeight: selected ? '700' : '600' },
                ]}
              >
                {t(`timeSpent.${option}`)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.weekNav}>
        <Pressable onPress={() => setAnchor((value) => shiftPeriod(value, period, -1))} accessibilityRole="button" accessibilityLabel={t('timeSpent.previousPeriod')} hitSlop={8}>
          <ThemedText style={[styles.weekNavArrow, { color: colors.primary }]}>‹</ThemedText>
        </Pressable>
        <ThemedText style={[styles.weekNavLabel, { color: colors.muted }]} numberOfLines={1} ellipsizeMode="tail">
          {rangeLabel}
        </ThemedText>
        <Pressable disabled={atCurrentPeriod} onPress={() => setAnchor((value) => shiftPeriod(value, period, 1))} accessibilityRole="button" accessibilityLabel={t('timeSpent.nextPeriod')} accessibilityState={{ disabled: atCurrentPeriod }} hitSlop={8}>
          <ThemedText style={[styles.weekNavArrow, { color: atCurrentPeriod ? colors.border : colors.primary }]}>›</ThemedText>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : error ? (
        <View style={styles.messageBlock}>
          <ThemedText style={{ color: colors.muted, textAlign: 'center' }}>{error}</ThemedText>
          <Pressable onPress={() => setReload((value) => value + 1)} accessibilityRole="button">
            <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>{t('common.retry')}</ThemedText>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[styles.chart, { borderTopColor: colors.border }]}>
            {bars.map((bar, index) => {
              const barHeight = bar.minutes > 0 ? Math.max(4, (bar.minutes / maxMinutes) * CHART_HEIGHT) : 0;
              const selected = selectedKey === bar.key;
              return (
                <Pressable
                  key={bar.key}
                  onPress={() => setSelectedKey((current) => (current === bar.key ? null : bar.key))}
                  style={[
                    styles.chartColumn,
                    index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
                    selected && { backgroundColor: colors.primary + '14' },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={bar.accessibleLabel}
                  accessibilityState={{ selected }}
                >
                  <ThemedText style={[styles.chartDayLabel, { color: selected ? colors.primary : colors.muted }]}>
                    {bar.label}
                  </ThemedText>
                  <View style={styles.chartBarArea}>
                    {bar.minutes > 0 && (
                      <View style={[styles.chartBar, { height: barHeight, backgroundColor: BAR_COLOR }]} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {selectedBar && (
            <ThemedText style={[styles.selectedDetail, { color: colors.onSurface }]}>
              {selectedBar.accessibleLabel}
            </ThemedText>
          )}
          {monthAveragePerDay != null && (
            <ThemedText style={[styles.average, { color: colors.onSurface }]}>
              {t('timeSpent.averagePerDay', { value: formatMinutes(monthAveragePerDay, i18n.language) })}
            </ThemedText>
          )}
          {noData && <ThemedText style={[styles.empty, { color: colors.muted }]}>{t('timeSpent.empty')}</ThemedText>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: Spacing.md, gap: Spacing.md },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segmentButton: { flex: 1, minHeight: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segmentLabel: { fontSize: 14 },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  weekNavArrow: { fontSize: 24, fontWeight: '600', lineHeight: 26, paddingHorizontal: Spacing.xs },
  weekNavLabel: { fontSize: 13, fontVariant: ['tabular-nums'], flexShrink: 1, minWidth: 0 },
  loading: { height: CHART_HEIGHT + 28 },
  messageBlock: { minHeight: CHART_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  chart: { flexDirection: 'row', borderTopWidth: 1, paddingTop: Spacing.sm },
  chartColumn: { flex: 1, alignItems: 'center', gap: Spacing.xs },
  chartDayLabel: { fontSize: 12, fontWeight: '600' },
  chartBarArea: { height: CHART_HEIGHT, justifyContent: 'flex-end', alignItems: 'center' },
  chartBar: { width: 16, borderRadius: 5 },
  selectedDetail: { textAlign: 'center', fontSize: 13, fontWeight: '600' },
  average: { textAlign: 'center', fontWeight: '600' },
  empty: { textAlign: 'center', fontSize: 13 },
});
