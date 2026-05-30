import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollageGrid } from '@/components/collage-grid';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { activitiesApi, challengesApi, onboardingApi, type ActivityItem, type ChallengeWithProgress } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CITY_KEY = '@dba_city_preference';

export default function HomeScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [suggestion, setSuggestion] = useState<ActivityItem | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(true);
  const [challenge, setChallenge] = useState<ChallengeWithProgress | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(true);
  const [noChallenge, setNoChallenge] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSuggestion() {
      try {
        const childrenRes = await onboardingApi.getChildren();
        const firstChild = childrenRes.data[0];
        const city = await AsyncStorage.getItem(CITY_KEY);
        const res = await activitiesApi.suggestion(firstChild?.id, city);
        if (!cancelled) setSuggestion(res.data);
      } catch {
        // suggestion is best-effort; silent failure is fine
      } finally {
        if (!cancelled) setLoadingSuggestion(false);
      }
    }

    async function loadChallenge() {
      try {
        const res = await challengesApi.getActive();
        if (!cancelled) setChallenge(res.data);
      } catch (e: any) {
        if (!cancelled) {
          if (e?.response?.status === 404) setNoChallenge(true);
        }
      } finally {
        if (!cancelled) setLoadingChallenge(false);
      }
    }

    loadSuggestion();
    loadChallenge();
    return () => { cancelled = true; };
  }, []);

  function openSuggestion() {
    if (!suggestion) return;
    router.push({ pathname: '/activity/[id]', params: { id: suggestion.id, data: JSON.stringify(suggestion) } } as any);
  }

  function openSlot(slot: any) {
    router.push({ pathname: '/activity/[id]', params: { id: slot.activity.id, data: JSON.stringify(slot.activity) } } as any);
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

        {/* Active challenge collage */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>YOUR COLLAGE</ThemedText>
            {challenge && (
              <Pressable onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: challenge.id } } as any)}>
                <ThemedText style={{ color: colors.primary, fontSize: 13 }}>View details</ThemedText>
              </Pressable>
            )}
          </View>

          {loadingChallenge ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.md }} />
          ) : challenge ? (
            <>
              <ThemedText style={[styles.challengeTitle, { color: colors.onSurface }]}>{challenge.title}</ThemedText>
              <ThemedText style={[styles.challengeDates, { color: colors.muted }]}>
                {challenge.start_date} → {challenge.end_date}
              </ThemedText>
              <CollageGrid
                slots={challenge.activities}
                groupFamiliesCount={challenge.group_families_count}
                onSlotPress={openSlot}
              />
            </>
          ) : noChallenge ? (
            <View style={styles.emptyChallenge}>
              <ThemedText style={[styles.emptyText, { color: colors.muted }]}>
                No active challenge yet.
              </ThemedText>
              <Pressable
                style={[styles.createButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/create-challenge' as any)}
              >
                <ThemedText style={[styles.createButtonText, { color: colors.buttonText }]}>
                  Create one →
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <ThemedText style={{ color: colors.muted, fontSize: 14 }}>
              Could not load challenge.
            </ThemedText>
          )}
        </View>

        {/* Suggestion card */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>TODAY'S SUGGESTION</ThemedText>

          {loadingSuggestion ? (
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
                onPress={openSuggestion}>
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
