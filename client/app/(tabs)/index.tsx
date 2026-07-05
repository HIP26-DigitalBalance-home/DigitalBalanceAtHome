import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArticleTeaser } from '@/components/article-teaser';
import { ActivitySuggestionsRow } from '@/components/activity-suggestions-row';
import { CollageGrid, type LocalCompletion } from '@/components/collage-grid';
import { CompleteActivityModal } from '@/components/complete-activity-modal';
import { TimeSpentCard } from '@/components/time-spent-card';
import { PhotoViewerModal } from '@/components/photo-viewer-modal';
import { ProgressRing } from '@/components/progress-ring';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SkeletonList } from '@/components/ui/skeleton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { fadeIn, timing } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { tabScreenPaddingBottom } from '@/constants/nav';
import { useTabBar } from '@/lib/tab-bar-context';
import { useAppTheme } from '@/lib/app-theme-context';
import { useNetworkStatus } from '@/hooks/use-network-status';
import {
  challengesApi,
  completionsApi,
  onboardingApi,
  photosApi,
  progressApi,
  type ChallengeActivitySlot,
  type ChallengeWithProgress,
  type FamilyProgress,
} from '@/lib/api';
import { computePotentialPoints, isChallengeComplete } from '@/lib/challenge-utils';
import { ReuploadModal } from '@/components/reupload-modal';
import { getGermanErrorMessage } from '@/lib/utils/api-error';
import { showAlert } from '@/lib/utils/alert';
import { localDateString } from '@/lib/time-spent-utils';
import AsyncStorage from '@react-native-async-storage/async-storage';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;
const CELEBRATED_KEY = '@dba_celebrated_challenges';
const COLLAPSED_HERO_HEIGHT = 68;
const HERO_COLLAPSE_DISTANCE = 128;
const HERO_SNAP_THRESHOLD = HERO_COLLAPSE_DISTANCE / 2;
// Upward movement pauses at the collage boundary for this distance before the
// full hero starts returning. Downward movement is never delayed.
const HERO_GRACE_DISTANCE = 160;
const SCROLL_LOCK_TOLERANCE = 0.5;
const SCROLL_HINT_PAUSE_MS = 6500;

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  const isOnline = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { setHidden } = useTabBar();

  const expandedHeroHeight = windowHeight - insets.top;
  const heroOverlap = Math.max(
    0,
    expandedHeroHeight - COLLAPSED_HERO_HEIGHT - HERO_COLLAPSE_DISTANCE,
  );
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const graceRemaining = useSharedValue(HERO_GRACE_DISTANCE);
  const graceArmed = useSharedValue(false);
  const graceLocked = useSharedValue(false);
  const arrowOffset = useSharedValue(0);

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const offset = Math.max(0, event.contentOffset.y);

      // Scrolling into the collage rearms the grace distance for the next
      // upward approach to the collapsed hero boundary.
      if (offset > HERO_COLLAPSE_DISTANCE) {
        graceArmed.value = true;
        graceLocked.value = false;
        graceRemaining.value = HERO_GRACE_DISTANCE;
        scrollY.value = offset;
        return;
      }

      // Short collage states may stop exactly at the boundary, so arm the
      // grace period when arriving there from the expanded hero too.
      if (
        !graceLocked.value
        && offset >= HERO_COLLAPSE_DISTANCE - SCROLL_LOCK_TOLERANCE
        && offset > scrollY.value
      ) {
        graceArmed.value = true;
        graceRemaining.value = HERO_GRACE_DISTANCE;
        scrollY.value = offset;
        return;
      }

      if (graceLocked.value) {
        // scrollTo() emits an event at the lock position. Keep holding there
        // until the full grace distance is consumed, unless direction flips.
        if (offset >= HERO_COLLAPSE_DISTANCE) {
          if (offset > HERO_COLLAPSE_DISTANCE) {
            graceArmed.value = true;
            graceLocked.value = false;
            graceRemaining.value = HERO_GRACE_DISTANCE;
            scrollY.value = offset;
          } else {
            scrollY.value = HERO_COLLAPSE_DISTANCE;
          }
          return;
        }

        graceRemaining.value -= HERO_COLLAPSE_DISTANCE - offset;
        if (graceRemaining.value > 0) {
          scrollY.value = HERO_COLLAPSE_DISTANCE;
          scrollTo(scrollRef, 0, HERO_COLLAPSE_DISTANCE, false);
          return;
        }

        // Preserve movement beyond the grace distance so the hero reveal
        // starts continuously instead of swallowing the rest of the gesture.
        const nextOffset = Math.max(
          0,
          HERO_COLLAPSE_DISTANCE + graceRemaining.value,
        );
        graceArmed.value = false;
        graceLocked.value = false;
        scrollY.value = nextOffset;
        scrollTo(scrollRef, 0, nextOffset, false);
        return;
      }

      if (
        graceArmed.value
        && offset < HERO_COLLAPSE_DISTANCE
        && scrollY.value >= HERO_COLLAPSE_DISTANCE - SCROLL_LOCK_TOLERANCE
      ) {
        graceRemaining.value = Math.max(
          0,
          HERO_GRACE_DISTANCE - (HERO_COLLAPSE_DISTANCE - offset),
        );

        if (graceRemaining.value <= 0) {
          const nextOffset = Math.max(
            0,
            HERO_COLLAPSE_DISTANCE
              - ((HERO_COLLAPSE_DISTANCE - offset) - HERO_GRACE_DISTANCE),
          );
          graceArmed.value = false;
          scrollY.value = nextOffset;
          scrollTo(scrollRef, 0, nextOffset, false);
          return;
        }

        graceLocked.value = true;
        scrollY.value = HERO_COLLAPSE_DISTANCE;
        scrollTo(scrollRef, 0, HERO_COLLAPSE_DISTANCE, false);
        return;
      }

      scrollY.value = offset;
    },
    onEndDrag: () => {
      const offset = scrollY.value;
      if (offset <= 0 || offset >= HERO_COLLAPSE_DISTANCE) return;

      const target = offset <= HERO_SNAP_THRESHOLD
        ? 0
        : HERO_COLLAPSE_DISTANCE;
      graceArmed.value = target === HERO_COLLAPSE_DISTANCE;
      graceLocked.value = false;
      graceRemaining.value = HERO_GRACE_DISTANCE;
      scrollTo(scrollRef, 0, target, true);
    },
    onMomentumEnd: () => {
      const offset = scrollY.value;
      if (offset <= 0 || offset >= HERO_COLLAPSE_DISTANCE) return;

      const target = offset <= HERO_SNAP_THRESHOLD
        ? 0
        : HERO_COLLAPSE_DISTANCE;
      graceArmed.value = target === HERO_COLLAPSE_DISTANCE;
      graceLocked.value = false;
      graceRemaining.value = HERO_GRACE_DISTANCE;
      scrollTo(scrollRef, 0, target, true);
    },
  });

  useEffect(() => {
    arrowOffset.value = withRepeat(
      withSequence(
        withTiming(3, timing(450)),
        withTiming(0, timing(450)),
        withDelay(SCROLL_HINT_PAUSE_MS, withTiming(0, timing(0))),
      ),
      -1,
    );

    return () => cancelAnimation(arrowOffset);
  }, [arrowOffset]);

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, HERO_COLLAPSE_DISTANCE],
          [0, -heroOverlap],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const heroContentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, HERO_COLLAPSE_DISTANCE * 0.72],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, HERO_COLLAPSE_DISTANCE],
          [0, -Spacing.lg],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const compactHeaderAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [HERO_COLLAPSE_DISTANCE * 0.58, HERO_COLLAPSE_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [HERO_COLLAPSE_DISTANCE * 0.58, HERO_COLLAPSE_DISTANCE],
          [-Spacing.sm, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const scrollHintAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, HERO_COLLAPSE_DISTANCE * 0.35],
      [0.55, 0],
      Extrapolation.CLAMP,
    ),
    transform: [{ translateY: arrowOffset.value }],
  }));

  const [challenges, setChallenges] = useState<ChallengeWithProgress[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [familyProgress, setFamilyProgress] = useState<FamilyProgress | null>(null);

  const [localCompletions, setLocalCompletions] = useState<Record<string, LocalCompletion>>({});
  const [activeSlot, setActiveSlot] = useState<ChallengeActivitySlot | null>(null);
  const [viewerPhoto, setViewerPhoto] = useState<{
    url: string;
    completionId: string;
    slotId: string;
    title: string;
    familiesCompletedCount: number | null;
    groupFamiliesCount: number | null;
    status: string | null;
    rejectionReason: string | null;
    potentialPoints: number;
  } | null>(null);
  const [reuploadTarget, setReuploadTarget] = useState<{ slotId: string; completionId: string; rejectionReason: string | null; title: string } | null>(null);

  // Hide the tab bar while any action modal is open
  const anyModalOpen = activeSlot !== null || viewerPhoto !== null || reuploadTarget !== null;
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
        if (status !== 'processing') {
          stopPolling();
          const updated: Record<string, LocalCompletion> = {
            ...localCompletionsRef.current,
            [slotId]: {
              status,
              photoUrl: res.data.photo_url ?? null,
              completionId,
              rejectionReason: res.data.rejection_reason ?? null,
              durationMinutes: res.data.duration_minutes ?? null,
            },
          };
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

  function makePhotoHandler(challenge: ChallengeWithProgress) {
    return (slot: ChallengeActivitySlot, photoUrl: string, completionId: string) => {
      const local = localCompletions[slot.id];
      const status = local?.status ?? slot.completion?.status ?? null;
      const rejectionReason = local?.rejectionReason ?? slot.completion?.rejection_reason ?? null;
      const durationMinutes = local?.durationMinutes ?? slot.completion?.duration_minutes ?? null;
      setViewerPhoto({
        url: photoUrl,
        completionId,
        slotId: slot.id,
        title: slot.activity.title,
        familiesCompletedCount: slot.families_completed_count ?? null,
        groupFamiliesCount: challenge.group_families_count ?? null,
        status,
        rejectionReason,
        potentialPoints: computePotentialPoints(slot.activity, challenge.is_featured, durationMinutes),
      });
    };
  }

  function handleViewerReupload(completionId: string) {
    if (!viewerPhoto) return;
    setReuploadTarget({
      slotId: viewerPhoto.slotId,
      completionId,
      rejectionReason: viewerPhoto.rejectionReason,
      title: viewerPhoto.title,
    });
    setViewerPhoto(null);
  }

  function handleReuploaded(completionId: string) {
    const slotId = reuploadTarget?.slotId;
    if (!slotId) return;
    // Rejected photos re-enter the compression pipeline server-side — show the
    // slot as processing and poll until it lands in pending_verification.
    setLocalCompletions((prev) => ({ ...prev, [slotId]: { status: 'processing' } }));
    startPolling(slotId, completionId);
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

  function handleSelfReported(slotId: string, sharedToFeed: boolean, durationMinutes: number, caption?: string) {
    if (!isOnline) {
      showAlert(t('common.offline'), t('common.noConnection'));
      return;
    }
    setActiveSlot(null);
    completionsApi
      .createSelfReported({
        challenge_activity_id: slotId,
        shared_to_feed: sharedToFeed,
        caption,
        duration_minutes: durationMinutes,
        completed_on: localDateString(),
      })
      .then(() => {
        const updated = { ...localCompletionsRef.current, [slotId]: { status: 'self_reported' } };
        setLocalCompletions(updated);
        checkCelebration(slotId, updated);
      })
      .catch((e) => {
        showAlert(t('common.error'), getGermanErrorMessage(e));
      });
  }

  function handlePhotoSelected(slotId: string, imageUri: string, mimeType: string, sharedToFeed: boolean, caption?: string, durationMinutes?: number | null) {
    if (!isOnline) {
      showAlert(t('common.offline'), t('common.noConnection'));
      return;
    }
    setActiveSlot(null);
    setLocalCompletions((prev) => ({ ...prev, [slotId]: { status: 'processing', durationMinutes } }));
    photosApi
      .upload(slotId, imageUri, mimeType, caption, sharedToFeed, durationMinutes, localDateString())
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View
          style={[
            styles.hero,
            {
              height: expandedHeroHeight,
              marginBottom: -heroOverlap,
              backgroundColor: colors.background,
            },
            heroAnimatedStyle,
          ]}
        >
          <Animated.View
            style={[
              styles.heroContent,
              { paddingBottom: tabScreenPaddingBottom(insets.bottom) },
              heroContentAnimatedStyle,
            ]}
          >
            <View style={styles.brandHero}>
              <Image
                source={require('@/assets/images/bunny-logo.png')}
                style={styles.brandHeroLogo}
                accessibilityLabel="Bond mascot"
              />
              <ThemedText type="title" style={styles.brandHeroTitle}>Bond</ThemedText>
            </View>

            {/* Progress is the hero's primary action, ahead of supporting content. */}
            {familyProgress && (
              <PressableScale
                style={[styles.progressWidget, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push('/progress' as any)}
                accessibilityRole="button"
                accessibilityLabel={t('progress.title')}
              >
                <ProgressRing
                  value={familyProgress.this_week.activities}
                  goal={familyProgress.weekly_goal}
                  size={64}
                  strokeWidth={6}
                />
                <View style={styles.progressTextBlock}>
                  <ThemedText
                    style={[styles.progressGoal, { color: colors.onSurface }]}
                  >
                    {t('progress.activitiesGoal', {
                      value: familyProgress.this_week.activities,
                      goal: familyProgress.weekly_goal,
                    })}
                  </ThemedText>
                  <ThemedText
                    style={[styles.progressStreak, { color: colors.muted }]}
                  >
                    {familyProgress.streak.frozen_today
                      ? `🔥 ${familyProgress.streak.current_days} · ❄️`
                      : `🔥 ${t('progress.streakDays', { count: familyProgress.streak.current_days })}`}
                  </ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </PressableScale>
            )}

            <ActivitySuggestionsRow>
              <ArticleTeaser />
            </ActivitySuggestionsRow>

            <TimeSpentCard />

            <Animated.View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.scrollHint,
                { bottom: tabScreenPaddingBottom(insets.bottom) },
                scrollHintAnimatedStyle,
              ]}
            >
              <IconSymbol name="chevron.down" size={26} color={colors.muted} />
            </Animated.View>
          </Animated.View>
        </Animated.View>

        <View
          style={[
            styles.collageContent,
            {
              minHeight: expandedHeroHeight - COLLAPSED_HERO_HEIGHT,
              paddingBottom: tabScreenPaddingBottom(insets.bottom),
              backgroundColor: colors.background,
            },
          ]}
        >
          <View style={styles.collageHeading}>
            <ThemedText
              style={[styles.sectionLabel, { color: colors.primary + '99' }]}
            >
              {t('home.yourCollages')}
            </ThemedText>
            <Pressable
              onPress={() => router.push('/challenges' as any)}
              hitSlop={8}
              accessibilityRole="button"
            >
              <ThemedText style={{ color: colors.primary, fontSize: 14 }}>
                {t('home.allChallenges')}
              </ThemedText>
            </Pressable>
          </View>

          {/* Active challenge collages */}
          {loadingChallenges ? (
            <View
              style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <SkeletonList count={2} rowHeight={180} />
            </View>
          ) : challengeError ? (
            <View
              style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
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
                  <ThemedText
                    style={[styles.sectionLabel, { color: colors.primary + '99' }]}
                  >
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
                  onPhotoPress={makePhotoHandler(challenge)}
                />
              </Animated.View>
            ))
          ) : (
            <View
              style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <EmptyState
                illustration="elephant-star"
                title={t('home.emptyTitle')}
                body={t('home.emptyBody')}
                actionLabel={t('home.emptyAction')}
                onAction={() => router.push('/(tabs)/explore' as any)}
              />
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.compactHeader,
          {
            height: COLLAPSED_HERO_HEIGHT,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
          compactHeaderAnimatedStyle,
        ]}
      >
        <Image source={require('@/assets/images/bunny-logo.png')} style={styles.compactLogo} />
        <ThemedText type="title" style={styles.compactTitle}>Bond</ThemedText>
      </Animated.View>

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
        status={viewerPhoto?.status ?? null}
        rejectionReason={viewerPhoto?.rejectionReason ?? null}
        potentialPoints={viewerPhoto?.potentialPoints ?? null}
        onReupload={handleViewerReupload}
        onClose={() => setViewerPhoto(null)}
        onDeleted={handlePhotoDeleted}
      />

      <ReuploadModal
        visible={reuploadTarget !== null}
        completionId={reuploadTarget?.completionId ?? null}
        rejectionReason={reuploadTarget?.rejectionReason ?? null}
        activityTitle={reuploadTarget?.title}
        onClose={() => setReuploadTarget(null)}
        onReuploaded={handleReuploaded}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  hero: { zIndex: 2 },
  heroContent: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.screenHorizontal,
    gap: Spacing.sm,
  },
  brandHero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
  brandHeroLogo: { width: 48, height: 48, borderRadius: 24 },
  brandHeroTitle: { fontSize: 26, lineHeight: 32 },
  scrollHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  compactHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compactLogo: { width: 36, height: 36, borderRadius: 18 },
  compactTitle: { fontSize: 24, lineHeight: 30 },
  collageContent: {
    zIndex: 1,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.screenHorizontal,
    gap: Spacing.lg,
  },
  collageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { borderRadius: DEFAULT_RADII.card, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  challengeTitle: { fontSize: 16, fontWeight: '600' },
  challengeDates: { fontSize: 12, marginBottom: Spacing.xs },
  emptyChallenge: { gap: Spacing.md, alignItems: 'flex-start' },
  emptyText: { fontSize: 14 },
  createButton: { height: 44, paddingHorizontal: Spacing.lg, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  createButtonText: { fontSize: 14, fontWeight: '600' },
  progressWidget: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  progressTextBlock: { flex: 1, gap: 2 },
  progressGoal: { fontSize: 15, fontWeight: '700', lineHeight: 19 },
  progressStreak: { fontSize: 12, lineHeight: 16 },
});
