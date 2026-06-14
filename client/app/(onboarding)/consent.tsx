import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsentCheckbox } from '@/components/onboarding/ConsentCheckbox';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { onboardingApi } from '@/lib/api';

export default function ConsentScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  const [dataStorage, setDataStorage] = useState(false);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [location, setLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = dataStorage && photoProcessing;

  async function handleContinue() {
    setIsSubmitting(true);
    setError(null);
    try {
      await onboardingApi.postConsent({
        policy_version: '1.0',
        data_storage_consent: dataStorage,
        photo_processing_consent: photoProcessing,
        location_consent: location,
      });
      router.push('/(onboarding)/family');
    } catch {
      setError(t('consent.saveFailed'));
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>{t('consent.title')}</ThemedText>
        <ThemedText style={[styles.intro, { color: colors.muted }]}>
          {t('consent.intro')}
        </ThemedText>

        <View style={styles.checks}>
          <ConsentCheckbox
            checked={dataStorage}
            onToggle={() => setDataStorage((v) => !v)}
            label={t('consent.dataStorage')}
            sublabel={t('consent.dataStorageSub')}
            required
          />
          <ConsentCheckbox
            checked={photoProcessing}
            onToggle={() => setPhotoProcessing((v) => !v)}
            label={t('consent.photoProcessing')}
            sublabel={t('consent.photoProcessingSub')}
            required
          />
          <ConsentCheckbox
            checked={location}
            onToggle={() => setLocation((v) => !v)}
            label={t('consent.location')}
            sublabel={t('consent.locationSub')}
          />
        </View>

        <ThemedText style={[styles.required, { color: colors.muted }]}>
          {t('consent.required')}
        </ThemedText>

        {error && (
          <ThemedText style={[styles.error, { color: colors.destructive }]}>{error}</ThemedText>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.button,
            { backgroundColor: canContinue ? colors.primary : colors.border, opacity: isSubmitting ? 0.7 : 1 },
          ]}
          onPress={handleContinue}
          disabled={!canContinue || isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>
              {t('consent.continue')}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.screenHorizontal, gap: Spacing.lg },
  title: { marginTop: Spacing.lg },
  intro: { fontSize: 15, lineHeight: 22 },
  checks: { gap: Spacing.sm },
  required: { fontSize: 13 },
  error: { fontSize: 14 },
  footer: { padding: Spacing.screenHorizontal, paddingBottom: Spacing.xl },
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
