import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { onboardingApi, devApi, usersApi } from '@/lib/api';
import { apiClient } from '@/lib/api';
import type { ChildProfile } from '@/lib/api/onboarding';

const CITY_KEY = '@dba_city_preference';

interface FamilyMemberItem {
  user_id: string;
  display_name: string;
}

interface FamilyData {
  id: string;
  name: string | null;
  members: FamilyMemberItem[];
}

function ageFromDob(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}

export default function ProfileScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { currentUser, logout, updateCurrentUser } = useAuth();
  const router = useRouter();
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);
  const [city, setCity] = useState('');
  const [seeding, setSeeding] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [familiesRes, childrenRes, userRes] = await Promise.all([
        onboardingApi.getMyFamilies(),
        onboardingApi.getChildren(),
        usersApi.getMe(),
      ]);
      if (familiesRes.data.length > 0) setFamily(familiesRes.data[0]);
      setChildren(childrenRes.data);
      await updateCurrentUser(userRes.data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [updateCurrentUser]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get('/consents').catch(() => null),
      AsyncStorage.getItem(CITY_KEY),
    ]).then(([consentRes, storedCity]) => {
      if (!cancelled) {
        if (consentRes?.data?.location_consent) setLocationConsent(true);
        if (storedCity) setCity(storedCity);
      }
    });
    return () => { cancelled = true; };
  }, []);

  async function handleSeedDemo() {
    const confirmed = window.confirm(
      'Load demo data?\n\nThis will create a sample group, mock families, and example challenges. Safe to run again — demo data will be reset.',
    );
    if (!confirmed) return;
    setSeeding(true);
    try {
      await devApi.seed();
      window.alert('Demo data loaded! Pull to refresh your Home and Groups tabs.');
    } catch {
      window.alert('Failed to load demo data. Make sure the server has SEED_ENABLED=true.');
    } finally {
      setSeeding(false);
    }
  }

  async function handleLeaveFamily() {
    if (!family || !currentUser) return;
    const confirmed = window.confirm(`Leave "${family.name ?? 'your family'}"? You can rejoin with an invite link.`);
    if (!confirmed) return;
    setLeaving(true);
    try {
      await apiClient.delete(`/families/${family.id}/members/${currentUser.id}`);
      setFamily(null);
    } catch {
      window.alert('Failed to leave family. Please try again.');
    } finally {
      setLeaving(false);
    }
  }

  async function handleInviteToFamily() {
    if (!family) return;
    setInviting(true);
    try {
      const res = await apiClient.post(`/families/${family.id}/invites`);
      const url: string = res.data.invite_url;
      await Clipboard.setStringAsync(url);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(url, { dialogTitle: 'Invite to family' });
      } else {
        window.alert('Share this link to invite your partner:\n\n' + url);
      }
    } catch {
      window.alert('Failed to generate invite link');
    } finally {
      setInviting(false);
    }
  }

  const initials = currentUser?.display_name
    ? currentUser.display_name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText type="title" style={styles.title}>Profile</ThemedText>
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {/* Avatar + user info */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.avatarRow}>
                {currentUser?.profile_photo_url ? (
                  <Image
                    source={{ uri: currentUser.profile_photo_url }}
                    style={styles.avatar}
                    accessibilityLabel="Profile photo"
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                    <ThemedText style={styles.avatarInitials}>{initials}</ThemedText>
                  </View>
                )}
                <View style={styles.avatarInfo}>
                  <ThemedText style={styles.displayName}>{currentUser?.display_name ?? '—'}</ThemedText>
                  <ThemedText style={[styles.email, { color: colors.muted }]}>{currentUser?.email}</ThemedText>
                  <ThemedText style={[styles.points, { color: colors.accent }]}>
                    {currentUser?.points_balance ?? 0} pts
                  </ThemedText>
                </View>
              </View>

              <Pressable
                style={[styles.outlineButton, { borderColor: colors.primary }]}
                onPress={() => router.push('/edit-profile' as any)}>
                <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Edit Profile</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.outlineButton, { borderColor: colors.border }]}
                onPress={() => router.push('/activity-history' as any)}>
                <ThemedText style={{ fontWeight: '600' }}>Activity History</ThemedText>
              </Pressable>
            </View>

            {/* Children */}
            <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>MY CHILDREN</ThemedText>
            {children.length === 0 ? (
              <ThemedText style={{ color: colors.muted, textAlign: 'center', paddingVertical: Spacing.md }}>
                No children added yet
              </ThemedText>
            ) : (
              children.map((child) => (
                <View key={child.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.childRow}>
                    <View>
                      <ThemedText style={styles.cardValue}>{child.nickname}</ThemedText>
                      <ThemedText style={[styles.cardSub, { color: colors.muted }]}>
                        Age {ageFromDob(child.date_of_birth)}
                      </ThemedText>
                    </View>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/edit-child/[id]',
                          params: {
                            id: child.id,
                            nickname: child.nickname,
                            date_of_birth: child.date_of_birth,
                            interests: child.interests?.join(',') ?? '',
                          },
                        } as any)
                      }>
                      <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Edit</ThemedText>
                    </Pressable>
                  </View>
                </View>
              ))
            )}

            {/* My Family */}
            <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>MY FAMILY</ThemedText>

            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.lg }} />
            ) : family ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ThemedText style={styles.cardValue}>{family.name ?? 'My Family'}</ThemedText>

                {family.members.map((m) => (
                  <View key={m.user_id} style={[styles.memberRow, { borderTopColor: colors.border }]}>
                    <ThemedText style={styles.memberName}>{m.display_name}</ThemedText>
                    {m.user_id === currentUser?.id && (
                      <ThemedText style={[styles.memberRole, { color: colors.muted }]}>(you)</ThemedText>
                    )}
                  </View>
                ))}

                <Pressable
                  style={[styles.outlineButton, { borderColor: colors.primary, opacity: inviting ? 0.6 : 1 }]}
                  onPress={handleInviteToFamily}
                  disabled={inviting}>
                  {inviting ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>
                      + Invite to family
                    </ThemedText>
                  )}
                </Pressable>

                <Pressable
                  style={[styles.outlineButton, { borderColor: colors.destructive, opacity: leaving ? 0.6 : 1 }]}
                  onPress={handleLeaveFamily}
                  disabled={leaving}>
                  {leaving ? (
                    <ActivityIndicator color={colors.destructive} size="small" />
                  ) : (
                    <ThemedText style={{ color: colors.destructive, fontWeight: '600' }}>
                      Leave family
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            ) : (
              <ThemedText style={{ color: colors.muted, textAlign: 'center', paddingVertical: Spacing.md }}>
                No family found
              </ThemedText>
            )}

            {/* Location / city preference */}
            {locationConsent && (
              <>
                <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>ACTIVITY SUGGESTIONS</ThemedText>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ThemedText style={styles.cardLabel}>Your city</ThemedText>
                  <ThemedText style={[styles.cardSub, { color: colors.muted }]}>
                    Used for weather-based suggestions. Leave blank for season-based suggestions.
                  </ThemedText>
                  <TextInput
                    style={[styles.cityInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                    placeholder="e.g. Munich"
                    placeholderTextColor={colors.muted}
                    value={city}
                    onChangeText={setCity}
                    onBlur={() => {
                      if (city.trim()) {
                        AsyncStorage.setItem(CITY_KEY, city.trim());
                      } else {
                        AsyncStorage.removeItem(CITY_KEY);
                      }
                    }}
                  />
                </View>
              </>
            )}

            {/* Demo data */}
            <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>DEMO</ThemedText>
            <Pressable
              style={[styles.outlineButton, { borderColor: colors.accent, opacity: seeding ? 0.6 : 1 }]}
              onPress={handleSeedDemo}
              disabled={seeding}>
              {seeding ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <ThemedText style={{ color: colors.accent, fontWeight: '600' }}>Load demo data</ThemedText>
              )}
            </Pressable>

            {/* Sign out */}
            <Pressable
              style={[styles.signOutButton, { borderColor: colors.destructive }]}
              onPress={logout}>
              <ThemedText style={{ color: colors.destructive, fontWeight: '600' }}>Sign out</ThemedText>
            </Pressable>
          </>
        }
      />
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
  title: { fontSize: 28 },
  content: { padding: Spacing.md, gap: Spacing.md },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: Spacing.sm },
  card: { borderRadius: 12, borderWidth: 1, padding: Spacing.md, gap: Spacing.xs },
  cardLabel: { fontSize: 12, fontWeight: '600', opacity: 0.6 },
  cardValue: { fontSize: 16, fontWeight: '600' },
  cardSub: { fontSize: 13 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontSize: 22, fontWeight: '700' },
  avatarInfo: { flex: 1, gap: 2 },
  displayName: { fontSize: 18, fontWeight: '700' },
  email: { fontSize: 13 },
  points: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  childRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingTop: Spacing.sm, borderTopWidth: 1, marginTop: Spacing.sm },
  memberName: { flex: 1, fontSize: 15 },
  memberRole: { fontSize: 13 },
  cityInput: { height: 44, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: Spacing.md, fontSize: 15, marginTop: Spacing.xs },
  outlineButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  signOutButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
});
