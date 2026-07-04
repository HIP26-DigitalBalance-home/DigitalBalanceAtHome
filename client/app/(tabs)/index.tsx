import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArticleTeaser } from '@/components/article-teaser';
import { CollageGrid, type LocalCompletion } from '@/components/collage-grid';
import { CompleteActivityModal } from '@/components/complete-activity-modal';
import { JournalCard } from '@/components/journal-card';
import { PhotoViewerModal } from '@/components/photo-viewer-modal';
import { ProgressRing } from '@/components/progress-ring';
import { EmptyState } from '@/components/ui/empty-state';
import { Illustration, type IllustrationName } from '@/components/ui/illustration';
import { ErrorState } from '@/components/ui/error-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SkeletonList } from '@/components/ui/skeleton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { fadeIn } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { tabScreenPaddingBottom } from '@/constants/nav';
import { useTabBar } from '@/lib/tab-bar-context';
import { useAppTheme } from '@/lib/app-theme-context';
import { useNetworkStatus } from '@/hooks/use-network-status';
import {
  activitiesApi,
  challengesApi,
  collagePresetsApi,
  completionsApi,
  onboardingApi,
  photosApi,
  progressApi,
  type ActivityItem,
  type ChallengeActivitySlot,
  type ChallengeWithProgress,
  type FamilyProgress,
} from '@/lib/api';
import { isChallengeComplete } from '@/lib/challenge-utils';
import { PRESET_ILLUSTRATIONS } from '@/lib/preset-illustrations';
import { getGermanErrorMessage } from '@/lib/utils/api-error';
import { showAlert } from '@/lib/utils/alert';
import AsyncStorage from '@react-native-async-storage/async-storage';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;
const CELEBRATED_KEY = '@dba_celebrated_challenges';
const SUGGESTION_COUNT = 5;
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function collectUnfulfilledActivities(challenges: ChallengeWithProgress[]): ActivityItem[] {
  const seen = new Set<string>();
  const unfulfilled: ActivityItem[] = [];
  for (const challenge of challenges) {
    for (const slot of challenge.activities) {
      if (slot.completion == null && !seen.has(slot.activity.id)) {
        seen.add(slot.activity.id);
        unfulfilled.push(slot.activity);
      }
    }
  }
  return unfulfilled;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function HomeScreen() {
  const { colors, radii } = useAppTheme();
  const { t, i18n } = useTranslation();
  const isOnline = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const { setHidden } = useTabBar();

  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [fallbackActivities, setFallbackActivities] = useState<ActivityItem[]>([]);
  const [activityArt, setActivityArt] = useState<Record<string, IllustrationName>>({});
  const [familyProgress, setFamilyProgress] = useState<FamilyProgress | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);

  const [localCompletions, setLocalCompletions] = useState<Record<string, LocalCompletion>>({});
  const [activeSlot, setActiveSlot] = useState<ChallengeActivitySlot | null>(null);
  const [viewerPhoto, setViewerPhoto] = useState<{ url: string; completionId: string; title: string; familiesCompletedCount: number | null; groupFamiliesCount: number | null } | null>(null);

  // Hide the tab bar while any action modal is open
  const anyModalOpen = activeSlot !== null || viewerPhoto !== null;
  useEffect(() => {
    setHidden(anyModalOpen);
  }, [anyModalOpen, setHidden]);

  // Refs to avoid stale closures in polling/async callbacks
  const challengesRef = useRef<ChallengeWithProgress[]>([]);
  challengesRef.current = challenges;
  const localCompletionsRef = useRef<Record<string, LocalCompletion>>({});
  localCompletionsRef.current = localCompletions;

  // Polling: slotId → { completionId, intervalId, timeoutId }
  const pollingRef = useRef<Record<string, { interval: ReturnType<typeof setInterval>; timeout: ReturnType<typeof setTimeout> }>>({});

  useEffect(() => {
    const polling = pollingRef.current;
    return () => {
      Object.values(polling).forEach(({ interval, timeout }) => {
        clearInterval(interval);
        clearTimeout(timeout);
      });
    };
  }, []);

  // Reload challenges and progress every time the Home tab gains focus
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLocalCompletions({});

    async function loadData() {
      setChallengeError(null);
      try {
        const [challengesRes, familiesRes] = await Promise.all([
          challengesApi.getActive(),
          onboardingApi.getMyFamilies(),
        ]);
        if (!cancelled) {
          setChallenges(challengesRes.data);
          const fid = familiesRes.data[0]?.id ?? null;
          setFamilyId(fid);
          if (fid) {
            try {
              const progressRes = await progressApi.getProgress(fid);
              if (!cancelled) setFamilyProgress(progressRes.data);
            } catch {
              // progress is non-critical; don't block the home screen
            }
          }
        }
      } catch (e) {
        if (!cancelled) setChallengeError(getGermanErrorMessage(e));
      } finally {
        if (!cancelled) setLoadingChallenges(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [i18n.language]));

  // Map each activity to the artwork of the explore preset it belongs to,
  // so suggestion cards match the collage cards in the Explore view.
  useEffect(() => {
    let cancelled = false;
    async function loadPresetArt() {
      try {
        const res = await collagePresetsApi.list();
        if (cancelled) return;
        const map: Record<string, IllustrationName> = {};
        for (const preset of res.data) {
          const art = PRESET_ILLUSTRATIONS[preset.name] ?? 'stamp-custom';
          for (const activityId of preset.activity_ids) {
            if (!map[activityId]) map[activityId] = art;
          }
        }
        setActivityArt(map);
      } catch {
        // best-effort; cards fall back to the custom stamp
      }
    }
    loadPresetArt();
    return () => { cancelled = true; };
  }, []);

  // Fallback activities when the open challenge slots can't fill all suggestion cards
  useEffect(() => {
    if (loadingChallenges) return;
    if (collectUnfulfilledActivities(challenges).length >= SUGGESTION_COUNT) return;

    let cancelled = false;
    async function loadFallback() {
      let age: number | undefined;
      try {
        const childrenRes = await onboardingApi.getChildren();
        const dob = childrenRes.data[0]?.date_of_birth;
        if (dob) age = Math.max(0, Math.floor((Date.now() - new Date(dob).getTime()) / MS_PER_YEAR));
      } catch {
        // age filter is optional
      }
      try {
        const res = await activitiesApi.list(age != null ? { age } : {});
        if (!cancelled) setFallbackActivities(res.data);
      } catch {
        // best-effort
      }
    }
    loadFallback();
    return () => { cancelled = true; };
  }, [loadingChallenges, challenges]);

  const suggestions = useMemo(() => {
    const fromChallenges = shuffle(collectUnfulfilledActivities(challenges));
    const seen = new Set(fromChallenges.map((a) => a.id));
    const fill = shuffle(fallbackActivities.filter((a) => !seen.has(a.id)));
    return [...fromChallenges, ...fill].slice(0, SUGGESTION_COUNT);
  }, [challenges, fallbackActivities]);

  function checkCelebration(slotId: string, updatedLocal: Record<string, LocalCompletion>) {
    const challenge = challengesRef.current.find((c) => c.activities.some((s) => s.id === slotId));
    if (challenge && isChallengeComplete(challenge.activities, updatedLocal)) {
      AsyncStorage.getItem(CELEBRATED_KEY).then((raw) => {
        const celebrated: string[] = raw ? JSON.parse(raw) : [];
        if (!celebrated.includes(challenge.id)) {
          celebrated.push(challenge.id);
          AsyncStorage.setItem(CELEBRATED_KEY, JSON.stringify(celebrated));
          router.push({ pathname: '/celebration', params: { challengeId: challenge.id } } as any);
        }
      });
    }
  }

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
          const updated: Record<string, LocalCompletion> = { ...localCompletionsRef.current, [slotId]: { status: 'ready', photoUrl: res.data.photo_url ?? null, completionId } };
          setLocalCompletions(updated);
          checkCelebration(slotId, updated);
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

  function makePhotoHandler(groupFamiliesCount: number | null) {
    return (slot: ChallengeActivitySlot, photoUrl: string, completionId: string) => {
      setViewerPhoto({
        url: photoUrl,
        completionId,
        title: slot.activity.title,
        familiesCompletedCount: slot.families_completed_count ?? null,
        groupFamiliesCount,
      });
    };
  }

  function handlePhotoDeleted(completionId: string) {
    setLocalCompletions((prev) => {
      const next = { ...prev };
      // find the slotId whose completionId matches and mark as deleted
      for (const [slotId, lc] of Object.entries(next)) {
        if (lc.completionId === completionId) { next[slotId] = { status: 'deleted' }; break; }
      }
      return next;
    });
  }

  function handleSelfReported(slotId: string, sharedToFeed: boolean) {
    if (!isOnline) {
      showAlert(t('common.offline'), t('common.noConnection'));
      return;
    }
    setActiveSlot(null);
    completionsApi
      .createSelfReported({ challenge_activity_id: slotId, shared_to_feed: sharedToFeed })
      .then(() => {
        const updated = { ...localCompletionsRef.current, [slotId]: { status: 'self_reported' } };
        setLocalCompletions(updated);
        checkCelebration(slotId, updated);
      })
      .catch((e) => {
        showAlert(t('common.error'), getGermanErrorMessage(e));
      });
  }

  function handlePhotoSelected(slotId: string, imageUri: string, mimeType: string, sharedToFeed: boolean) {
    if (!isOnline) {
      showAlert(t('common.offline'), t('common.noConnection'));
      return;
    }
    setActiveSlot(null);
    setLocalCompletions((prev) => ({ ...prev, [slotId]: { status: 'processing' } }));
    photosApi
      .upload(slotId, imageUri, mimeType, undefined, sharedToFeed)
      .then((r) => startPolling(slotId, r.data.completion_id))
      .catch((e) => {
        setLocalCompletions((prev) => {
          const next = { ...prev };
          delete next[slotId];
          return next;
        });
        showAlert(t('common.error'), getGermanErrorMessage(e));
      });
  }

  function openActivity(activity: ActivityItem) {
    router.push({ pathname: '/activity/[id]', params: { id: activity.id, data: JSON.stringify(activity) } } as any);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabScreenPaddingBottom(insets.bottom) }]}>
        <View style={styles.titleRow}>
          <View style={styles.brandRow}>
            <Image
              source={require('@/assets/images/bunny-logo.png')}
              style={styles.brandLogo}
              accessibilityLabel="Bond mascot"
            />
            <ThemedText type="title">Bond</ThemedText>
          </View>
          <Pressable onPress={() => router.push('/challenges' as any)}>
            <ThemedText style={{ color: colors.primary, fontSize: 14 }}>{t('home.allChallenges')}</ThemedText>
          </Pressable>
        </View>

        {/* Article of the day — education stays top of mind, in a slim row */}
        <ArticleTeaser />

        {/* Progress widget: streak + goal ring */}
        {familyProgress && (
          <PressableScale
            style={[styles.progressWidget, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/progress' as any)}
            accessibilityRole="button"
            accessibilityLabel={t('progress.title')}
          >
            <View style={styles.progressRingBlock}>
              <ProgressRing value={familyProgress.this_week.activities} goal={familyProgress.weekly_goal} size={52} />
              <ThemedText style={[styles.progressRingLabel, { color: colors.muted }]}>
                {t('progress.activitiesGoal', { value: familyProgress.this_week.activities, goal: familyProgress.weekly_goal })}
              </ThemedText>
            </View>
            <View style={styles.progressStreakBlock}>
              <ThemedText style={[styles.progressStreakCount, { color: colors.onSurface }]}>
                🔥 {familyProgress.streak.current_days}
              </ThemedText>
              <ThemedText style={[styles.progressStreakLabel, { color: colors.muted }]}>
                {familyProgress.streak.frozen_today ? '❄️' : t('progress.streakDays', { count: familyProgress.streak.current_days })}
              </ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </PressableScale>
        )}

        {/* Daily mood check-in — hides itself once answered */}
        <JournalCard />

        {/* Suggestion carousel — full-bleed, not boxed in a section card */}
        <View style={styles.suggestionSection}>
          <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>{t('home.todaysSuggestion')}</ThemedText>
          {loadingChallenges ? (
            <SkeletonList count={1} rowHeight={140} />
          ) : suggestions.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.suggestionScroll}
              contentContainerStyle={styles.suggestionRow}
            >
              {suggestions.map((activity) => (
                <Pressable
                  key={activity.id}
                  style={[styles.suggestionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => openActivity(activity)}
                  accessibilityRole="button"
                  accessibilityLabel={activity.title}
                >
                  <Illustration name={activityArt[activity.id] ?? 'stamp-custom'} size={56} />
                  <View style={styles.suggestionCardFooter}>
                    <ThemedText style={[styles.suggestionCardMeta, { color: colors.primary }]}>
                      {t('common.minutes', { count: activity.estimated_duration_minutes })} ·{' '}
                      {activity.cost_indicator === 'free' ? t('cost.free') : t('cost.lowCost')}
                    </ThemedText>
                    <ThemedText style={[styles.suggestionCardTitle, { color: colors.onSurface }]} numberOfLines={2}>
                      {activity.title}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <ThemedText style={{ color: colors.muted, fontSize: 14 }}>
              {t('home.noSuggestion')}
            </ThemedText>
          )}
        </View>

        {/* Active challenge collages */}
        {loadingChallenges ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>{t('home.yourCollages')}</ThemedText>
            <SkeletonList count={2} rowHeight={180} />
          </View>
        ) : challengeError ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>{t('home.yourCollages')}</ThemedText>
            <ErrorState message={challengeError} onRetry={() => { setLoadingChallenges(true); }} />
          </View>
        ) : challenges.length > 0 ? (
          challenges.map((challenge) => (
            <Animated.View
              key={challenge.id}
              entering={fadeIn()}
              style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.sectionHeader}>
                <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>
                  {challenge.status === 'completed' ? t('home.completedChallenge') : t('home.activeChallenge')}
                </ThemedText>
                <Pressable
                  onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: challenge.id } } as any)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('home.viewDetails')}
                >
                  <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
                </Pressable>
              </View>
              <ThemedText style={[styles.challengeTitle, { color: colors.onSurface }]}>{challenge.title}</ThemedText>
              <CollageGrid
                slots={challenge.activities}
                groupFamiliesCount={challenge.group_families_count}
                localCompletions={localCompletions}
                onSlotPress={challenge.status === 'completed' ? undefined : handleSlotPress}
                onPhotoPress={makePhotoHandler(challenge.group_families_count ?? null)}
              />
            </Animated.View>
          ))
        ) : (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>{t('home.yourCollages')}</ThemedText>
            <EmptyState
              illustration="elephant-star"
              title={t('home.emptyTitle')}
              body={t('home.emptyBody')}
              actionLabel={t('home.emptyAction')}
              onAction={() => router.push('/(tabs)/explore' as any)}
            />
          </View>
        )}
      </ScrollView>

      <CompleteActivityModal
        visible={activeSlot !== null}
        slot={activeSlot}
        defaultShared={activeSlot != null && challenges.some((c) => !c.is_private && c.activities.some((s) => s.id === activeSlot.id))}
        onClose={() => setActiveSlot(null)}
        onSelfReported={handleSelfReported}
        onPhotoSelected={handlePhotoSelected}
      />

      <PhotoViewerModal
        visible={viewerPhoto !== null}
        photoUrl={viewerPhoto?.url ?? null}
        completionId={viewerPhoto?.completionId ?? null}
        activityTitle={viewerPhoto?.title ?? ''}
        familiesCompletedCount={viewerPhoto?.familiesCompletedCount ?? null}
        groupFamiliesCount={viewerPhoto?.groupFamiliesCount ?? null}
        onClose={() => setViewerPhoto(null)}
        onDeleted={handlePhotoDeleted}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.screenHorizontal, gap: Spacing.lg, paddingTop: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  brandLogo: { width: 32, height: 32, borderRadius: 16 },
  section: { borderRadius: DEFAULT_RADII.card, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  challengeTitle: { fontSize: 16, fontWeight: '600' },
  challengeDates: { fontSize: 12, marginBottom: Spacing.xs },
  emptyChallenge: { gap: Spacing.md, alignItems: 'flex-start' },
  emptyText: { fontSize: 14 },
  createButton: { height: 44, paddingHorizontal: Spacing.lg, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  createButtonText: { fontSize: 14, fontWeight: '600' },
  suggestionSection: { gap: Spacing.sm },
  suggestionScroll: { marginHorizontal: -Spacing.screenHorizontal },
  suggestionRow: { paddingHorizontal: Spacing.screenHorizontal, gap: Spacing.sm },
  suggestionCard: {
    width: 148,
    minHeight: 150,
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.md,
    justifyContent: 'space-between',
  },
  suggestionCardFooter: { gap: 2 },
  suggestionCardMeta: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  suggestionCardTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  progressWidget: { flexDirection: 'row', alignItems: 'center', borderRadius: DEFAULT_RADII.card, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.lg },
  progressRingBlock: { alignItems: 'center', gap: 2, paddingTop: Spacing.sm },
  progressRingLabel: { fontSize: 11 },
  progressStreakBlock: { flex: 1, gap: 2 },
  progressStreakCount: { fontSize: 22, fontWeight: '600' },
  progressStreakLabel: { fontSize: 12 },
});
