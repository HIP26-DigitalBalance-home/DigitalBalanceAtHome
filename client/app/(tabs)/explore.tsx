import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ui/error-state';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import { collagePresetsApi, type CollagePreset } from '@/lib/api';
import { getGermanErrorMessage } from '@/lib/utils/api-error';

// Cards rendered locally, always shown (even on network failure). They are never
// returned by the API. `kind` drives navigation into the collage builder.
type ExploreCard =
  | { kind: 'custom' }
  | { kind: 'random' }
  | { kind: 'preset'; preset: CollagePreset };

const LOCAL_CARDS: ExploreCard[] = [{ kind: 'custom' }, { kind: 'random' }];

export default function ExploreScreen() {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();

  function cardCopy(card: ExploreCard): { name: string; description: string; icon: IconSymbolName | null } {
    if (card.kind === 'custom') {
      return { name: t('explore.customName'), description: t('explore.customDesc'), icon: 'sparkles' };
    }
    if (card.kind === 'random') {
      return { name: t('explore.randomName'), description: t('explore.randomDesc'), icon: 'dice.fill' };
    }
    return { name: card.preset.name, description: card.preset.description, icon: null };
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
  }, []);

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
    const { name, description, icon } = cardCopy(item);
    return (
      <Pressable
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => openBuilder(item)}
        accessibilityRole="button"
        accessibilityLabel={`${name} – Collage starten`}
      >
        {icon ? <IconSymbol name={icon} size={24} color={colors.primary} /> : null}
        <ThemedText style={[styles.cardTitle, { color: colors.onSurface }]} numberOfLines={2}>
          {name}
        </ThemedText>
        <ThemedText style={[styles.cardDesc, { color: colors.muted }]} numberOfLines={3}>
          {description}
        </ThemedText>
      </Pressable>
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
        <FlatList
          data={data}
          keyExtractor={(item, i) => (item.kind === 'preset' ? item.preset.id : `${item.kind}-${i}`)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.gridContent}
          renderItem={renderCard}
          ListFooterComponent={
            error ? (
              <View style={styles.errorFooter}>
                <ErrorState message={error} onRetry={fetchPresets} />
              </View>
            ) : null
          }
        />
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
    minHeight: 150,
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  errorFooter: { paddingVertical: Spacing.lg },
});
