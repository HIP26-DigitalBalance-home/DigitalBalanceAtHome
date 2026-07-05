import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import { activitiesApi, type ActivityItem } from '@/lib/api';

/**
 * Home teaser for the server-selected activity of the day.
 *
 * Candidate selection deliberately lives behind `/activities/suggestions` so
 * weather, preferences, and richer ranking can be added without changing this
 * component or the home-screen contract.
 */
export function ActivitySuggestionCard() {
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  const [suggestion, setSuggestion] = useState<ActivityItem | null>();

  useEffect(() => {
    let cancelled = false;

    setSuggestion(undefined);
    activitiesApi.suggestion().then(
      ({ data }) => {
        if (!cancelled) setSuggestion(data);
      },
      () => {
        if (!cancelled) setSuggestion(null);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  if (suggestion === undefined) {
    return <Skeleton width="100%" height={76} borderRadius={DEFAULT_RADII.card} />;
  }

  const openSuggestion = suggestion
    ? () => router.push({
        pathname: '/activity/[id]',
        params: { id: suggestion.id, data: JSON.stringify(suggestion) },
      } as any)
    : undefined;

  return (
    <PressableScale
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={openSuggestion}
      disabled={!suggestion}
      accessibilityRole={suggestion ? 'button' : undefined}
      accessibilityLabel={suggestion
        ? `${t('home.todaysSuggestion')}: ${suggestion.title}`
        : t('home.noSuggestion')}
    >
      <View style={[styles.iconBubble, { backgroundColor: colors.primary + '16' }]}>
        <IconSymbol name="sparkles" size={22} color={colors.primary} />
      </View>
      <View style={styles.textBlock}>
        <ThemedText style={[styles.label, { color: colors.primary + '99' }]} numberOfLines={1}>
          {t('home.todaysSuggestion')}
        </ThemedText>
        <ThemedText style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>
          {suggestion?.title ?? t('home.noSuggestion')}
        </ThemedText>
        {suggestion && (
          <ThemedText style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
            {t('common.minutes', { count: suggestion.estimated_duration_minutes })}
            {' · '}
            {suggestion.cost_indicator === 'free' ? t('cost.free') : t('cost.lowCost')}
          </ThemedText>
        )}
      </View>
      {suggestion && <IconSymbol name="chevron.right" size={18} color={colors.muted} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1, gap: 1 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  meta: { fontSize: 11, lineHeight: 15 },
});
