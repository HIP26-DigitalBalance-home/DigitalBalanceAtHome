import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { activitiesApi, type ActivityItem, type ActivityFilters } from '@/lib/api';
import { onboardingApi } from '@/lib/api';

// Derive current season from month
function currentSeason(): string {
  const m = new Date().getMonth() + 1;
  if (m <= 5 && m >= 3) return 'spring';
  if (m <= 8) return 'summer';
  if (m <= 11) return 'autumn';
  return 'winter';
}

type ChipGroup = { label: string; value: string | undefined };

const COST_CHIPS: ChipGroup[] = [
  { label: 'All', value: undefined },
  { label: 'Free', value: 'free' },
  { label: 'Low cost', value: 'low_cost' },
];

const SEASON_CHIPS: ChipGroup[] = [
  { label: 'All seasons', value: undefined },
  { label: '🌸 Spring', value: 'spring' },
  { label: '☀️ Summer', value: 'summer' },
  { label: '🍂 Autumn', value: 'autumn' },
  { label: '❄️ Winter', value: 'winter' },
];

export default function ActivitiesScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [season, setSeason] = useState<string | undefined>(currentSeason());
  const [cost, setCost] = useState<string | undefined>(undefined);
  const [childAge, setChildAge] = useState<number | undefined>(undefined);

  // Load child age on mount for age-based filtering
  useEffect(() => {
    let cancelled = false;
    onboardingApi.getChildren().then((res) => {
      if (!cancelled && res.data.length > 0) {
        const dob = new Date(res.data[0].date_of_birth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        if (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate())) age--;
        setChildAge(age);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: ActivityFilters = { season, cost };
      if (childAge !== undefined) filters.age = childAge;
      const res = await activitiesApi.list(filters);
      setActivities(res.data);
    } catch {
      setError('Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, [season, cost, childAge]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  function openActivity(item: ActivityItem) {
    router.push({ pathname: '/activity/[id]', params: { id: item.id, data: JSON.stringify(item) } } as any);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText type="title" style={styles.title}>Activities</ThemedText>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersRow}>
        {SEASON_CHIPS.map(chip => (
          <Pressable
            key={chip.label}
            style={[
              styles.chip,
              {
                backgroundColor: season === chip.value ? colors.primary : colors.surface,
                borderColor: season === chip.value ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setSeason(chip.value)}>
            <ThemedText style={[styles.chipText, { color: season === chip.value ? '#fff' : colors.onSurface }]}>
              {chip.label}
            </ThemedText>
          </Pressable>
        ))}
        <View style={styles.chipDivider} />
        {COST_CHIPS.map(chip => (
          <Pressable
            key={chip.label}
            style={[
              styles.chip,
              {
                backgroundColor: cost === chip.value ? colors.primary : colors.surface,
                borderColor: cost === chip.value ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setCost(chip.value)}>
            <ThemedText style={[styles.chipText, { color: cost === chip.value ? '#fff' : colors.onSurface }]}>
              {chip.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText style={{ color: colors.destructive }}>{error}</ThemedText>
          <Pressable onPress={fetchActivities}><ThemedText style={{ color: colors.primary }}>Retry</ThemedText></Pressable>
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={a => a.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <ThemedText style={{ color: colors.muted }}>No activities match these filters.</ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => openActivity(item)}>
              <View style={styles.cardMain}>
                <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
                <ThemedText style={[styles.cardDesc, { color: colors.muted }]} numberOfLines={2}>
                  {item.description}
                </ThemedText>
              </View>
              <View style={styles.cardMeta}>
                <ThemedText style={[styles.metaText, { color: colors.muted }]}>
                  ⏱ {item.estimated_duration_minutes} min
                </ThemedText>
                <ThemedText style={[styles.metaText, { color: item.cost_indicator === 'free' ? colors.accent : colors.primary }]}>
                  {item.cost_indicator === 'free' ? 'Free' : 'Low cost'}
                </ThemedText>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.screenHorizontal, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  title: { fontSize: 28 },
  filtersScroll: { maxHeight: 52 },
  filtersRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs, flexDirection: 'row', alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '500' },
  chipDivider: { width: 1, height: 20, backgroundColor: '#ddd', marginHorizontal: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: { borderRadius: 12, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  cardMain: { gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', gap: Spacing.md },
  metaText: { fontSize: 13 },
});
