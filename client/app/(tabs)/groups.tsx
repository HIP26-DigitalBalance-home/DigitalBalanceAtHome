import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { groupsApi } from '@/lib/api';

interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  is_admin: boolean;
}

export default function GroupsScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await groupsApi.getMyGroups();
      setGroups(res.data);
    } catch {
      setError('Failed to load groups');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

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
          <Pressable onPress={() => fetchGroups()} style={styles.retryButton}>
            <ThemedText style={{ color: colors.primary }}>Retry</ThemedText>
          </Pressable>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.center}>
          <ThemedText style={styles.emptyIcon}>👨‍👩‍👧</ThemedText>
          <ThemedText type="title" style={styles.emptyTitle}>No groups yet</ThemedText>
          <ThemedText style={[styles.emptyBody, { color: colors.muted }]}>
            Create a group with your child's class or join one with an invite link.
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
          data={groups}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchGroups(true)} />
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(`/group/${item.id}` as any)}>
              <View style={styles.cardLeft}>
                <ThemedText style={styles.cardName}>{item.name}</ThemedText>
                {item.description && (
                  <ThemedText style={[styles.cardDesc, { color: colors.muted }]} numberOfLines={1}>
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
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardLeft: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '600' },
  cardDesc: { fontSize: 13, marginTop: 2 },
  adminBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  adminBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
