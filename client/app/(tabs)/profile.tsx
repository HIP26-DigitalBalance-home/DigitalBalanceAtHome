import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { onboardingApi, devApi } from '@/lib/api';
import { apiClient } from '@/lib/api';

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

export default function ProfileScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { currentUser, logout } = useAuth();
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);
  const [city, setCity] = useState('');
  const [seeding, setSeeding] = useState(false);

  const fetchFamily = useCallback(async () => {
    try {
      const res = await onboardingApi.getMyFamilies();
      if (res.data.length > 0) setFamily(res.data[0]);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFamily(); }, [fetchFamily]);

  // Load location consent and stored city preference
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
    Alert.alert(
      'Load demo data',
      'This will create a sample group, mock families, and example challenges. Safe to run again — demo data will be reset.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load',
          onPress: async () => {
            setSeeding(true);
            try {
              await devApi.seed();
              Alert.alert('Done', 'Demo data loaded! Pull to refresh your Home and Groups tabs.');
            } catch {
              Alert.alert('Error', 'Failed to load demo data. Make sure the server has SEED_ENABLED=true.');
            } finally {
              setSeeding(false);
            }
          },
        },
      ],
    );
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
        Alert.alert('Link copied', 'Share this link to invite your partner:\n\n' + url);
      }
    } catch {
      Alert.alert('Error', 'Failed to generate invite link');
    } finally {
      setInviting(false);
    }
  }

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
            {/* User info */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={styles.cardLabel}>Signed in as</ThemedText>
              <ThemedText style={styles.cardValue}>{currentUser?.display_name ?? '—'}</ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.muted }]}>{currentUser?.email}</ThemedText>
            </View>

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
                  style={[styles.inviteButton, { borderColor: colors.primary, opacity: inviting ? 0.6 : 1 }]}
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
                  style={[styles.inviteButton, { borderColor: colors.destructive, opacity: leaving ? 0.6 : 1 }]}
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

            {/* Location / city preference — only shown if user gave location consent */}
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
              style={[styles.inviteButton, { borderColor: colors.accent, opacity: seeding ? 0.6 : 1 }]}
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
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingTop: Spacing.sm, borderTopWidth: 1, marginTop: Spacing.sm },
  memberName: { flex: 1, fontSize: 15 },
  memberRole: { fontSize: 13 },
  cityInput: { height: 44, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: Spacing.md, fontSize: 15, marginTop: Spacing.xs },
  inviteButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
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
