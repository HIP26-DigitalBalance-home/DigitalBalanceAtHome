import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { usersApi } from '@/lib/api/users';
import { onboardingApi } from '@/lib/api/onboarding';
import type { ConsentRecord } from '@/lib/api/users';

export default function PrivacyScreen() {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();
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
      setError(t('privacy.exportFailed'));
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
      setError(t('privacy.consentUpdateFailed'));
    } finally {
      setTogglingConsent(false);
    }
  }

  async function handleDeleteAccount() {
    const message = t('privacy.deleteMsg');
    if (Platform.OS === 'web') {
      if (!window.confirm(`${t('privacy.deleteTitle')}\n\n${message}`)) return;
    } else {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(t('privacy.deleteTitle'), message, [
          { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('privacy.deleteConfirmBtn'), style: 'destructive', onPress: () => resolve(true) },
        ]);
      });
      if (!confirmed) return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await usersApi.deleteMe();
      setDeletionPendingAt(res.data.deletion_date);
    } catch {
      setError(t('privacy.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  async function handleCancelDeletion() {
    setCancelling(true);
    setError(null);
    try {
      await usersApi.cancelDeletion();
      setDeletionPendingAt(null);
    } catch {
      setError(t('privacy.cancelFailed'));
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
          <ThemedText style={{ color: colors.primary, fontSize: 16 }}>‹ {t('common.back')}</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.title}>{t('privacy.title')}</ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.destructive + '22', borderColor: colors.destructive }]}>
            <ThemedText style={{ color: colors.destructive, fontSize: 14 }}>{error}</ThemedText>
          </View>
        )}

        {/* My Data */}
        <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>{t('privacy.yourRights')}</ThemedText>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={styles.cardTitle}>{t('privacy.exportData')}</ThemedText>
          {exportDone && (
            <ThemedText style={{ color: colors.accent, fontSize: 13, marginTop: Spacing.xs }}>
              {t('privacy.exportSuccess')}
            </ThemedText>
          )}
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary, opacity: exporting ? 0.6 : 1 }]}
            onPress={handleExport}
            disabled={exporting}>
            {exporting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <ThemedText style={styles.buttonLabel}>{t('privacy.exportData')}</ThemedText>
            )}
          </Pressable>
        </View>

        {/* Consent Settings */}
        <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>{t('privacy.consentTitle')}</ThemedText>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.consentRow}>
            <View style={styles.consentText}>
              <ThemedText style={styles.consentLabel}>{t('consent.dataStorage')}</ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.muted }]}>{t('consent.dataStorageSub')}</ThemedText>
            </View>
            <Switch value={true} disabled thumbColor="#fff" trackColor={{ true: colors.muted }} />
          </View>

          <View style={[styles.consentRow, { borderTopColor: colors.border }]}>
            <View style={styles.consentText}>
              <ThemedText style={styles.consentLabel}>{t('consent.photoProcessing')}</ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.muted }]}>{t('consent.photoProcessingSub')}</ThemedText>
            </View>
            <Switch value={true} disabled thumbColor="#fff" trackColor={{ true: colors.muted }} />
          </View>

          <View style={[styles.consentRow, { borderTopColor: colors.border }]}>
            <View style={styles.consentText}>
              <ThemedText style={styles.consentLabel}>{t('privacy.locationConsent')}</ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.muted }]}>{t('consent.locationSub')}</ThemedText>
            </View>
            <Switch
              value={consent?.location_consent ?? false}
              onValueChange={handleLocationConsentToggle}
              disabled={togglingConsent || !consent}
              thumbColor="#fff"
              trackColor={{ true: colors.accent, false: colors.border }}
            />
          </View>
        </View>

        {/* Delete Account */}
        <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>{t('privacy.accountSection')}</ThemedText>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {deletionPendingAt ? (
            <>
              <ThemedText style={[styles.cardTitle, { color: colors.destructive }]}>{t('privacy.cancelDeletion')}</ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.muted }]}>
                {t('privacy.deletionScheduled', { date: deletionDate })}
              </ThemedText>
              <Pressable
                style={[styles.button, { backgroundColor: colors.primary, opacity: cancelling ? 0.6 : 1, marginTop: Spacing.sm }]}
                onPress={handleCancelDeletion}
                disabled={cancelling}>
                {cancelling ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <ThemedText style={styles.buttonLabel}>{t('privacy.cancelDeletion')}</ThemedText>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText style={styles.cardTitle}>{t('privacy.deleteAccount')}</ThemedText>
              <Pressable
                style={[styles.outlineButton, { borderColor: colors.destructive, opacity: deleting ? 0.6 : 1 }]}
                onPress={handleDeleteAccount}
                disabled={deleting}>
                {deleting ? (
                  <ActivityIndicator color={colors.destructive} size="small" />
                ) : (
                  <ThemedText style={{ color: colors.destructive, fontWeight: '600' }}>{t('privacy.deleteAccount')}</ThemedText>
                )}
              </Pressable>
            </>
          )}
        </View>

        {/* Privacy Policy */}
        <Pressable
          style={[styles.outlineButton, { borderColor: colors.border }]}
          onPress={() => router.push('/privacy-policy' as any)}>
          <ThemedText style={{ fontWeight: '600' }}>{t('profile.privacyPolicy')}</ThemedText>
        </Pressable>
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
