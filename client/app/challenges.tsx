import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ui/error-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import { challengesApi, type ChallengeSummary } from '@/lib/api';
import { getGermanErrorMessage } from '@/lib/utils/api-error';

type StatusFilter = 'upcoming' | 'active' | 'completed' | undefined;

export default function ChallengesScreen() {
  const { colors, radii } = useAppTheme();
  const statusColor = (s: string) =>
    s === 'active' ? colors.accent : s === 'upcoming' ? colors.primary : colors.muted;
  const { t } = useTranslation();
  const [challenges, setChallenges] = useState<ChallengeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>(undefined);

  const STATUS_CHIPS: { label: string; value: StatusFilter }[] = [
    { label: t('common.all'), value: undefined },
    { label: t('status.active'), value: 'active' },
    { label: t('status.upcoming'), value: 'upcoming' },
    { label: t('status.completed'), value: 'completed' },
  ];
  const statusLabels: Record<string, string> = {
    active: t('status.active'),
    upcoming: t('status.upcoming'),
    completed: t('status.completed'),
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await challengesApi.getMy(filter);
      setChallenges(res.data);
    } catch (e) {
      setError(getGermanErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary }}>← {t('common.back')}</ThemedText>
        </Pressable>
        <ThemedText style={styles.title}>{t('challengesList.title')}</ThemedText>
        <Pressable onPress={() => router.push('/(tabs)/explore' as any)}>
          <ThemedText style={{ color: colors.primary }}>{t('challengesList.new')}</ThemedText>
        </Pressable>
      </View>

      {/* Filter chips */}
      <View style={styles.chipsRow}>
        {STATUS_CHIPS.map((chip) => (
          <Pressable
            key={String(chip.value)}
            style={[
              styles.chip,
              { backgroundColor: filter === chip.value ? colors.primary : colors.surface, borderColor: filter === chip.value ? colors.primary : colors.border },
            ]}
            onPress={() => setFilter(chip.value)}
          >
            <ThemedText style={[styles.chipText, { color: filter === chip.value ? colors.buttonText : colors.onSurface }]}>
              {chip.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.skeletonContainer}><SkeletonList count={4} rowHeight={80} /></View>
      ) : error ? (
        <View style={styles.center}><ErrorState message={error} onRetry={load} /></View>
      ) : (
        <FlatList
          data={challenges}
          keyExtractor={(c) => c.id}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <ThemedText style={{ color: colors.muted }}>{t('challengesList.noneFound')}</ThemedText>
              <Pressable
                style={[styles.createBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/(tabs)/explore' as any)}
              >
                <ThemedText style={{ color: colors.buttonText, fontWeight: '600' }}>{t('challengesList.createOne')}</ThemedText>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: item.id } } as any)}
            >
              <View style={styles.cardTop}>
                <ThemedText style={[styles.cardTitle, { color: colors.onSurface }]}>{item.title}</ThemedText>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '22' }]}>
                  <ThemedText style={[styles.statusText, { color: statusColor(item.status) }]}>
                    {statusLabels[item.status] ?? item.status}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={[styles.dates, { color: colors.muted }]}>
                {item.start_date} → {item.end_date}
              </ThemedText>
              {item.description ? (
                <ThemedText style={[styles.desc, { color: colors.muted }]} numberOfLines={2}>
                  {item.description}
                </ThemedText>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  title: { fontSize: 17, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.screenHorizontal, paddingVertical: Spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, minHeight: 44, justifyContent: 'center' },
  backButton: { minHeight: 44, justifyContent: 'center' },
  skeletonContainer: { flex: 1, padding: Spacing.screenHorizontal },
  chipText: { fontSize: 13, fontWeight: '500' },
  list: { padding: Spacing.screenHorizontal, gap: Spacing.sm },
  card: { borderRadius: DEFAULT_RADII.card, borderWidth: 1, padding: Spacing.md, gap: Spacing.xs },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
  statusBadge: { borderRadius: DEFAULT_RADII.sm, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  dates: { fontSize: 12 },
  desc: { fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  createBtn: { height: 44, paddingHorizontal: Spacing.xl, borderRadius: DEFAULT_RADII.button, alignItems: 'center', justifyContent: 'center' },
});
