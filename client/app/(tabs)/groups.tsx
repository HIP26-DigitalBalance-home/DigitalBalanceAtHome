import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { groupsApi, type FeedEntry, type GroupSummary } from '@/lib/api';

type Segment = 'feed' | 'groups';

export default function GroupsScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [segment, setSegment] = useState<Segment>('feed');

  // --- groups list state ---
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  // --- aggregated feed state ---
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else {
      setGroupsLoading(true);
      setFeedLoading(true);
    }
    setGroupsError(null);
    setFeedError(null);

    try {
      const res = await groupsApi.getMyGroups();
      const fetchedGroups: GroupSummary[] = res.data;
      setGroups(fetchedGroups);

      try {
        const entries = await groupsApi.getAggregatedFeed(fetchedGroups);
        setFeedEntries(entries);
      } catch {
        setFeedError('Failed to load feed');
      } finally {
        setFeedLoading(false);
      }
    } catch {
      setGroupsError('Failed to load groups');
      setFeedError('Failed to load feed');
      setFeedLoading(false);
    } finally {
      setGroupsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  function renderFeedEntry({ item }: { item: FeedEntry }) {
    return (
      <View style={[styles.feedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.checkPlaceholder, { backgroundColor: colors.accent + '22' }]}>
            <ThemedText style={[styles.checkIcon, { color: colors.accent }]}>✓</ThemedText>
          </View>
        )}
        <View style={styles.feedCardContent}>
          <ThemedText style={[styles.activityTitle, { color: colors.onSurface }]} numberOfLines={1}>
            {item.activity_title}
          </ThemedText>
          <ThemedText style={[styles.familyDate, { color: colors.muted }]}>
            {item.family_name ?? 'A family'} · {new Date(item.completed_at).toLocaleDateString()}
          </ThemedText>
          {item.caption ? (
            <ThemedText style={[styles.caption, { color: colors.onSurface }]} numberOfLines={2}>
              {item.caption}
            </ThemedText>
          ) : null}
          {item.group_id && item.group_name ? (
            <Pressable
              onPress={() => router.push(`/group/${item.group_id}` as any)}
              style={styles.groupPill}>
              <ThemedText style={[styles.groupPillText, { color: colors.primary }]}>
                {item.group_name}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const noGroups = !groupsLoading && groups.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText type="title" style={styles.title}>Groups</ThemedText>
        <Pressable
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/create-group' as any)}>
          <ThemedText style={[styles.addButtonText, { color: colors.buttonText }]}>+</ThemedText>
        </Pressable>
      </View>

      {/* Segment control */}
      <View style={[styles.segmentRow, { borderBottomColor: colors.border }]}>
        {(['feed', 'groups'] as Segment[]).map((seg) => (
          <Pressable
            key={seg}
            onPress={() => setSegment(seg)}
            style={[
              styles.segmentTab,
              segment === seg && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}>
            <ThemedText
              style={[
                styles.segmentLabel,
                { color: segment === seg ? colors.primary : colors.muted },
              ]}>
              {seg === 'feed' ? 'Feed' : 'My Groups'}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* Feed segment */}
      {segment === 'feed' && (
        <>
          {feedLoading && !refreshing ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : feedError ? (
            <View style={styles.center}>
              <ThemedText style={{ color: colors.destructive }}>{feedError}</ThemedText>
              <Pressable onPress={() => fetchAll()} style={styles.retryButton}>
                <ThemedText style={{ color: colors.primary }}>Retry</ThemedText>
              </Pressable>
            </View>
          ) : noGroups ? (
            <View style={styles.center}>
              <ThemedText style={{ fontSize: 40 }}>👨‍👩‍👧</ThemedText>
              <ThemedText type="title" style={styles.emptyTitle}>No groups yet</ThemedText>
              <ThemedText style={[styles.emptyBody, { color: colors.muted }]}>
                Create a group with your child&apos;s class or join one with an invite link. Their
                activity feed will appear here.
              </ThemedText>
              <View style={styles.emptyActions}>
                <Pressable
                  style={[styles.ctaButton, { backgroundColor: colors.primary }]}
                  onPress={() => router.push('/create-group' as any)}>
                  <ThemedText style={[styles.ctaText, { color: colors.buttonText }]}>
                    Create a group
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.ctaButton,
                    { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
                  ]}
                  onPress={() => router.push('/join-group' as any)}>
                  <ThemedText style={[styles.ctaText, { color: colors.onSurface }]}>
                    Join with a code
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : feedEntries.length === 0 ? (
            <View style={styles.center}>
              <ThemedText style={[styles.emptyBody, { color: colors.muted, textAlign: 'center' }]}>
                No shared completions yet.{'\n'}Complete an activity and share it to a group feed!
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={feedEntries}
              keyExtractor={(e) => e.id}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} />
              }
              renderItem={renderFeedEntry}
            />
          )}
        </>
      )}

      {/* My Groups segment */}
      {segment === 'groups' && (
        <>
          {groupsLoading && !refreshing ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : groupsError ? (
            <View style={styles.center}>
              <ThemedText style={{ color: colors.destructive }}>{groupsError}</ThemedText>
              <Pressable onPress={() => fetchAll()} style={styles.retryButton}>
                <ThemedText style={{ color: colors.primary }}>Retry</ThemedText>
              </Pressable>
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.center}>
              <ThemedText style={{ fontSize: 40 }}>👨‍👩‍👧</ThemedText>
              <ThemedText type="title" style={styles.emptyTitle}>No groups yet</ThemedText>
              <ThemedText style={[styles.emptyBody, { color: colors.muted }]}>
                Create a group with your child&apos;s class or join one with an invite link.
              </ThemedText>
              <View style={styles.emptyActions}>
                <Pressable
                  style={[styles.ctaButton, { backgroundColor: colors.primary }]}
                  onPress={() => router.push('/create-group' as any)}>
                  <ThemedText style={[styles.ctaText, { color: colors.buttonText }]}>
                    Create a group
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.ctaButton,
                    { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
                  ]}
                  onPress={() => router.push('/join-group' as any)}>
                  <ThemedText style={[styles.ctaText, { color: colors.onSurface }]}>
                    Join with a code
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <FlatList
              data={groups}
              keyExtractor={(g) => g.id}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} />
              }
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => router.push(`/group/${item.id}` as any)}>
                  <View style={styles.groupCardLeft}>
                    <ThemedText style={styles.groupCardName}>{item.name}</ThemedText>
                    {item.description && (
                      <ThemedText
                        style={[styles.groupCardDesc, { color: colors.muted }]}
                        numberOfLines={1}>
                        {item.description}
                      </ThemedText>
                    )}
                  </View>
                  {item.is_admin && (
                    <View style={[styles.adminBadge, { backgroundColor: colors.accent }]}>
                      <ThemedText style={styles.adminBadgeText}>Admin</ThemedText>
                    </View>
                  )}
                </Pressable>
              )}
            />
          )}
        </>
      )}
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
  title: { fontSize: 28 },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { fontSize: 22, fontWeight: '400', lineHeight: 28 },
  segmentRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.screenHorizontal,
  },
  segmentTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  segmentLabel: { fontSize: 15, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  retryButton: { padding: Spacing.sm },
  emptyTitle: { textAlign: 'center' },
  emptyBody: { fontSize: 15, lineHeight: 22 },
  emptyActions: { width: '100%', gap: Spacing.sm, marginTop: Spacing.md },
  ctaButton: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 16, fontWeight: '600' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  // feed card
  feedCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 4 / 3 },
  checkPlaceholder: { width: '100%', height: 80, alignItems: 'center', justifyContent: 'center' },
  checkIcon: { fontSize: 32, fontWeight: '700' },
  feedCardContent: { padding: Spacing.md, gap: 4 },
  activityTitle: { fontSize: 15, fontWeight: '600' },
  familyDate: { fontSize: 13 },
  caption: { fontSize: 14, marginTop: 2 },
  groupPill: { marginTop: 6, alignSelf: 'flex-start' },
  groupPillText: { fontSize: 13, fontWeight: '600' },
  // group card
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  groupCardLeft: { flex: 1 },
  groupCardName: { fontSize: 16, fontWeight: '600' },
  groupCardDesc: { fontSize: 13, marginTop: 2 },
  adminBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  adminBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
