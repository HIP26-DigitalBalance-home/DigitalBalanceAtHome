import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollageGrid, type LocalCompletion } from '@/components/collage-grid';
import { CompleteActivityModal } from '@/components/complete-activity-modal';
import { PhotoViewerModal } from '@/components/photo-viewer-modal';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  challengesApi,
  completionsApi,
  photosApi,
  type ChallengeActivitySlot,
  type ChallengeWithProgress,
} from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  active: '#4CAF82',
  upcoming: '#F4845F',
  completed: '#78716C',
};

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

export default function ChallengeDetailScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { id } = useLocalSearchParams<{ id: string }>();
  const [challenge, setChallenge] = useState<ChallengeWithProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [localCompletions, setLocalCompletions] = useState<Record<string, LocalCompletion>>({});
  const [activeSlot, setActiveSlot] = useState<ChallengeActivitySlot | null>(null);
  const [viewerPhoto, setViewerPhoto] = useState<{ url: string; completionId: string; title: string } | null>(null);
  const pollingRef = useRef<Record<string, { interval: ReturnType<typeof setInterval>; timeout: ReturnType<typeof setTimeout> }>>({});

  useEffect(() => {
    return () => {
      Object.values(pollingRef.current).forEach(({ interval, timeout }) => {
        clearInterval(interval);
        clearTimeout(timeout);
      });
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    challengesApi.getById(id)
      .then((r) => { if (!cancelled) setChallenge(r.data); })
      .catch(() => { if (!cancelled) setError('Could not load challenge.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

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
        if (res.data.status === 'ready') {
          stopPolling();
          setLocalCompletions((prev) => ({ ...prev, [slotId]: { status: 'ready', photoUrl: res.data.photo_url ?? null, completionId } }));
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

  function handleSelfReported(slotId: string) {
    setActiveSlot(null);
    completionsApi
      .createSelfReported({ challenge_activity_id: slotId })
      .then(() => setLocalCompletions((prev) => ({ ...prev, [slotId]: { status: 'self_reported' } })))
      .catch(() => {
        if (Platform.OS === 'web') window.alert('Could not mark as complete. Please try again.');
      });
  }

  function handlePhotoPress(_slot: ChallengeActivitySlot, photoUrl: string, completionId: string) {
    setViewerPhoto({ url: photoUrl, completionId, title: _slot.activity.title });
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

  function handlePhotoSelected(slotId: string, imageUri: string, mimeType: string) {
    setActiveSlot(null);
    setLocalCompletions((prev) => ({ ...prev, [slotId]: { status: 'processing' } }));
    photosApi
      .upload(slotId, imageUri, mimeType)
      .then((r) => startPolling(slotId, r.data.completion_id))
      .catch(() => {
        setLocalCompletions((prev) => { const next = { ...prev }; delete next[slotId]; return next; });
        if (Platform.OS === 'web') window.alert('Photo upload failed. Please try again.');
      });
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

          <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>YOUR COLLAGE</ThemedText>
          <CollageGrid
            slots={challenge.activities}
            groupFamiliesCount={challenge.group_families_count}
            localCompletions={localCompletions}
            onSlotPress={challenge.status === 'active' ? setActiveSlot : undefined}
            onPhotoPress={handlePhotoPress}
          />

          {challenge.group_families_count != null && (
            <View style={[styles.progressBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>GROUP PROGRESS</ThemedText>
              <ThemedText style={{ color: colors.muted, fontSize: 13 }}>
                {challenge.group_families_count} {challenge.group_families_count === 1 ? 'family' : 'families'} in this group.
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

      <CompleteActivityModal
        visible={activeSlot !== null}
        slot={activeSlot}
        onClose={() => setActiveSlot(null)}
        onSelfReported={handleSelfReported}
        onPhotoSelected={handlePhotoSelected}
      />

      <PhotoViewerModal
        visible={viewerPhoto !== null}
        photoUrl={viewerPhoto?.url ?? null}
        completionId={viewerPhoto?.completionId ?? null}
        activityTitle={viewerPhoto?.title ?? ''}
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
