import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ErrorState } from '@/components/ui/error-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { completionsApi } from '@/lib/api';
import { getGermanErrorMessage } from '@/lib/utils/api-error';
import type { CompletionHistoryItem } from '@/lib/api';

const PAGE_SIZE = 20;

export default function ActivityHistoryScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
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
      const res = await completionsApi.getMyHistory(PAGE_SIZE, offset);
      const page = res.data;
      setItems((prev) => (reset ? page : [...prev, ...page]));
      offsetRef.current = offset + page.length;
      if (page.length < PAGE_SIZE) setHasMore(false);
    } catch (e) {
      setError(getGermanErrorMessage(e));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  function handleEndReached() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    load(false);
  }

  function renderItem({ item }: { item: CompletionHistoryItem }) {
    const date = new Date(item.completed_at).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    const isPhoto = item.status === 'ready' && item.photo_url;

    return (
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.thumbnail, { backgroundColor: colors.border }]}>
          {isPhoto ? (
            <Image
              source={{ uri: item.photo_url! }}
              style={styles.thumbnailImage}
              accessibilityLabel={`Photo for ${item.activity_title}`}
            />
          ) : (
            <ThemedText style={styles.checkmark}>✓</ThemedText>
          )}
        </View>
        <View style={styles.rowInfo}>
          <ThemedText style={styles.activityTitle} numberOfLines={1}>{item.activity_title}</ThemedText>
          <ThemedText style={[styles.challengeTitle, { color: colors.muted }]} numberOfLines={1}>
            {item.challenge_title}
          </ThemedText>
          <ThemedText style={[styles.date, { color: colors.muted }]}>{date}</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary, fontSize: 16 }}>← Back</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.title}>Activity History</ThemedText>
      </View>

      {loading ? (
        <View style={styles.skeletonContainer}><SkeletonList count={8} rowHeight={68} /></View>
      ) : error ? (
        <View style={styles.center}><ErrorState message={error} onRetry={() => load(true)} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <ThemedText style={[styles.empty, { color: colors.muted }]}>
              No completions yet — complete an activity to see it here.
            </ThemedText>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.md }} /> : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { marginBottom: Spacing.xs, minHeight: 44, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  skeletonContainer: { flex: 1, padding: Spacing.md },
  title: { fontSize: 24 },
  list: { padding: Spacing.md, gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.sm,
    gap: Spacing.md,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailImage: { width: 56, height: 56 },
  checkmark: { fontSize: 24, fontWeight: '700' },
  rowInfo: { flex: 1, gap: 2 },
  activityTitle: { fontSize: 15, fontWeight: '600' },
  challengeTitle: { fontSize: 13 },
  date: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: Spacing.xl, fontSize: 15 },
});
