import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { groupsApi } from '@/lib/api';

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  is_admin: boolean;
  members: Array<{
    family_id: string;
    family_name: string | null;
    admin_user_ids: string[];
    joined_at: string;
  }>;
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = Colors[useColorScheme() ?? 'light'];
  const { currentUser } = useAuth();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  function handleRemoveFamily(familyId: string) {
    Alert.alert(
      'Remove family',
      'Are you sure you want to remove this family from the group?',
      [
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
      ]
    );
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary }}>← Back</ThemedText>
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText type="defaultSemiBold" style={styles.headerTitle} numberOfLines={1}>{group.name}</ThemedText>
          {group.is_admin && (
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
        ListHeaderComponent={
          group.is_admin ? (
            <View style={[styles.adminPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>ADMIN CONTROLS</ThemedText>
              <Pressable
                style={[styles.adminButton, { borderColor: colors.primary }]}
                onPress={handleGenerateInvite}>
                <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Generate invite link</ThemedText>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.memberRow, { borderColor: colors.border }]}>
            <View style={styles.memberInfo}>
              <ThemedText style={styles.familyName}>
                {item.family_name ?? 'Family'}
              </ThemedText>
              <ThemedText style={[styles.joinedAt, { color: colors.muted }]}>
                Joined {new Date(item.joined_at).toLocaleDateString()}
              </ThemedText>
            </View>
            {group.is_admin && (
              <Pressable
                style={[styles.removeButton, { borderColor: colors.destructive }]}
                onPress={() => handleRemoveFamily(item.family_id)}>
                <ThemedText style={{ color: colors.destructive, fontSize: 13 }}>Remove</ThemedText>
              </Pressable>
            )}
          </View>
        )}
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
  adminPanel: {
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  adminButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  memberInfo: { flex: 1 },
  familyName: { fontSize: 15, fontWeight: '500' },
  joinedAt: { fontSize: 12, marginTop: 2 },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
});
