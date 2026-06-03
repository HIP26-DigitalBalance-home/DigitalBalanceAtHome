import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { challengesApi, groupsApi, type ChallengeSummary } from '@/lib/api';

interface Parent {
  user_id: string;
  display_name: string;
  is_group_admin: boolean;
}

interface GroupMember {
  family_id: string;
  family_name: string | null;
  joined_at: string;
  parents: Parent[];
}

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  is_admin: boolean;
  members: GroupMember[];
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = Colors[useColorScheme() ?? 'light'];
  const { currentUser } = useAuth();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupChallenges, setGroupChallenges] = useState<ChallengeSummary[]>([]);

  const fetchGroup = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await groupsApi.getGroup(id);
      setGroup(res.data);
    } catch {
      setError('Failed to load group');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchGroup(); }, [fetchGroup]);

  useEffect(() => {
    if (!id) return;
    challengesApi.getMy('active')
      .then((r) => {
        const forThisGroup = r.data.filter((c) => c.group_id === id);
        setGroupChallenges(forThisGroup);
      })
      .catch(() => {});
  }, [id]);

  async function handleGenerateInvite() {
    if (!id) return;
    try {
      const res = await groupsApi.postGroupInvite(id);
      const url: string = res.data.invite_url;
      await Clipboard.setStringAsync(url);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(url, { dialogTitle: 'Invite to group' });
      } else {
        Alert.alert('Link copied', 'Share this link to invite families:\n\n' + url);
      }
    } catch {
      Alert.alert('Error', 'Failed to generate invite link');
    }
  }

  async function handleRemoveFamily(familyId: string, familyName: string | null) {
    const message = `Remove "${familyName ?? 'this family'}" from the group?`;

    if (Platform.OS === 'web') {
      // Alert.alert callbacks are not supported on web — use window.confirm
      if (!window.confirm(message)) return;
      try {
        await groupsApi.removeGroupMember(id!, familyId);
        fetchGroup();
      } catch {
        window.alert('Failed to remove family. Please try again.');
      }
      return;
    }

    Alert.alert('Remove family', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await groupsApi.removeGroupMember(id!, familyId);
            fetchGroup();
          } catch {
            Alert.alert('Error', 'Failed to remove family');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (error || !group) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ThemedText style={{ color: colors.destructive }}>{error ?? 'Group not found'}</ThemedText>
          <Pressable onPress={fetchGroup}><ThemedText style={{ color: colors.primary }}>Retry</ThemedText></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Derive admin status from both the server flag and the parents data (fallback)
  const isAdmin = group.is_admin ||
    group.members.some(m => m.parents.some(p => p.user_id === currentUser?.id && p.is_group_admin));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary }}>← Back</ThemedText>
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText type="defaultSemiBold" style={styles.headerTitle} numberOfLines={1}>
            {group.name}
          </ThemedText>
          {isAdmin && (
            <View style={[styles.adminBadge, { backgroundColor: colors.accent }]}>
              <ThemedText style={styles.adminBadgeText}>Admin</ThemedText>
            </View>
          )}
        </View>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={group.members}
        keyExtractor={(m) => m.family_id}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          <>
            {/* Feed link */}
            <Pressable
              style={[styles.feedButton, { borderColor: colors.primary, backgroundColor: colors.surface }]}
              onPress={() => router.push({ pathname: '/group-feed/[id]', params: { id: id! } } as any)}
            >
              <ThemedText style={{ color: colors.primary, fontWeight: '600', fontSize: 15 }}>
                View group feed
              </ThemedText>
            </Pressable>

            {groupChallenges.length > 0 ? (
              <View style={[styles.challengesPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>ACTIVE CHALLENGES</ThemedText>
                {groupChallenges.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: c.id } } as any)}
                    style={[styles.challengeRow, { borderColor: colors.border }]}
                  >
                    <ThemedText style={{ color: colors.onSurface, fontWeight: '600' }}>{c.title}</ThemedText>
                    <ThemedText style={{ color: colors.muted, fontSize: 12 }}>{c.start_date} → {c.end_date}</ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        }
        ListHeaderComponent={
          isAdmin ? (
            <View style={[styles.adminPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>ADMIN CONTROLS</ThemedText>
              <Pressable
                style={[styles.adminButton, { borderColor: colors.primary }]}
                onPress={handleGenerateInvite}>
                <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>
                  Generate invite link
                </ThemedText>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          // True if this family contains the current user — never show remove for own family
          const isOwnFamily = item.parents.some(p => p.user_id === currentUser?.id);
          return (
          <View style={[styles.familyCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.familyHeader}>
              <View style={styles.familyTitleRow}>
                <ThemedText style={styles.familyName}>
                  {item.family_name ?? 'Unnamed family'}{isOwnFamily ? ' (you)' : ''}
                </ThemedText>
                <ThemedText style={[styles.joinedAt, { color: colors.muted }]}>
                  Joined {new Date(item.joined_at).toLocaleDateString()}
                </ThemedText>
              </View>
              {isAdmin && !isOwnFamily && (
                <Pressable
                  style={[styles.removeButton, { borderColor: colors.destructive }]}
                  onPress={() => handleRemoveFamily(item.family_id, item.family_name)}>
                  <ThemedText style={{ color: colors.destructive, fontSize: 13 }}>Remove</ThemedText>
                </Pressable>
              )}
            </View>

            {item.parents.length > 0 && (
              <View style={[styles.parentsList, { borderTopColor: colors.border }]}>
                {item.parents.map((parent) => (
                  <View key={parent.user_id} style={styles.parentRow}>
                    <ThemedText style={[styles.parentName, { color: colors.muted }]}>
                      {parent.display_name}
                    </ThemedText>
                    {parent.is_group_admin && (
                      <View style={[styles.parentAdminBadge, { backgroundColor: colors.accent }]}>
                        <ThemedText style={styles.parentAdminText}>Admin</ThemedText>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { width: 72 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { fontSize: 17 },
  adminBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  adminBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
  adminPanel: { padding: Spacing.md, borderRadius: 12, borderWidth: 1, marginBottom: Spacing.sm },
  adminButton: { height: 44, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  feedButton: { height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  challengesPanel: { borderRadius: 12, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm, marginTop: Spacing.sm },
  challengeRow: { borderRadius: 8, borderWidth: 1, padding: Spacing.sm, gap: 2 },
  familyCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  familyHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  familyTitleRow: { flex: 1 },
  familyName: { fontSize: 15, fontWeight: '600' },
  joinedAt: { fontSize: 12, marginTop: 2 },
  removeButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  parentsList: { borderTopWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  parentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: Spacing.sm },
  parentName: { flex: 1, fontSize: 14 },
  parentAdminBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  parentAdminText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
