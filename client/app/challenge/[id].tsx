import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollageGrid } from '@/components/collage-grid';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { challengesApi, type ChallengeActivitySlot, type ChallengeWithProgress } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  active: '#4CAF82',
  upcoming: '#F4845F',
  completed: '#78716C',
};

export default function ChallengeDetailScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { id } = useLocalSearchParams<{ id: string }>();
  const [challenge, setChallenge] = useState<ChallengeWithProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    challengesApi.getById(id)
      .then((r) => { if (!cancelled) setChallenge(r.data); })
      .catch(() => { if (!cancelled) setError('Could not load challenge.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  function openSlot(slot: ChallengeActivitySlot) {
    router.push({ pathname: '/activity/[id]', params: { id: slot.activity.id, data: JSON.stringify(slot.activity) } } as any);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}>
          <ThemedText style={{ color: colors.primary }}>← Back</ThemedText>
        </Pressable>
        <ThemedText style={styles.headerTitle}>Challenge</ThemedText>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText style={{ color: colors.destructive }}>{error}</ThemedText>
          <Pressable onPress={() => router.back()}>
            <ThemedText style={{ color: colors.primary }}>Go back</ThemedText>
          </Pressable>
        </View>
      ) : challenge ? (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Title + status */}
          <View style={styles.titleRow}>
            <ThemedText type="title" style={{ flex: 1 }}>{challenge.title}</ThemedText>
            <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[challenge.status] ?? colors.muted) + '22' }]}>
              <ThemedText style={[styles.statusText, { color: STATUS_COLORS[challenge.status] ?? colors.muted }]}>
                {challenge.status}
              </ThemedText>
            </View>
          </View>

          <ThemedText style={[styles.dates, { color: colors.muted }]}>
            {challenge.start_date} → {challenge.end_date}
          </ThemedText>

          {challenge.description ? (
            <ThemedText style={[styles.description, { color: colors.onSurface }]}>{challenge.description}</ThemedText>
          ) : null}

          {/* Collage grid */}
          <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>YOUR COLLAGE</ThemedText>
          <CollageGrid
            slots={challenge.activities}
            groupFamiliesCount={challenge.group_families_count}
            onSlotPress={openSlot}
          />

          {/* Group progress summary */}
          {challenge.group_families_count != null && (
            <View style={[styles.progressBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>GROUP PROGRESS</ThemedText>
              <ThemedText style={{ color: colors.muted, fontSize: 13 }}>
                {challenge.group_families_count} {challenge.group_families_count === 1 ? 'family' : 'families'} in this group.
                Completion counts shown on each slot.
              </ThemedText>
              <View style={styles.activityList}>
                {challenge.activities.map((slot) => (
                  <View key={slot.id} style={styles.activityProgressRow}>
                    <ThemedText style={[styles.activityProgressTitle, { color: colors.onSurface }]} numberOfLines={1}>
                      {slot.activity.title}
                    </ThemedText>
                    <ThemedText style={[styles.activityProgressCount, { color: colors.accent }]}>
                      {slot.families_completed_count ?? 0}/{challenge.group_families_count}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      ) : null}
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
  headerTitle: { fontSize: 17, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  content: { padding: Spacing.screenHorizontal, gap: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  dates: { fontSize: 13, marginTop: -Spacing.sm },
  description: { fontSize: 15, lineHeight: 22 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  progressBox: { borderRadius: 12, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  activityList: { gap: Spacing.xs },
  activityProgressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  activityProgressTitle: { flex: 1, fontSize: 13 },
  activityProgressCount: { fontSize: 13, fontWeight: '600' },
});
