import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Illustration, type IllustrationName } from '@/components/ui/illustration';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import {
  activitiesApi,
  collagePresetsApi,
  completionsApi,
  type ActivityItem,
  type CollagePreset,
} from '@/lib/api';
import { PRESET_SUGGEST_ILLUSTRATIONS } from '@/lib/preset-illustrations';

const CARD_WIDTH = 168;

/**
 * A single suggestion: one activity that belongs to a predefined bingo card
 * (a collage preset / "challenge topic"). Tapping opens the topic's 3×3 grid.
 */
interface Suggestion {
  preset: CollagePreset;
  activity: ActivityItem;
  illustration: IllustrationName;
}

/**
 * Home carousel of today's activity suggestions.
 *
 * Each card surfaces one activity drawn from a predefined bingo card (collage
 * preset). The featured activity rotates daily so the row feels fresh without a
 * dedicated endpoint. Tapping a card opens that topic's locked 3×3 grid, where
 * the parent can see every activity in the bingo card and start the collage.
 */
export function ActivitySuggestionsRow() {
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  const [suggestions, setSuggestions] = useState<Suggestion[] | undefined>();

  // Refetch whenever Home regains focus so an activity the family just completed
  // stops being suggested without an app restart. The current cards stay visible
  // during the refetch — only the very first load shows the skeleton.
  useFocusEffect(useCallback(() => {
    let cancelled = false;

    Promise.all([
      collagePresetsApi.list(),
      activitiesApi.list({}),
      // Completed activities should never be suggested again. A history fetch
      // failure must not hide the whole section, so fall back to "nothing done".
      completionsApi
        .getMyHistory(200)
        .then((r) => r.data)
        .catch(() => []),
    ])
      .then(([presetsRes, activitiesRes, history]) => {
        if (cancelled) return;
        const byId = new Map(activitiesRes.data.map((a) => [a.id, a]));
        const completedIds = new Set(history.map((h) => h.activity_id));
        // Rotate which activity each preset features by the day, so the same
        // topic suggests something different tomorrow.
        const dayIndex = Math.floor(Date.now() / 86_400_000);
        const built = presetsRes.data
          .map<Suggestion | null>((preset) => {
            const ids = preset.activity_ids;
            if (ids.length === 0) return null;
            // Walk the preset from today's rotation offset and surface the first
            // activity the family hasn't completed yet. If every activity is
            // done, the topic has nothing new to suggest — skip its card.
            for (let i = 0; i < ids.length; i++) {
              const activity = byId.get(ids[(dayIndex + i) % ids.length]);
              if (activity && !completedIds.has(activity.id)) {
                return {
                  preset,
                  activity,
                  illustration:
                    PRESET_SUGGEST_ILLUSTRATIONS[preset.name] ?? 'suggest-creative',
                };
              }
            }
            return null;
          })
          .filter((s): s is Suggestion => s !== null);
        setSuggestions(built);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [i18n.language]));

  // Hide the whole section if nothing resolved — never leave a broken heading.
  if (suggestions !== undefined && suggestions.length === 0) return null;

  const loading = suggestions === undefined;

  function openTopic(suggestion: Suggestion) {
    router.push({
      pathname: '/collage-builder',
      params: { mode: 'preset', preset: JSON.stringify(suggestion.preset) },
    } as any);
  }

  return (
    <View style={styles.wrapper}>
      <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>
        {t('home.todaysSuggestions')}
      </ThemedText>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
              <Skeleton
                key={i}
                width={CARD_WIDTH}
                height={160}
                borderRadius={DEFAULT_RADII.card}
              />
            ))
          : suggestions.map((suggestion) => (
              <PressableScale
                key={suggestion.preset.id}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => openTopic(suggestion)}
                accessibilityRole="button"
                accessibilityLabel={`${suggestion.preset.name}: ${suggestion.activity.title}`}
              >
                <View style={styles.illustrationRow}>
                  <Illustration name={suggestion.illustration} size={64} />
                </View>
                <ThemedText
                  style={[styles.cardEyebrow, { color: colors.primary }]}
                  numberOfLines={1}
                >
                  {suggestion.preset.name}
                </ThemedText>
                <ThemedText
                  style={[styles.cardTitle, { color: colors.onSurface }]}
                  numberOfLines={2}
                >
                  {suggestion.activity.title}
                </ThemedText>
                <ThemedText
                  style={[styles.cardMeta, { color: colors.muted }]}
                  numberOfLines={1}
                >
                  {t('common.minutes', {
                    count: suggestion.activity.estimated_duration_minutes,
                  })}
                  {' · '}
                  {suggestion.activity.cost_indicator === 'free'
                    ? t('cost.free')
                    : t('cost.lowCost')}
                </ThemedText>
              </PressableScale>
            ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.sm },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  // Bleed past the hero's horizontal padding so cards run to the screen edges
  // and peek beyond it, matching the discover-style carousel.
  scroll: { marginHorizontal: -Spacing.screenHorizontal },
  scrollContent: {
    paddingHorizontal: Spacing.screenHorizontal,
    gap: Spacing.sm,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 4,
  },
  illustrationRow: { height: 64, justifyContent: 'center', marginBottom: 4 },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  cardMeta: { fontSize: 11, lineHeight: 15, marginTop: 2 },
});
