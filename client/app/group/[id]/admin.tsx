import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';
import { fadeIn } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import { rewardsApi, type PendingVerificationItem } from '@/lib/api';
import { getGermanErrorMessage } from '@/lib/utils/api-error';
import { showAlert } from '@/lib/utils/alert';

export default function VerificationQueueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, radii } = useAppTheme();
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<PendingVerificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // completion_id currently in inline-reject mode, and its draft reason
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  // completion_id with an approve/reject request in flight
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await rewardsApi.getVerificationQueue(id);
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch (e) {
      setError(getGermanErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchQueue(); }, [fetchQueue, i18n.language]);

  function removeItem(completionId: string) {
    setItems((prev) => prev.filter((i) => i.completion_id !== completionId));
    setTotal((prev) => Math.max(0, prev - 1));
  }

  async function handleApprove(item: PendingVerificationItem) {
    if (!id || actingId) return;
    setActingId(item.completion_id);
    try {
      await rewardsApi.approvePhoto(id, item.completion_id);
      removeItem(item.completion_id);
    } catch (e) {
      showAlert(t('common.error'), getGermanErrorMessage(e));
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(item: PendingVerificationItem) {
    if (!id || actingId) return;
    setActingId(item.completion_id);
    try {
      await rewardsApi.rejectPhoto(id, item.completion_id, rejectReason);
      removeItem(item.completion_id);
      setRejectingId(null);
      setRejectReason('');
    } catch (e) {
      showAlert(t('common.error'), getGermanErrorMessage(e));
    } finally {
      setActingId(null);
    }
  }

  function renderItem({ item }: { item: PendingVerificationItem }) {
    const isRejecting = rejectingId === item.completion_id;
    const isActing = actingId === item.completion_id;
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {item.photo_url && (
          <ImageWithFallback
            uri={item.photo_url}
            completionId={item.completion_id}
            style={[styles.photo, { borderRadius: radii.sm }]}
            resizeMode="cover"
            accessibilityLabel={item.activity_title}
          />
        )}

        <ThemedText style={[styles.activityTitle, { color: colors.onSurface }]}>{item.activity_title}</ThemedText>
        <ThemedText style={[styles.meta, { color: colors.muted }]}>{item.family_name}</ThemedText>
        <ThemedText style={[styles.meta, { color: colors.muted }]}>
          {item.duration_minutes != null
            ? t('verificationQueue.durationReported', { count: item.duration_minutes })
            : t('verificationQueue.noDuration')}
          {'  ·  '}
          {t('verificationQueue.submittedAt', { date: new Date(item.submitted_at).toLocaleDateString() })}
        </ThemedText>

        {isRejecting ? (
          <>
            <TextInput
              style={[
                styles.reasonInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderRadius: radii.input,
                  color: colors.onSurface,
                },
              ]}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder={t('verificationQueue.reasonPlaceholder')}
              placeholderTextColor={colors.muted}
              multiline
              maxLength={300}
              autoFocus
              textAlignVertical="top"
            />
            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.button }]}
                onPress={() => { setRejectingId(null); setRejectReason(''); }}
                disabled={isActing}
                accessibilityRole="button"
              >
                <ThemedText style={[styles.buttonText, { color: colors.muted }]}>{t('common.cancel')}</ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.button,
                  {
                    backgroundColor: colors.destructive,
                    borderColor: colors.destructive,
                    borderRadius: radii.button,
                  },
                ]}
                onPress={() => handleReject(item)}
                disabled={isActing}
                accessibilityRole="button"
              >
                {isActing
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <ThemedText style={[styles.buttonText, { color: '#FFFFFF' }]}>{t('verificationQueue.confirmReject')}</ThemedText>}
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.destructive, borderRadius: radii.button }]}
              onPress={() => { setRejectingId(item.completion_id); setRejectReason(''); }}
              disabled={isActing}
              accessibilityRole="button"
            >
              <ThemedText style={[styles.buttonText, { color: colors.destructive }]}>{t('verificationQueue.reject')}</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: colors.primary, borderColor: colors.primary, borderRadius: radii.button }]}
              onPress={() => handleApprove(item)}
              disabled={isActing}
              accessibilityRole="button"
            >
              {isActing
                ? <ActivityIndicator color={colors.buttonText} />
                : <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>{t('verificationQueue.approve')}</ThemedText>}
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary }}>← {t('common.back')}</ThemedText>
        </Pressable>
        <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
          {t('verificationQueue.title')}
        </ThemedText>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.skeletonContainer}><SkeletonList count={3} rowHeight={220} /></View>
      ) : error ? (
        <View style={styles.center}>
          <ErrorState message={error} onRetry={fetchQueue} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <ThemedText style={{ color: colors.muted, textAlign: 'center' }}>
            {t('verificationQueue.empty')}
          </ThemedText>
        </View>
      ) : (
        <Animated.View entering={fadeIn()} style={{ flex: 1 }}>
          <FlatList
            data={items}
            keyExtractor={(i) => i.completion_id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <ThemedText style={[styles.countLabel, { color: colors.muted }]}>
                {t('verificationQueue.pendingCount', { count: total })}
              </ThemedText>
            }
            renderItem={renderItem}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { width: 72, minHeight: 44, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, textAlign: 'center' },
  skeletonContainer: { flex: 1, padding: Spacing.md },
  list: { padding: Spacing.md, gap: Spacing.md },
  countLabel: { fontSize: 13 },
  card: { borderRadius: DEFAULT_RADII.card, borderWidth: 1, padding: Spacing.md, gap: Spacing.xs },
  photo: { width: '100%', height: 200, marginBottom: Spacing.xs },
  activityTitle: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
  reasonInput: {
    minHeight: 64,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  buttonRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  button: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '600' },
});
