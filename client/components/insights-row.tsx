import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { timeSpentApi, type TimeSpentInsight } from '@/lib/api';
import { elapsedDayCount, formatMinutes, localDateString, parseLocalDate, shiftPeriod } from '@/lib/time-spent-utils';

// A horizontally-scrollable strip of compact stat boxes derived from the
// time-spent data. Everything here is computed client-side from three insight
// fetches (this week, last week, this month) — no new backend endpoint.
type IconName = Parameters<typeof IconSymbol>[0]['name'];

interface Box {
  key: string;
  icon: IconName;
  label: string;
  value: string;
  /** Only the headline box carries a week-over-week delta. Positive only — the
   *  app never frames a decrease negatively, so we hide the chip when ≤ 0. */
  deltaPct?: number | null;
}

function sumDaily(insight: TimeSpentInsight, until?: string): number {
  return insight.daily_totals
    .filter((d) => (until ? d.date <= until : true))
    .reduce((sum, d) => sum + d.total_minutes, 0);
}

// Average minutes per day that has actually happened in the period.
function avgPerElapsedDay(insight: TimeSpentInsight): number {
  const days = elapsedDayCount(insight.range_start, insight.range_end, insight.elapsed_end);
  return days > 0 ? Math.round(sumDaily(insight, insight.elapsed_end) / days) : 0;
}

export function InsightsRow() {
  const { colors, radii } = useAppTheme();
  const { t, i18n } = useTranslation();
  const [thisWeek, setThisWeek] = useState<TimeSpentInsight | null>(null);
  const [lastWeek, setLastWeek] = useState<TimeSpentInsight | null>(null);
  const [thisMonth, setThisMonth] = useState<TimeSpentInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const today = localDateString();
    setLoading(true);
    setFailed(false);
    Promise.all([
      timeSpentApi.getInsight('weekly', today),
      timeSpentApi.getInsight('weekly', shiftPeriod(today, 'weekly', -1)),
      timeSpentApi.getInsight('monthly', today),
    ])
      .then(([w, lw, m]) => {
        if (cancelled) return;
        setThisWeek(w.data);
        setLastWeek(lw.data);
        setThisMonth(m.data);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const boxes = useMemo<Box[]>(() => {
    if (!thisWeek || !lastWeek || !thisMonth) return [];
    const lang = i18n.language;

    const weekAvg = avgPerElapsedDay(thisWeek);
    const lastAvg = avgPerElapsedDay(lastWeek);
    const deltaPct = lastAvg > 0 ? Math.round(((weekAvg - lastAvg) / lastAvg) * 100) : null;

    // Best single day so far this week.
    let best = { minutes: 0, date: '' };
    for (const d of thisWeek.daily_totals) {
      if (d.date <= thisWeek.elapsed_end && d.total_minutes > best.minutes) {
        best = { minutes: d.total_minutes, date: d.date };
      }
    }
    // Weekday goes in the label so the value stays a short, single duration.
    const bestLabel = best.minutes > 0
      ? `${t('insights.bestDay')} · ${parseLocalDate(best.date).toLocaleDateString(lang, { weekday: 'short' })}`
      : t('insights.bestDay');
    const bestValue = best.minutes > 0 ? formatMinutes(best.minutes, lang) : t('insights.noData');

    const activeDays = thisWeek.daily_totals.filter(
      (d) => d.date <= thisWeek.elapsed_end && d.total_minutes > 0
    ).length;

    return [
      { key: 'avg', icon: 'chart.line.uptrend.xyaxis', label: t('insights.avgPerDay'), value: formatMinutes(weekAvg, lang), deltaPct },
      { key: 'week', icon: 'clock.fill', label: t('insights.thisWeek'), value: formatMinutes(sumDaily(thisWeek, thisWeek.elapsed_end), lang) },
      { key: 'best', icon: 'star.fill', label: bestLabel, value: bestValue },
      { key: 'active', icon: 'heart.fill', label: t('insights.activeDays'), value: t('insights.activeDaysValue', { count: activeDays }) },
      { key: 'month', icon: 'calendar', label: t('insights.thisMonth'), value: formatMinutes(sumDaily(thisMonth, thisMonth.elapsed_end), lang) },
    ];
  }, [thisWeek, lastWeek, thisMonth, i18n.language, t]);

  // Insights are supplementary; on failure just don't render the strip.
  if (failed) return null;

  const cells: (Box | { key: string; placeholder: true })[] = loading
    ? [0, 1, 2, 3].map((i) => ({ key: `ph-${i}`, placeholder: true as const }))
    : boxes;

  if (cells.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>
        {t('insights.sectionLabel')}
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {cells.map((cell) => {
          const box = 'placeholder' in cell ? null : cell;
          return (
            <View
              key={cell.key}
              style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card }]}
            >
              {box ? (
                <>
                  <View style={styles.boxHeader}>
                    <IconSymbol name={box.icon} size={15} color={colors.primary} />
                    <ThemedText style={[styles.boxLabel, { color: colors.muted }]} numberOfLines={1}>
                      {box.label}
                    </ThemedText>
                  </View>
                  <ThemedText
                    style={[styles.boxValue, { color: colors.onSurface }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {box.value}
                  </ThemedText>
                  {box.deltaPct != null && box.deltaPct > 0 ? (
                    <View style={[styles.deltaChip, { backgroundColor: '#4C9F5A22' }]}>
                      <ThemedText style={[styles.deltaText, { color: '#3E8C4C' }]}>
                        ↑ {box.deltaPct}% {t('insights.vsLastWeek')}
                      </ThemedText>
                    </View>
                  ) : (
                    <View style={styles.deltaSpacer} />
                  )}
                </>
              ) : (
                <View style={[styles.placeholder, { backgroundColor: colors.border + '55' }]} />
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const BOX_WIDTH = 156;

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.sm },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  row: { gap: Spacing.sm, paddingRight: Spacing.xs },
  box: { width: BOX_WIDTH, borderWidth: 1, padding: Spacing.md, gap: 6, justifyContent: 'flex-start' },
  boxHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  boxLabel: { fontSize: 11, fontWeight: '600', flexShrink: 1 },
  boxValue: { fontSize: 20, fontWeight: '700' },
  deltaChip: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  deltaText: { fontSize: 11, fontWeight: '700' },
  deltaSpacer: { height: 23 },
  placeholder: { flex: 1, minHeight: 60, borderRadius: 8 },
});
