import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CollageGrid, type LocalCompletion } from '@/components/collage-grid';
import { CompleteActivityModal } from '@/components/complete-activity-modal';
import { InviteFriendsModal } from '@/components/invite-friends-modal';
import { PhotoViewerModal } from '@/components/photo-viewer-modal';
import { ReuploadModal } from '@/components/reupload-modal';
import { ErrorState } from '@/components/ui/error-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SkeletonList } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';
import { fadeIn } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import { useNetworkStatus } from '@/hooks/use-network-status';
import {
  challengesApi,
  completionsApi,
  groupsApi,
  photosApi,
  type ChallengeActivitySlot,
  type ChallengeParticipant,
  type ChallengeWithProgress,
} from '@/lib/api';
import { computePotentialPoints, isChallengeComplete } from '@/lib/challenge-utils';
import { saveCollagePng, shareCollagePng } from '@/lib/collage-export';
import { getGermanErrorMessage } from '@/lib/utils/api-error';
import { showAlert, confirmDestructive } from '@/lib/utils/alert';
import { localDateString } from '@/lib/time-spent-utils';

const CELEBRATED_KEY = '@dba_celebrated_challenges';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

export default function ChallengeDetailScreen() {
  const { colors, radii } = useAppTheme();
  const statusColor = (s: string) => (s === 'active' ? colors.accent : colors.muted);
  const { t, i18n } = useTranslation();
  const isOnline = useNetworkStatus();
  const { id } = useLocalSearchParams<{ id: string }>();
  const statusLabels: Record<string, string> = {
    active: t('status.active'),
    completed: t('status.completed'),
  };
  const [challenge, setChallenge] = useState<ChallengeWithProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const [groupName, setGroupName] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [participants, setParticipants] = useState<ChallengeParticipant[]>([]);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const pollingRef = useRef<Record<string, { interval: ReturnType<typeof setInterval>; timeout: ReturnType<typeof setTimeout> }>>({});

  const challengeRef = useRef<ChallengeWithProgress | null>(null);
  challengeRef.current = challenge;
  const localCompletionsRef = useRef<Record<string, LocalCompletion>>({});
  localCompletionsRef.current = localCompletions;

  useEffect(() => {
    const polling = pollingRef.current;
    return () => {
      Object.values(polling).forEach(({ interval, timeout }) => {
        clearInterval(interval);
        clearTimeout(timeout);
      });
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    challengesApi.getById(id)
      .then((r) => {
        if (!cancelled) {
          setChallenge(r.data);
          if (r.data.group_id) {
            groupsApi.getGroup(r.data.group_id)
              .then((g) => { if (!cancelled) setGroupName(g.data.name); })
              .catch(() => {});
          }
        }
      })
      .catch((e) => { if (!cancelled) setError(getGermanErrorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    challengesApi.getParticipants(id)
      .then((r) => { if (!cancelled) setParticipants(r.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id, i18n.language]);

  function handlePrivacyToggle(isPrivate: boolean) {
    // Guard against redundant/spurious switch events (react-native-web can
    // re-fire onValueChange) and concurrent saves — both would loop PATCHes.
    if (!challenge || challenge.is_private === isPrivate || savingPrivacy) return;
    if (!isOnline) { showAlert(t('common.offline'), t('common.noConnection')); return; }
    const previous = challenge.is_private;
    setChallenge({ ...challenge, is_private: isPrivate });
    setSavingPrivacy(true);
    challengesApi
      .update(challenge.id, { is_private: isPrivate })
      .catch(() => {
        setChallenge((c) => (c ? { ...c, is_private: previous } : c));
        showAlert(t('common.error'), t('challengeDetail.privacyUpdateFailed'));
      })
      .finally(() => setSavingPrivacy(false));
  }

  function checkCelebration(updatedLocal: Record<string, LocalCompletion>) {
    const c = challengeRef.current;
    if (c && isChallengeComplete(c.activities, updatedLocal)) {
      AsyncStorage.getItem(CELEBRATED_KEY).then((raw) => {
        const celebrated: string[] = raw ? JSON.parse(raw) : [];
        if (!celebrated.includes(c.id)) {
          celebrated.push(c.id);
          AsyncStorage.setItem(CELEBRATED_KEY, JSON.stringify(celebrated));
          router.replace({ pathname: '/celebration', params: { challengeId: c.id } } as any);
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
        if (res.data.status !== 'processing') {
          stopPolling();
          const updated: Record<string, LocalCompletion> = {
            ...localCompletionsRef.current,
            [slotId]: {
              status: res.data.status,
              photoUrl: res.data.photo_url ?? null,
              completionId,
              rejectionReason: res.data.rejection_reason ?? null,
              durationMinutes: res.data.duration_minutes ?? null,
            },
          };
          setLocalCompletions(updated);
          checkCelebration(updated);
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

  function handleSelfReported(slotId: string, sharedToFeed: boolean, durationMinutes: number, caption?: string) {
    if (!isOnline) { showAlert(t('common.offline'), t('common.noConnection')); return; }
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
        checkCelebration(updated);
      })
      .catch((e) => {
        showAlert(t('common.error'), getGermanErrorMessage(e));
      });
  }

  async function handleDeleteChallenge() {
    if (!challenge) return;
    const confirmed = await confirmDestructive(
      t('challengeDetail.deleteTitle'),
      t('challengeDetail.deleteConfirm', { title: challenge.title }),
      t('common.delete'),
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await challengesApi.delete(challenge.id);
      router.back();
    } catch {
      showAlert(t('common.error'), t('challengeDetail.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  function handlePhotoPress(slot: ChallengeActivitySlot, photoUrl: string, completionId: string) {
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
      groupFamiliesCount: challenge?.group_families_count ?? null,
      status,
      rejectionReason,
      potentialPoints: computePotentialPoints(slot.activity, challenge?.is_featured ?? false, durationMinutes),
    });
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
      for (const [slotId, lc] of Object.entries(next)) {
        if (lc.completionId === completionId) { next[slotId] = { status: 'deleted' }; break; }
      }
      return next;
    });
  }

  function handlePhotoSelected(slotId: string, imageUri: string, mimeType: string, sharedToFeed: boolean, caption?: string, durationMinutes?: number | null) {
    if (!isOnline) { showAlert(t('common.offline'), t('common.noConnection')); return; }
    setActiveSlot(null);
    setLocalCompletions((prev) => ({ ...prev, [slotId]: { status: 'processing', durationMinutes } }));
    photosApi
      .upload(slotId, imageUri, mimeType, caption, sharedToFeed, durationMinutes, localDateString())
      .then((r) => startPolling(slotId, r.data.completion_id))
      .catch((e) => {
        setLocalCompletions((prev) => { const next = { ...prev }; delete next[slotId]; return next; });
        showAlert(t('common.error'), getGermanErrorMessage(e));
      });
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary }}>← {t('common.back')}</ThemedText>
        </Pressable>
        <ThemedText style={styles.headerTitle}>{t('challengeDetail.header')}</ThemedText>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.skeletonContainer}><SkeletonList count={3} rowHeight={120} /></View>
      ) : error ? (
        <View style={styles.center}>
          <ErrorState message={error} onRetry={() => router.back()} />
        </View>
      ) : challenge ? (
        <Animated.ScrollView entering={fadeIn()} contentContainerStyle={styles.content}>
          <View style={styles.titleRow}>
            <ThemedText type="title" style={{ flex: 1 }}>{challenge.title}</ThemedText>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(challenge.status) + '22' }]}>
              <ThemedText style={[styles.statusText, { color: statusColor(challenge.status) }]}>
                {statusLabels[challenge.status] ?? challenge.status}
              </ThemedText>
            </View>
          </View>

          <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>{t('challengeDetail.yourCollage')}</ThemedText>
          <CollageGrid
            slots={challenge.activities}
            groupFamiliesCount={challenge.group_families_count}
            localCompletions={localCompletions}
            onSlotPress={challenge.status === 'active' ? setActiveSlot : undefined}
            onPhotoPress={handlePhotoPress}
          />

          {/* Invite friends + collage privacy */}
          <View style={styles.socialRow}>
            <Pressable
              style={[styles.inviteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setInviteVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('challengeDetail.addFriends')}
            >
              <IconSymbol name="person.badge.plus" color={colors.primary} size={26} />
              <ThemedText style={[styles.inviteCardText, { color: colors.primary }]}>
                {t('challengeDetail.addFriends')}
              </ThemedText>
            </Pressable>

            <View style={[styles.privacyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.privacyHeader}>
                <ThemedText style={[styles.privacyTitle, { color: colors.onSurface }]}>
                  {t('challengeDetail.privateTitle')}
                </ThemedText>
                <Switch
                  value={challenge.is_private}
                  onValueChange={handlePrivacyToggle}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
              <ThemedText style={[styles.privacyDesc, { color: colors.muted }]}>
                {challenge.is_private ? t('challengeDetail.privateDesc') : t('challengeDetail.publicDesc')}
              </ThemedText>
            </View>
          </View>

          {participants.length > 0 && (
            <ThemedText style={[styles.participantsText, { color: colors.muted }]}>
              {t('challengeDetail.togetherWith', { names: participants.map((p) => p.display_name).join(', ') })}
            </ThemedText>
          )}

          {Platform.OS === 'web' && (
            <View style={styles.exportRow}>
              <Pressable
                style={[styles.exportButton, { borderColor: colors.primary }]}
                onPress={async () => {
                  setExportingPng(true);
                  try { await saveCollagePng(challenge.title, challenge.activities); }
                  catch { showAlert(t('common.error'), t('challengeDetail.exportFailed')); }
                  finally { setExportingPng(false); }
                }}
                disabled={exportingPng}
              >
                {exportingPng
                  ? <ActivityIndicator color={colors.primary} />
                  : <ThemedText style={[styles.exportText, { color: colors.primary }]}>{t('common.saveAsPng')}</ThemedText>}
              </Pressable>
              <Pressable
                style={[styles.exportButton, { borderColor: colors.accent }]}
                onPress={async () => {
                  setExportingPng(true);
                  try { await shareCollagePng(challenge.title, challenge.activities); }
                  catch { /* cancelled */ }
                  finally { setExportingPng(false); }
                }}
                disabled={exportingPng}
              >
                <ThemedText style={[styles.exportText, { color: colors.accent }]}>{t('common.share')}</ThemedText>
              </Pressable>
            </View>
          )}

          {challenge.group_families_count != null && (
            <View style={[styles.progressBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>{t('challengeDetail.groupProgress')}</ThemedText>
              <ThemedText style={{ color: colors.muted, fontSize: 13 }}>
                {t('challengeDetail.familiesInGroup', { count: challenge.group_families_count })}
              </ThemedText>
              <View style={styles.activityList}>
                {challenge.activities.map((slot) => (
                  <View key={slot.id} style={styles.activityProgressRow}>
                    <ThemedText style={[styles.activityProgressTitle, { color: colors.onSurface }]} numberOfLines={1}>
                      {slot.activity.title}
                    </ThemedText>
                    <ThemedText style={[styles.activityProgressCount, { color: colors.muted }]}>
                      {slot.families_completed_count ?? 0}/{challenge.group_families_count}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Group link */}
          {challenge.group_id && (
            <PressableScale
              style={[styles.groupLink, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => router.push({ pathname: '/group/[id]', params: { id: challenge.group_id! } } as any)}
            >
              <ThemedText style={[styles.groupLinkLabel, { color: colors.muted }]}>{t('challengeDetail.group')}</ThemedText>
              <ThemedText style={[styles.groupLinkName, { color: colors.primary }]}>
                {groupName ?? t('challengeDetail.viewGroup')}
              </ThemedText>
              {groupName && <ThemedText style={{ color: colors.muted, fontSize: 13 }}>→</ThemedText>}
            </PressableScale>
          )}

          {/* Delete challenge */}
          <Pressable
            style={styles.deleteButton}
            onPress={handleDeleteChallenge}
            disabled={deleting}
          >
            {deleting
              ? <ActivityIndicator color={colors.destructiveMuted} />
              : <ThemedText style={[styles.deleteText, { color: colors.destructiveMuted }]}>{t('challengeDetail.deleteButton')}</ThemedText>}
          </Pressable>
        </Animated.ScrollView>
      ) : null}

      <CompleteActivityModal
        visible={activeSlot !== null}
        slot={activeSlot}
        defaultShared={challenge != null && !challenge.is_private}
        onClose={() => setActiveSlot(null)}
        onSelfReported={handleSelfReported}
        onPhotoSelected={handlePhotoSelected}
      />

      {challenge && (
        <InviteFriendsModal
          visible={inviteVisible}
          challengeId={challenge.id}
          onClose={() => setInviteVisible(false)}
          onInvited={() => {
            challengesApi.getParticipants(challenge.id)
              .then((r) => setParticipants(r.data))
              .catch(() => {});
          }}
        />
      )}

      <ReuploadModal
        visible={reuploadTarget !== null}
        completionId={reuploadTarget?.completionId ?? null}
        rejectionReason={reuploadTarget?.rejectionReason ?? null}
        activityTitle={reuploadTarget?.title}
        onClose={() => setReuploadTarget(null)}
        onReuploaded={handleReuploaded}
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
  backButton: { minHeight: 44, justifyContent: 'center' },
  skeletonContainer: { flex: 1, padding: Spacing.screenHorizontal },
  content: { padding: Spacing.screenHorizontal, gap: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  statusBadge: { borderRadius: DEFAULT_RADII.sm, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  socialRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'stretch' },
  inviteCard: {
    flex: 1,
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  inviteCardText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  privacyCard: {
    flex: 1.6,
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  privacyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  privacyTitle: { fontSize: 16, fontWeight: '700' },
  privacyDesc: { fontSize: 12, lineHeight: 16 },
  participantsText: { fontSize: 13, marginTop: -Spacing.sm },
  exportRow: { flexDirection: 'row', gap: Spacing.sm },
  exportButton: {
    flex: 1,
    height: 40,
    borderRadius: DEFAULT_RADII.button,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportText: { fontSize: 14, fontWeight: '600' },
  progressBox: { borderRadius: DEFAULT_RADII.card, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  activityList: { gap: Spacing.xs },
  activityProgressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  activityProgressTitle: { flex: 1, fontSize: 13 },
  activityProgressCount: { fontSize: 13, fontWeight: '600' },
  groupLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.md,
  },
  groupLinkLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  groupLinkName: { flex: 1, fontSize: 15, fontWeight: '600' },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  deleteText: { fontSize: 13 },
});
