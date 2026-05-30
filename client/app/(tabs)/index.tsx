import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollageGrid } from '@/components/collage-grid';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { activitiesApi, challengesApi, onboardingApi, type ActivityItem, type ChallengeWithProgress } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CITY_KEY = '@dba_city_preference';

function pickSuggestionFromChallenges(challenges: ChallengeWithProgress[]): ActivityItem | null {
  const unfulfilled = challenges.flatMap((c) =>
    c.activities.filter((slot) => slot.completion == null).map((slot) => slot.activity)
  );
  if (unfulfilled.length === 0) return null;
  return unfulfilled[Math.floor(Math.random() * unfulfilled.length)];
}

export default function HomeScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [fallbackSuggestion, setFallbackSuggestion] = useState<ActivityItem | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadChallenges() {
      try {
        const res = await challengesApi.getActive();
        if (!cancelled) setChallenges(res.data);
      } catch {
        // empty list on error
      } finally {
        if (!cancelled) setLoadingChallenges(false);
      }
    }

    loadChallenges();
    return () => { cancelled = true; };
  }, []);

  // Load fallback suggestion only when challenges are loaded and all slots are filled
  useEffect(() => {
    if (loadingChallenges) return;
    const challengeSuggestion = pickSuggestionFromChallenges(challenges);
    if (challengeSuggestion) return; // have one from challenges; no need to fetch

    let cancelled = false;
    async function loadFallbackSuggestion() {
      try {
        const childrenRes = await onboardingApi.getChildren();
        const firstChild = childrenRes.data[0];
        const city = await AsyncStorage.getItem(CITY_KEY);
        const res = await activitiesApi.suggestion(firstChild?.id, city);
        if (!cancelled) setFallbackSuggestion(res.data);
      } catch {
        // best-effort; silent failure is fine
      }
    }
    loadFallbackSuggestion();
    return () => { cancelled = true; };
  }, [loadingChallenges, challenges]);

  // Derive suggestion: prefer an uncompleted slot from active challenges
  const suggestion = useMemo(
    () => pickSuggestionFromChallenges(challenges) ?? fallbackSuggestion,
    [challenges, fallbackSuggestion]
  );

  function openActivity(activity: ActivityItem) {
    router.push({ pathname: '/activity/[id]', params: { id: activity.id, data: JSON.stringify(activity) } } as any);
  }

  function openSlot(slot: any) {
    openActivity(slot.activity);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <ThemedText type="title">DigitalBalance @home</ThemedText>
          <Pressable onPress={() => router.push('/challenges' as any)}>
            <ThemedText style={{ color: colors.primary, fontSize: 14 }}>All challenges</ThemedText>
          </Pressable>
        </View>

        {/* Active challenge collages */}
        {loadingChallenges ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>YOUR COLLAGES</ThemedText>
            <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.md }} />
          </View>
        ) : challenges.length > 0 ? (
          challenges.map((challenge) => (
            <View key={challenge.id} style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>ACTIVE CHALLENGE</ThemedText>
                <Pressable onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: challenge.id } } as any)}>
                  <ThemedText style={{ color: colors.primary, fontSize: 13 }}>View details</ThemedText>
                </Pressable>
              </View>
              <ThemedText style={[styles.challengeTitle, { color: colors.onSurface }]}>{challenge.title}</ThemedText>
              <ThemedText style={[styles.challengeDates, { color: colors.muted }]}>
                {challenge.start_date} → {challenge.end_date}
              </ThemedText>
              <CollageGrid
                slots={challenge.activities}
                groupFamiliesCount={challenge.group_families_count}
                onSlotPress={openSlot}
              />
            </View>
          ))
        ) : (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>YOUR COLLAGES</ThemedText>
            <View style={styles.emptyChallenge}>
              <ThemedText style={[styles.emptyText, { color: colors.muted }]}>No active challenge yet.</ThemedText>
              <Pressable
                style={[styles.createButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/create-challenge' as any)}
              >
                <ThemedText style={[styles.createButtonText, { color: colors.buttonText }]}>Create one →</ThemedText>
              </Pressable>
            </View>
          </View>
        )}

        {/* Suggestion card */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>TODAY'S SUGGESTION</ThemedText>
          {loadingChallenges ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.md }} />
          ) : suggestion ? (
            <>
              <ThemedText style={styles.suggestionTitle}>{suggestion.title}</ThemedText>
              <ThemedText style={[styles.suggestionMeta, { color: colors.muted }]}>
                ⏱ {suggestion.estimated_duration_minutes} min ·{' '}
                {suggestion.cost_indicator === 'free' ? 'Free' : 'Low cost'}
              </ThemedText>
              <Pressable
                style={[styles.ctaButton, { backgroundColor: colors.primary }]}
                onPress={() => openActivity(suggestion)}
              >
                <ThemedText style={[styles.ctaText, { color: colors.buttonText }]}>Let's do it →</ThemedText>
              </Pressable>
            </>
          ) : (
            <ThemedText style={{ color: colors.muted, fontSize: 14 }}>
              No suggestion available right now.
            </ThemedText>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.screenHorizontal, gap: Spacing.lg, paddingTop: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { borderRadius: 16, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  challengeTitle: { fontSize: 16, fontWeight: '600' },
  challengeDates: { fontSize: 12, marginBottom: Spacing.xs },
  emptyChallenge: { gap: Spacing.md, alignItems: 'flex-start' },
  emptyText: { fontSize: 14 },
  createButton: { height: 40, paddingHorizontal: Spacing.lg, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  createButtonText: { fontSize: 14, fontWeight: '600' },
  suggestionTitle: { fontSize: 17, fontWeight: '600', lineHeight: 24 },
  suggestionMeta: { fontSize: 13 },
  ctaButton: { height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs },
  ctaText: { fontSize: 15, fontWeight: '600' },
});
