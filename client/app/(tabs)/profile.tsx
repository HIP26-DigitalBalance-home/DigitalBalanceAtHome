import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { ErrorState } from '@/components/ui/error-state';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { onboardingApi, devApi, usersApi, apiClient } from '@/lib/api';
import { getGermanErrorMessage } from '@/lib/utils/api-error';
import { showAlert, confirmDestructive } from '@/lib/utils/alert';
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
  const { t } = useTranslation();
  const { currentUser, logout, updateCurrentUser } = useAuth();
  const router = useRouter();
  const isOnline = useNetworkStatus();
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);
  const [city, setCity] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const fetchData = useCallback(async () => {
    setFetchError(null);
    try {
      const [familiesRes, childrenRes, userRes] = await Promise.all([
        onboardingApi.getMyFamilies(),
        onboardingApi.getChildren(),
        usersApi.getMe(),
      ]);
      if (familiesRes.data.length > 0) setFamily(familiesRes.data[0]);
      setChildren(childrenRes.data);
      await updateCurrentUser(userRes.data);
    } catch (e) {
      setFetchError(getGermanErrorMessage(e));
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
    const confirmed = await confirmDestructive(
      t('profile.loadDemoTitle'),
      t('profile.loadDemoMsg'),
      t('profile.loadDemoConfirm'),
    );
    if (!confirmed) return;
    setSeeding(true);
    try {
      await devApi.seed();
      showAlert(t('profile.loadDemoSuccess'), t('profile.loadDemoSuccessMsg'));
    } catch {
      showAlert(t('common.error'), t('profile.loadDemoFailed'));
    } finally {
      setSeeding(false);
    }
  }

  async function handleLeaveFamily() {
    if (!family || !currentUser) return;
    const confirmed = await confirmDestructive(
      t('profile.leaveFamilyTitle'),
      t('profile.leaveFamilyConfirm', { name: family.name ?? t('profile.defaultFamilyName') }),
      t('common.remove'),
    );
    if (!confirmed) return;
    setLeaving(true);
    try {
      await apiClient.delete(`/families/${family.id}/members/${currentUser.id}`);
      setFamily(null);
    } catch {
      showAlert(t('common.error'), t('profile.leaveFamilyFailed'));
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
        await Sharing.shareAsync(url, { dialogTitle: t('profile.inviteFamilyTitle') });
      } else {
        showAlert(t('profile.inviteFamilyCopied'), t('profile.inviteFamilyMessage', { url }));
      }
    } catch {
      showAlert(t('common.error'), t('profile.inviteFamilyFailed'));
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
        <ThemedText type="title" style={styles.title}>{t('profile.title')}</ThemedText>
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {fetchError ? <ErrorState message={fetchError} onRetry={fetchData} /> : null}

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
                    {currentUser?.points_balance ?? 0} {t('profile.pts')}
                  </ThemedText>
                </View>
              </View>

              <Pressable
                style={[styles.outlineButton, { borderColor: colors.primary }]}
                onPress={() => router.push('/edit-profile' as any)}>
                <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>{t('profile.editProfile')}</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.outlineButton, { borderColor: colors.border }]}
                onPress={() => router.push('/activity-history' as any)}>
                <ThemedText style={{ fontWeight: '600' }}>{t('profile.activityHistory')}</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.outlineButton, { borderColor: colors.border }]}
                onPress={() => router.push('/privacy' as any)}>
                <ThemedText style={{ fontWeight: '600' }}>{t('profile.privacyData')}</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.outlineButton, { borderColor: colors.border }]}
                onPress={() => router.push('/privacy-policy' as any)}>
                <ThemedText style={{ fontWeight: '600' }}>Datenschutzerklärung</ThemedText>
              </Pressable>
            </View>

            {/* Children */}
            <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>{t('profile.myChildren')}</ThemedText>
            {children.length === 0 ? (
              <ThemedText style={{ color: colors.muted, textAlign: 'center', paddingVertical: Spacing.md }}>
                {t('profile.noChildren')}
              </ThemedText>
            ) : (
              children.map((child) => (
                <View key={child.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.childRow}>
                    <View>
                      <ThemedText style={styles.cardValue}>{child.nickname}</ThemedText>
                      <ThemedText style={[styles.cardSub, { color: colors.muted }]}>
                        {t('profile.age', { count: ageFromDob(child.date_of_birth) })}
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
                      <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>{t('common.edit')}</ThemedText>
                    </Pressable>
                  </View>
                </View>
              ))
            )}

            {/* My Family */}
            <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>{t('profile.myFamily')}</ThemedText>

            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.lg }} />
            ) : family ? (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ThemedText style={styles.cardValue}>{family.name ?? t('profile.defaultFamilyName')}</ThemedText>

                {family.members.map((m) => (
                  <View key={m.user_id} style={[styles.memberRow, { borderTopColor: colors.border }]}>
                    <ThemedText style={styles.memberName}>{m.display_name}</ThemedText>
                    {m.user_id === currentUser?.id && (
                      <ThemedText style={[styles.memberRole, { color: colors.muted }]}>{t('profile.you')}</ThemedText>
                    )}
                  </View>
                ))}

                <Pressable
                  style={[styles.outlineButton, { borderColor: colors.primary, opacity: (inviting || !isOnline) ? 0.6 : 1 }]}
                  onPress={handleInviteToFamily}
                  disabled={inviting || !isOnline}>
                  {inviting ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>
                      {t('profile.inviteToFamily')}
                    </ThemedText>
                  )}
                </Pressable>

                <Pressable
                  style={[styles.outlineButton, { borderColor: colors.destructive, opacity: (leaving || !isOnline) ? 0.6 : 1 }]}
                  onPress={handleLeaveFamily}
                  disabled={leaving || !isOnline}>
                  {leaving ? (
                    <ActivityIndicator color={colors.destructive} size="small" />
                  ) : (
                    <ThemedText style={{ color: colors.destructive, fontWeight: '600' }}>
                      {t('profile.leaveFamily')}
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            ) : (
              <ThemedText style={{ color: colors.muted, textAlign: 'center', paddingVertical: Spacing.md }}>
                {t('profile.noFamily')}
              </ThemedText>
            )}

            {/* Location / city preference */}
            {locationConsent && (
              <>
                <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>{t('profile.activitySuggestions')}</ThemedText>
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ThemedText style={styles.cardLabel}>{t('profile.yourCity')}</ThemedText>
                  <ThemedText style={[styles.cardSub, { color: colors.muted }]}>
                    {t('profile.citySub')}
                  </ThemedText>
                  <TextInput
                    style={[styles.cityInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                    placeholder={t('profile.cityPlaceholder')}
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

            {/* Sign out */}
            <Pressable
              style={[styles.signOutButton, { borderColor: colors.destructive }]}
              onPress={logout}>
              <ThemedText style={{ color: colors.destructive, fontWeight: '600' }}>{t('profile.signOut')}</ThemedText>
            </Pressable>

            {/* Debug section — collapsed by default */}
            <Pressable onPress={() => setShowDebug((v) => !v)} style={styles.debugToggle}>
              <ThemedText style={[styles.debugToggleText, { color: colors.muted }]}>
                {showDebug ? '▴ debug' : '▾ debug'}
              </ThemedText>
            </Pressable>
            {showDebug && (
              <Pressable
                style={[styles.outlineButton, { borderColor: colors.border, opacity: (seeding || !isOnline) ? 0.6 : 1 }]}
                onPress={handleSeedDemo}
                disabled={seeding || !isOnline}>
                {seeding ? (
                  <ActivityIndicator color={colors.muted} size="small" />
                ) : (
                  <ThemedText style={{ color: colors.muted, fontWeight: '500' }}>{t('profile.loadDemo')}</ThemedText>
                )}
              </Pressable>
            )}
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
  debugToggle: { alignItems: 'center', paddingVertical: Spacing.sm },
  debugToggleText: { fontSize: 11, letterSpacing: 0.5 },
});
