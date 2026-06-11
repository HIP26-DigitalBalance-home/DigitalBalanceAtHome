import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usersApi } from '@/lib/api/users';
import { onboardingApi } from '@/lib/api/onboarding';
import type { ConsentRecord } from '@/lib/api/users';

export default function PrivacyScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const router = useRouter();

  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [deletionPendingAt, setDeletionPendingAt] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [togglingConsent, setTogglingConsent] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      onboardingApi.getConsent().catch(() => null),
      usersApi.getMe().catch(() => null),
    ]).then(([consentRes, userRes]) => {
      if (cancelled) return;
      if (consentRes?.data) setConsent(consentRes.data as ConsentRecord);
      if (userRes?.data?.deletion_pending_at) setDeletionPendingAt(userRes.data.deletion_pending_at);
    });
    return () => { cancelled = true; };
  }, []);

  async function handleExport() {
    setExporting(true);
    setExportDone(false);
    setError(null);
    try {
      const res = await usersApi.exportData();
      const json = JSON.stringify(res.data, null, 2);
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'digitalbalance-data-export.json';
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const file = new File(Paths.document, 'digitalbalance-data-export.json');
        file.write(json);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your data export' });
        }
      }
      setExportDone(true);
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function handleLocationConsentToggle(value: boolean) {
    if (!consent) return;
    setTogglingConsent(true);
    setError(null);
    try {
      const res = await onboardingApi.postConsent({
        policy_version: consent.policy_version,
        data_storage_consent: consent.data_storage_consent,
        photo_processing_consent: consent.photo_processing_consent,
        location_consent: value,
      });
      setConsent(res.data as ConsentRecord);
    } catch {
      setError('Failed to update consent. Please try again.');
    } finally {
      setTogglingConsent(false);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'Your account will be scheduled for deletion in 30 days. You can cancel this at any time before then.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setError(null);
            try {
              const res = await usersApi.deleteMe();
              setDeletionPendingAt(res.data.deletion_date);
            } catch {
              setError('Failed to request deletion. Please try again.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  async function handleCancelDeletion() {
    setCancelling(true);
    setError(null);
    try {
      await usersApi.cancelDeletion();
      setDeletionPendingAt(null);
    } catch {
      setError('Failed to cancel deletion. Please try again.');
    } finally {
      setCancelling(false);
    }
  }

  const deletionDate = deletionPendingAt
    ? new Date(deletionPendingAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary, fontSize: 16 }}>‹ Back</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.title}>Privacy & Data</ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '22', borderColor: colors.destructive }]}>
            <ThemedText style={{ color: colors.destructive, fontSize: 14 }}>{error}</ThemedText>
          </View>
        )}

        {/* My Data */}
        <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>MY DATA</ThemedText>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={styles.cardTitle}>Data export</ThemedText>
          <ThemedText style={[styles.cardSub, { color: colors.muted }]}>
            Download a copy of all your personal data: profile, children, consents, groups, and activity history.
          </ThemedText>
          {exportDone && (
            <ThemedText style={{ color: colors.accent, fontSize: 13, marginTop: Spacing.xs }}>
              Export ready — check your share sheet or downloads.
            </ThemedText>
          )}
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary, opacity: exporting ? 0.6 : 1 }]}
            onPress={handleExport}
            disabled={exporting}>
            {exporting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <ThemedText style={styles.buttonLabel}>Export my data</ThemedText>
            )}
          </Pressable>
        </View>

        {/* Consent Settings */}
        <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>CONSENT SETTINGS</ThemedText>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.consentRow}>
            <View style={styles.consentText}>
              <ThemedText style={styles.consentLabel}>Data storage</ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.muted }]}>Profile and activity history</ThemedText>
            </View>
            <Switch value={true} disabled thumbColor="#fff" trackColor={{ true: colors.muted }} />
          </View>

          <View style={[styles.consentRow, { borderTopColor: colors.border }]}>
            <View style={styles.consentText}>
              <ThemedText style={styles.consentLabel}>Photo processing</ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.muted }]}>Upload and store completion photos</ThemedText>
            </View>
            <Switch value={true} disabled thumbColor="#fff" trackColor={{ true: colors.muted }} />
          </View>

          <View style={[styles.consentRow, { borderTopColor: colors.border }]}>
            <View style={styles.consentText}>
              <ThemedText style={styles.consentLabel}>Location (optional)</ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.muted }]}>City-level for weather-based suggestions</ThemedText>
            </View>
            <Switch
              value={consent?.location_consent ?? false}
              onValueChange={handleLocationConsentToggle}
              disabled={togglingConsent || !consent}
              thumbColor="#fff"
              trackColor={{ true: colors.accent, false: colors.border }}
            />
          </View>

          <ThemedText style={[styles.cardSub, { color: colors.muted, marginTop: Spacing.sm }]}>
            To withdraw data storage or photo consent, you must delete your account.
          </ThemedText>
        </View>

        {/* Delete Account */}
        <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>ACCOUNT</ThemedText>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {deletionPendingAt ? (
            <>
              <ThemedText style={[styles.cardTitle, { color: colors.destructive }]}>Deletion scheduled</ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.muted }]}>
                Your account is scheduled for permanent deletion on {deletionDate}. You can cancel this until then.
              </ThemedText>
              <Pressable
                style={[styles.button, { backgroundColor: colors.primary, opacity: cancelling ? 0.6 : 1, marginTop: Spacing.sm }]}
                onPress={handleCancelDeletion}
                disabled={cancelling}>
                {cancelling ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <ThemedText style={styles.buttonLabel}>Cancel deletion</ThemedText>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText style={styles.cardTitle}>Delete account</ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.muted }]}>
                Permanently removes your account, children, and all personal data. A 30-day grace period applies before
                data is erased.
              </ThemedText>
              <Pressable
                style={[styles.outlineButton, { borderColor: colors.destructive, opacity: deleting ? 0.6 : 1 }]}
                onPress={handleDeleteAccount}
                disabled={deleting}>
                {deleting ? (
                  <ActivityIndicator color={colors.destructive} size="small" />
                ) : (
                  <ThemedText style={{ color: colors.destructive, fontWeight: '600' }}>Delete my account</ThemedText>
                )}
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { marginBottom: Spacing.xs },
  title: { fontSize: 28 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: Spacing.sm },
  card: { borderRadius: 12, borderWidth: 1, padding: Spacing.md, gap: Spacing.xs },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSub: { fontSize: 13, lineHeight: 18 },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    marginTop: Spacing.xs,
  },
  consentText: { flex: 1, gap: 2 },
  consentLabel: { fontSize: 15, fontWeight: '600' },
  button: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  buttonLabel: { color: '#fff', fontWeight: '600', fontSize: 15 },
  outlineButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  errorBanner: {
    borderRadius: 10,
    borderWidth: 1,
    padding: Spacing.sm,
  },
});
