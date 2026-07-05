import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ErrorState } from '@/components/ui/error-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';
import { fadeIn } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { completionsApi } from '@/lib/api';
import { getGermanErrorMessage } from '@/lib/utils/api-error';
import type { CompletionHistoryItem } from '@/lib/api';

const PAGE_SIZE = 20;

export default function ActivityHistoryScreen() {
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<CompletionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const load = useCallback(async (reset = false) => {
    if (reset) {
      offsetRef.current = 0;
      setHasMore(true);
      setError(null);
    }
    const offset = offsetRef.current;
    try {
      const response = await completionsApi.getMyHistory(PAGE_SIZE, offset);
      const page = response.data;
      setItems((previous) => (reset ? page : [...previous, ...page]));
      offsetRef.current = offset + page.length;
      if (page.length < PAGE_SIZE) setHasMore(false);
    } catch (reason) {
      setError(getGermanErrorMessage(reason));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [i18n.language]);

  useEffect(() => { load(true); }, [load]);

  function handleEndReached() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    load(false);
  }

  function renderItem({ item }: { item: CompletionHistoryItem }) {
    const displayDate = new Date(item.completed_at).toLocaleDateString(i18n.language, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    const hasPhoto = item.status !== 'processing' && item.status !== 'self_reported' && item.photo_url;
    return (
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.thumbnail, { backgroundColor: colors.border }]}>
          {hasPhoto ? (
            <Image source={{ uri: item.photo_url! }} style={styles.thumbnailImage} accessibilityLabel={item.activity_title} />
          ) : <ThemedText style={styles.checkmark}>✓</ThemedText>}
        </View>
        <View style={styles.rowInfo}>
          <ThemedText style={styles.activityTitle} numberOfLines={1}>{item.activity_title}</ThemedText>
          <ThemedText style={[styles.challengeTitle, { color: colors.muted }]} numberOfLines={1}>{item.challenge_title}</ThemedText>
          <ThemedText style={[styles.date, { color: colors.muted }]}>{displayDate}</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
          <ThemedText style={{ color: colors.primary, fontSize: 16 }}>← {t('common.back')}</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.title}>{t('activityHistory.title')}</ThemedText>
      </View>
      {loading ? (
        <View style={styles.skeletonContainer}><SkeletonList count={8} rowHeight={68} /></View>
      ) : error ? (
        <View style={styles.center}><ErrorState message={error} onRetry={() => load(true)} /></View>
      ) : (
        <Animated.View entering={fadeIn()} style={{ flex: 1 }}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={<ThemedText style={[styles.empty, { color: colors.muted }]}>{t('activityHistory.empty')}</ThemedText>}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.md }} /> : null}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.screenHorizontal, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  backButton: { marginBottom: Spacing.xs, minHeight: 44, justifyContent: 'center' },
  title: { fontSize: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  skeletonContainer: { flex: 1, padding: Spacing.md },
  list: { padding: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: Spacing.sm, gap: Spacing.sm, minHeight: 76 },
  thumbnail: { width: 56, height: 56, borderRadius: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbnailImage: { width: '100%', height: '100%' },
  checkmark: { fontSize: 25, fontWeight: '700' },
  rowInfo: { flex: 1, justifyContent: 'center', gap: 2 },
  activityTitle: { fontSize: 15, fontWeight: '700' },
  challengeTitle: { fontSize: 12 },
  date: { fontSize: 11 },
  empty: { textAlign: 'center', marginTop: Spacing.xl },
});
