import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollageGrid, type LocalCompletion } from '@/components/collage-grid';
import { CompleteActivityModal } from '@/components/complete-activity-modal';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  activitiesApi,
  challengesApi,
  completionsApi,
  onboardingApi,
  photosApi,
  type ActivityItem,
  type ChallengeActivitySlot,
  type ChallengeWithProgress,
} from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CITY_KEY = '@dba_city_preference';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

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

  // Optimistic completion state: challenge_activity_id → LocalCompletion
  const [localCompletions, setLocalCompletions] = useState<Record<string, LocalCompletion>>({});
  const [activeSlot, setActiveSlot] = useState<ChallengeActivitySlot | null>(null);

  // Polling: slotId → { completionId, intervalId, timeoutId }
  const pollingRef = useRef<Record<string, { interval: ReturnType<typeof setInterval>; timeout: ReturnType<typeof setTimeout> }>>({});

  useEffect(() => {
    return () => {
      // Clean up all polling on unmount
      Object.values(pollingRef.current).forEach(({ interval, timeout }) => {
        clearInterval(interval);
        clearTimeout(timeout);
      });
    };
  }, []);

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

  // Fallback suggestion when all challenge slots are completed
  useEffect(() => {
    if (loadingChallenges) return;
    if (pickSuggestionFromChallenges(challenges)) return;

    let cancelled = false;
    async function loadFallback() {
      try {
        const childrenRes = await onboardingApi.getChildren();
        const firstChild = childrenRes.data[0];
        const city = await AsyncStorage.getItem(CITY_KEY);
        const res = await activitiesApi.suggestion(firstChild?.id, city);
        if (!cancelled) setFallbackSuggestion(res.data);
      } catch {
        // best-effort
      }
    }
    loadFallback();
    return () => { cancelled = true; };
  }, [loadingChallenges, challenges]);

  const suggestion = useMemo(
    () => pickSuggestionFromChallenges(challenges) ?? fallbackSuggestion,
    [challenges, fallbackSuggestion]
  );

  function startPolling(slotId: string, completionId: string) {
    const stopPolling = () => {
      const entry = pollingRef.current[slotId];
      if (entry) {
        clearInterval(entry.interval);
        clearTimeout(entry.timeout);
        delete pollingRef.current[slotId];
      }
    };

    async function poll() {
      try {
        const res = await completionsApi.getById(completionId);
        const { status } = res.data;
        if (status === 'ready') {
          stopPolling();
          setLocalCompletions((prev) => ({ ...prev, [slotId]: { status: 'ready', photoUrl: res.data.photo_url ?? null } }));
        }
      } catch {
        // keep polling
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    const timeout = setTimeout(stopPolling, POLL_TIMEOUT_MS);
    pollingRef.current[slotId] = { interval, timeout };
  }

  function handleSlotPress(slot: ChallengeActivitySlot) {
    setActiveSlot(slot);
  }

  function handleSelfReported(slotId: string) {
    setActiveSlot(null);
    completionsApi
      .createSelfReported({ challenge_activity_id: slotId })
      .then(() => setLocalCompletions((prev) => ({ ...prev, [slotId]: { status: 'self_reported' } })))
      .catch(() => {
        if (Platform.OS === 'web') window.alert('Could not mark as complete. Please try again.');
      });
  }

  function handlePhotoSelected(slotId: string, imageUri: string, mimeType: string) {
    setActiveSlot(null);
    setLocalCompletions((prev) => ({ ...prev, [slotId]: { status: 'processing' } }));
    photosApi
      .upload(slotId, imageUri, mimeType)
      .then((r) => startPolling(slotId, r.data.completion_id))
      .catch(() => {
        setLocalCompletions((prev) => {
          const next = { ...prev };
          delete next[slotId];
          return next;
        });
        if (Platform.OS === 'web') window.alert('Photo upload failed. Please try again.');
      });
  }

  function openActivity(activity: ActivityItem) {
    router.push({ pathname: '/activity/[id]', params: { id: activity.id, data: JSON.stringify(activity) } } as any);
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
                localCompletions={localCompletions}
                onSlotPress={handleSlotPress}
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

      <CompleteActivityModal
        visible={activeSlot !== null}
        slot={activeSlot}
        onClose={() => setActiveSlot(null)}
        onSelfReported={handleSelfReported}
        onPhotoSelected={handlePhotoSelected}
      />
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
