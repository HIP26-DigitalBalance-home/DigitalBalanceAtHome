import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { groupsApi, type FeedEntry } from '@/lib/api';

const PAGE_SIZE = 20;

export default function GroupFeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    groupsApi.getGroupFeed(id, PAGE_SIZE, 0)
      .then((r) => {
        if (!cancelled) {
          setEntries(r.data);
          setHasMore(r.data.length >= PAGE_SIZE);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]));

  function loadMore() {
    if (!id || loadingMore || !hasMore) return;
    setLoadingMore(true);
    groupsApi.getGroupFeed(id, PAGE_SIZE, entries.length)
      .then((r) => {
        setEntries((prev) => [...prev, ...r.data]);
        setHasMore(r.data.length >= PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }

  function renderEntry({ item }: { item: FeedEntry }) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.checkPlaceholder, { backgroundColor: colors.accent + '22' }]}>
            <ThemedText style={[styles.checkIcon, { color: colors.accent }]}>✓</ThemedText>
          </View>
        )}
        <View style={styles.cardContent}>
          <ThemedText style={[styles.activityTitle, { color: colors.onSurface }]} numberOfLines={1}>
            {item.activity_title}
          </ThemedText>
          <ThemedText style={[styles.familyName, { color: colors.muted }]}>
            {item.family_name ?? 'A family'} · {new Date(item.completed_at).toLocaleDateString()}
          </ThemedText>
          {item.caption ? (
            <ThemedText style={[styles.caption, { color: colors.onSurface }]} numberOfLines={2}>
              {item.caption}
            </ThemedText>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary }}>← Back</ThemedText>
        </Pressable>
        <ThemedText style={styles.headerTitle}>Group Feed</ThemedText>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : entries.length === 0 ? (
        <View style={styles.center}>
          <ThemedText style={{ color: colors.muted, fontSize: 15, textAlign: 'center' }}>
            No shared completions yet.{'\n'}Complete an activity and share it to the group feed!
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          renderItem={renderEntry}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.md }} /> : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { width: 72 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 4 / 3 },
  checkPlaceholder: { width: '100%', height: 80, alignItems: 'center', justifyContent: 'center' },
  checkIcon: { fontSize: 32, fontWeight: '700' },
  cardContent: { padding: Spacing.md, gap: 4 },
  activityTitle: { fontSize: 15, fontWeight: '600' },
  familyName: { fontSize: 13 },
  caption: { fontSize: 14, marginTop: 4 },
});
