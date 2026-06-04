import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { groupsApi, type FeedEntry, type GroupSummary } from '@/lib/api';

export default function GroupsScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accordionOpen, setAccordionOpen] = useState(false);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const groupsRes = await groupsApi.getMyGroups();
      setGroups(groupsRes.data);
      if (groupsRes.data.length > 0) {
        setFeedLoading(true);
        const entries = await groupsApi.getAggregatedFeed(groupsRes.data, 50);
        setFeed(entries);
        setFeedLoading(false);
      } else {
        setFeed([]);
      }
    } catch {
      setError('Failed to load groups');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  function renderAccordion() {
    return (
      <View style={[styles.accordion, { borderBottomColor: colors.border }]}>
        <Pressable
          style={styles.accordionHeader}
          onPress={() => setAccordionOpen((o) => !o)}>
          <ThemedText style={styles.accordionTitle}>Your Groups</ThemedText>
          <ThemedText style={[styles.accordionChevron, { color: colors.muted }]}>
            {accordionOpen ? '▴' : '▾'}
          </ThemedText>
        </Pressable>

        {accordionOpen && (
          <View style={styles.accordionBody}>
            {groups.map((g) => (
              <Pressable
                key={g.id}
                style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push(`/group/${g.id}` as any)}>
                <View style={styles.groupCardLeft}>
                  <ThemedText style={styles.groupCardName}>{g.name}</ThemedText>
                  {g.description && (
                    <ThemedText style={[styles.groupCardDesc, { color: colors.muted }]} numberOfLines={1}>
                      {g.description}
                    </ThemedText>
                  )}
                </View>
                {g.is_admin && (
                  <View style={[styles.adminBadge, { backgroundColor: colors.accent }]}>
                    <ThemedText style={styles.adminBadgeText}>Admin</ThemedText>
                  </View>
                )}
              </Pressable>
            ))}
            <Pressable
              style={styles.joinButton}
              onPress={() => router.push('/join-group' as any)}>
              <ThemedText style={{ color: colors.primary, fontWeight: '500' }}>
                Join with a code
              </ThemedText>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  function renderFeedEmpty() {
    if (feedLoading) {
      return (
        <View style={styles.feedEmptyCenter}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    return (
      <View style={styles.feedEmptyCenter}>
        <ThemedText style={[styles.feedEmptyText, { color: colors.muted }]}>
          No shared completions yet.{'\n'}Complete an activity and share it to a group feed!
        </ThemedText>
      </View>
    );
  }

  function renderFeedEntry({ item }: { item: FeedEntry }) {
    return (
      <View style={[styles.feedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.feedPhoto} resizeMode="cover" />
        ) : (
          <View style={[styles.checkPlaceholder, { backgroundColor: colors.accent + '22' }]}>
            <ThemedText style={[styles.checkIcon, { color: colors.accent }]}>✓</ThemedText>
          </View>
        )}
        <View style={styles.feedCardContent}>
          <Text style={[styles.attribution, { color: colors.muted }]}>
            <Text>{item.family_name ?? 'A family'} in </Text>
            {item.group_id ? (
              <Text
                style={{ color: colors.primary }}
                onPress={() => router.push(`/group/${item.group_id}` as any)}>
                {item.group_name ?? 'group'}
              </Text>
            ) : (
              <Text>{item.group_name ?? 'group'}</Text>
            )}
            <Text> · {new Date(item.completed_at).toLocaleDateString()}</Text>
          </Text>
          <ThemedText style={[styles.activityTitle, { color: colors.onSurface }]} numberOfLines={1}>
            {item.activity_title}
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
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText type="title" style={styles.title}>Groups</ThemedText>
        <Pressable
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/create-group' as any)}>
          <ThemedText style={[styles.addButtonText, { color: colors.buttonText }]}>+</ThemedText>
        </Pressable>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText style={{ color: colors.destructive }}>{error}</ThemedText>
          <Pressable onPress={() => fetchAll()} style={styles.retryButton}>
            <ThemedText style={{ color: colors.primary }}>Retry</ThemedText>
          </Pressable>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.center}>
          <ThemedText style={styles.emptyIcon}>👨‍👩‍👧</ThemedText>
          <ThemedText type="title" style={styles.emptyTitle}>No groups yet</ThemedText>
          <ThemedText style={[styles.emptyBody, { color: colors.muted }]}>
            Create a group with your child&apos;s class or join one with an invite link.
          </ThemedText>
          <View style={styles.emptyActions}>
            <Pressable
              style={[styles.ctaButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/create-group' as any)}>
              <ThemedText style={[styles.ctaText, { color: colors.buttonText }]}>Create a group</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.ctaButton, { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border }]}
              onPress={() => router.push('/join-group' as any)}>
              <ThemedText style={[styles.ctaText, { color: colors.onSurface }]}>Join with a code</ThemedText>
            </Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(e) => e.id}
          renderItem={renderFeedEntry}
          ListHeaderComponent={renderAccordion}
          ListEmptyComponent={renderFeedEmpty}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} />
          }
        />
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  retryButton: { padding: Spacing.sm },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { textAlign: 'center' },
  emptyBody: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
  emptyActions: { width: '100%', gap: Spacing.sm, marginTop: Spacing.md },
  ctaButton: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 16, fontWeight: '600' },
  list: { paddingBottom: Spacing.md, gap: Spacing.sm },

  // Accordion
  accordion: { borderBottomWidth: 1, marginBottom: Spacing.md },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
  },
  accordionTitle: { fontSize: 16, fontWeight: '600' },
  accordionChevron: { fontSize: 13 },
  accordionBody: { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.md },
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
  joinButton: { alignItems: 'center', paddingVertical: Spacing.sm },

  // Feed entries
  feedCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginHorizontal: Spacing.md },
  feedPhoto: { width: '100%', aspectRatio: 4 / 3 },
  checkPlaceholder: { width: '100%', height: 80, alignItems: 'center', justifyContent: 'center' },
  checkIcon: { fontSize: 32, fontWeight: '700' },
  feedCardContent: { padding: Spacing.md, gap: 4 },
  attribution: { fontSize: 12 },
  activityTitle: { fontSize: 15, fontWeight: '600' },
  caption: { fontSize: 14, marginTop: 4 },

  // Feed empty
  feedEmptyCenter: { alignItems: 'center', padding: Spacing.xl, marginTop: Spacing.xl },
  feedEmptyText: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
});
