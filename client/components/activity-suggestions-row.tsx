import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AnimatedModal } from '@/components/ui/animated-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
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

export const CARD_WIDTH = 168;

// Shared with the profile screen's location preference — keep the key in sync so
// a city set from either place shows up in both.
const CITY_KEY = '@dba_city_preference';

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
interface Props {
  /**
   * The article-of-the-day teaser. Its position depends on `compact`:
   * packed into the scrollable row when compact, or dropped onto its own row
   * below a fixed 2-up grid when there's vertical room to spare.
   */
  article?: ReactNode;
  /**
   * Compact packs everything into one horizontal, scrollable carousel (small
   * screens). Otherwise the row shows exactly two non-scrollable suggestions
   * and the article sits on a separate row.
   */
  compact?: boolean;
}

export function ActivitySuggestionsRow({ article, compact = false }: Props = {}) {
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  const [suggestions, setSuggestions] = useState<Suggestion[] | undefined>();

  // City preference for weather/season-aware suggestions. Stored locally (never
  // precise GPS) and shared with the profile screen via CITY_KEY.
  const [city, setCity] = useState('');
  const [editingLocation, setEditingLocation] = useState(false);
  const [draftCity, setDraftCity] = useState('');

  // Re-read the stored city whenever Home regains focus so a change made on the
  // profile screen is reflected here without an app restart.
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    AsyncStorage.getItem(CITY_KEY).then((stored) => {
      if (!cancelled) setCity(stored ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, []));

  function openLocationEditor() {
    setDraftCity(city);
    setEditingLocation(true);
  }

  function saveLocation() {
    const next = draftCity.trim();
    setCity(next);
    if (next) {
      AsyncStorage.setItem(CITY_KEY, next);
    } else {
      AsyncStorage.removeItem(CITY_KEY);
    }
    setEditingLocation(false);
  }

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

  // Hide the whole section if nothing resolved and there's no trailing card either
  // (e.g. the article teaser) — never leave a broken heading.
  if (suggestions !== undefined && suggestions.length === 0 && !article) return null;

  const loading = suggestions === undefined;

  function openTopic(suggestion: Suggestion) {
    router.push({
      pathname: '/collage-builder',
      params: { mode: 'preset', preset: JSON.stringify(suggestion.preset) },
    } as any);
  }

  function renderCard(suggestion: Suggestion, style?: object) {
    return (
      <PressableScale
        key={suggestion.preset.id}
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          style,
        ]}
        onPress={() => openTopic(suggestion)}
        accessibilityRole="button"
        accessibilityLabel={`${suggestion.preset.name}: ${suggestion.activity.title}`}
      >
        <View style={styles.illustrationRow}>
          <Illustration name={suggestion.illustration} size={44} />
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
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>
          {t('home.todaysSuggestions')}
        </ThemedText>

        <Pressable
          style={({ pressed }) => [
            styles.locationPill,
            { backgroundColor: colors.muted + '22', opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={openLocationEditor}
          accessibilityRole="button"
          accessibilityLabel={city || t('home.setLocation')}
        >
          <IconSymbol name="mappin.and.ellipse" size={13} color={colors.muted} />
          <ThemedText
            style={[styles.locationLabel, { color: city ? colors.text : colors.muted }]}
            numberOfLines={1}
          >
            {city || t('home.setLocation')}
          </ThemedText>
          <IconSymbol name="chevron.down" size={14} color={colors.muted} />
        </Pressable>
      </View>

      {compact ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          {article}
          {loading
            ? Array.from({ length: 3 }, (_, i) => (
                <Skeleton
                  key={i}
                  width={CARD_WIDTH}
                  height={132}
                  borderRadius={DEFAULT_RADII.card}
                />
              ))
            : suggestions.map((suggestion) => renderCard(suggestion))}
        </ScrollView>
      ) : (
        <>
          <View style={styles.grid}>
            {loading
              ? Array.from({ length: 2 }, (_, i) => (
                  <View key={i} style={styles.gridCell}>
                    <Skeleton width="100%" height={132} borderRadius={DEFAULT_RADII.card} />
                  </View>
                ))
              : suggestions
                  .slice(0, 2)
                  .map((suggestion) => renderCard(suggestion, styles.gridCell))}
          </View>
          {article}
        </>
      )}

      <AnimatedModal
        visible={editingLocation}
        variant="dialog"
        onRequestClose={() => setEditingLocation(false)}
        onBackdropPress={() => setEditingLocation(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={styles.modalTitle}>{t('profile.yourCity')}</ThemedText>
          <ThemedText style={[styles.modalSub, { color: colors.muted }]}>
            {t('profile.citySub')}
          </ThemedText>
          <TextInput
            style={[styles.cityInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
            placeholder={t('profile.cityPlaceholder')}
            placeholderTextColor={colors.muted}
            value={draftCity}
            onChangeText={setDraftCity}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={saveLocation}
          />
          <View style={styles.modalActions}>
            <Pressable
              style={styles.modalButton}
              onPress={() => setEditingLocation(false)}
              accessibilityRole="button"
            >
              <ThemedText style={{ color: colors.muted }}>{t('common.cancel')}</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: colors.buttonBackground }]}
              onPress={saveLocation}
              accessibilityRole="button"
            >
              <ThemedText style={{ color: colors.buttonText, fontWeight: '700' }}>
                {t('common.save')}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </AnimatedModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: 180,
  },
  locationLabel: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  modalContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalSub: { fontSize: 13, lineHeight: 18 },
  cityInput: {
    borderWidth: 1,
    borderRadius: DEFAULT_RADII.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  modalButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: DEFAULT_RADII.button,
  },
  modalButtonPrimary: { minWidth: 96, alignItems: 'center' },
  // Two fixed suggestions side by side; the article rides on its own row below.
  grid: { flexDirection: 'row', gap: Spacing.sm },
  gridCell: { flex: 1 },
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
    padding: Spacing.sm,
    gap: 2,
  },
  illustrationRow: { height: 44, justifyContent: 'center', marginBottom: 2 },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  cardMeta: { fontSize: 11, lineHeight: 15, marginTop: 2 },
});
