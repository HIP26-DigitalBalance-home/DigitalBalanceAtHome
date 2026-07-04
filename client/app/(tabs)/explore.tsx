import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ui/error-state';
import { Illustration, type IllustrationName } from '@/components/ui/illustration';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { StampFrame } from '@/components/ui/stamp-frame';
import { ThemedText } from '@/components/themed-text';
import { fadeIn } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { tabScreenPaddingBottom } from '@/constants/nav';
import { useAppTheme } from '@/lib/app-theme-context';
import { collagePresetsApi, type CollagePreset } from '@/lib/api';
import { PRESET_ILLUSTRATIONS } from '@/lib/preset-illustrations';
import { getGermanErrorMessage } from '@/lib/utils/api-error';

// Cards rendered locally, always shown (even on network failure). They are never
// returned by the API. `kind` drives navigation into the collage builder.
type ExploreCard =
  | { kind: 'custom' }
  | { kind: 'random' }
  | { kind: 'preset'; preset: CollagePreset };

const LOCAL_CARDS: ExploreCard[] = [{ kind: 'custom' }, { kind: 'random' }];

export default function ExploreScreen() {
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  function cardCopy(card: ExploreCard): { name: string; description: string; illustration: IllustrationName } {
    if (card.kind === 'custom') {
      return { name: t('explore.customName'), description: t('explore.customDesc'), illustration: 'stamp-custom' };
    }
    if (card.kind === 'random') {
      return { name: t('explore.randomName'), description: t('explore.randomDesc'), illustration: 'stamp-random' };
    }
    return {
      name: card.preset.name,
      description: card.preset.description,
      illustration: PRESET_ILLUSTRATIONS[card.preset.name] ?? 'stamp-custom',
    };
  }

  const [presets, setPresets] = useState<CollagePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPresets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await collagePresetsApi.list();
      setPresets(res.data);
    } catch (e) {
      setError(getGermanErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await collagePresetsApi.list();
        if (!cancelled) setPresets(res.data);
      } catch (e) {
        if (!cancelled) setError(getGermanErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [i18n.language]);

  function openBuilder(card: ExploreCard) {
    if (card.kind === 'preset') {
      router.push({
        pathname: '/collage-builder',
        params: { mode: 'preset', preset: JSON.stringify(card.preset) },
      } as any);
    } else {
      router.push({ pathname: '/collage-builder', params: { mode: card.kind } } as any);
    }
  }

  const data: ExploreCard[] = [...LOCAL_CARDS, ...presets.map((preset) => ({ kind: 'preset' as const, preset }))];

  function renderCard({ item }: { item: ExploreCard }) {
    const { name, illustration } = cardCopy(item);
    return (
      <PressableScale
        style={styles.card}
        onPress={() => openBuilder(item)}
        accessibilityRole="button"
        accessibilityLabel={`${name} – Collage starten`}
      >
        <StampFrame
          fill={colors.surface}
          stroke={colors.border}
          style={styles.stamp}
          contentStyle={styles.stampContent}
        >
          <Illustration name={illustration} size={72} />
          <ThemedText style={[styles.cardTitle, { color: colors.onSurface }]} numberOfLines={3}>
            {name}
          </ThemedText>
        </StampFrame>
      </PressableScale>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText type="title" style={styles.title}>{t('explore.headerTitle')}</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
          {t('explore.subtitle')}
        </ThemedText>
      </View>

      {loading ? (
        <View style={styles.gridContent}>
          <View style={styles.skeletonRow}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} width="48%" height={150} borderRadius={16} style={{ marginBottom: Spacing.md }} />
            ))}
          </View>
        </View>
      ) : (
        <Animated.View entering={fadeIn()} style={{ flex: 1 }}>
          <FlatList
            data={data}
            keyExtractor={(item, i) => (item.kind === 'preset' ? item.preset.id : `${item.kind}-${i}`)}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={[styles.gridContent, { paddingBottom: tabScreenPaddingBottom(insets.bottom) }]}
            renderItem={renderCard}
            ListFooterComponent={
              error ? (
                <View style={styles.errorFooter}>
                  <ErrorState message={error} onRetry={fetchPresets} />
                </View>
              ) : null
            }
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.screenHorizontal, paddingVertical: Spacing.md, borderBottomWidth: 1, gap: 4 },
  title: { fontSize: 28 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  gridContent: { padding: Spacing.md },
  row: { justifyContent: 'space-between' },
  skeletonRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%',
    aspectRatio: 4 / 5,
    marginBottom: Spacing.md,
  },
  stamp: { flex: 1 },
  stampContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  cardTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  errorFooter: { paddingVertical: Spacing.lg },
});
