import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { onboardingApi } from '@/lib/api';
import { pendingInvite } from '@/lib/pending-invite';

export default function FamilyScreen() {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFamilyToken, setPendingFamilyToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    pendingInvite.getFamilyToken().then((token) => {
      if (!cancelled) setPendingFamilyToken(token);
    });
    return () => { cancelled = true; };
  }, []);

  async function handleCreate() {
    setIsSubmitting(true);
    setError(null);
    try {
      await onboardingApi.postFamily({ name: name.trim() || null });
      router.push('/(onboarding)/child');
    } catch {
      setError(t('family.createFailed'));
      setIsSubmitting(false);
    }
  }

  async function handleJoinPendingFamily() {
    if (!pendingFamilyToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onboardingApi.postFamilyJoin(pendingFamilyToken);
      await pendingInvite.clearFamilyToken();
      router.push('/(onboarding)/child');
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'invite_expired') setError(t('family.inviteExpired'));
      else if (code === 'invite_already_used') setError(t('family.inviteUsed'));
      else if (code === 'already_family_member') setError(t('family.alreadyMember'));
      else setError(t('family.joinFailed'));
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <ThemedText type="title">
          {pendingFamilyToken ? t('family.joinTitle') : t('family.createTitle')}
        </ThemedText>

        {pendingFamilyToken ? (
          <>
            <ThemedText style={{ color: colors.muted }}>
              {t('family.joinIntro')}
            </ThemedText>
            {error && (
              <ThemedText style={{ color: colors.destructive, fontSize: 14 }}>{error}</ThemedText>
            )}
          </>
        ) : (
          <>
            <ThemedText style={{ color: colors.muted }}>
              {t('family.createIntro')}
            </ThemedText>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
              placeholder={t('family.namePlaceholder')}
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            {error && (
              <ThemedText style={{ color: colors.destructive, fontSize: 14 }}>{error}</ThemedText>
            )}
          </>
        )}
      </View>

      <View style={styles.footer}>
        {pendingFamilyToken ? (
          <>
            <Pressable
              style={[styles.button, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]}
              onPress={handleJoinPendingFamily}
              disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>
                  {t('family.acceptInvite')}
                </ThemedText>
              )}
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={async () => {
                await pendingInvite.clearFamilyToken();
                setPendingFamilyToken(null);
              }}
              disabled={isSubmitting}>
              <ThemedText style={{ color: colors.muted, fontSize: 15 }}>
                {t('family.createInstead')}
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]}
            onPress={handleCreate}
            disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color={colors.buttonText} />
            ) : (
              <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>
                {t('family.createButton')}
              </ThemedText>
            )}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: Spacing.screenHorizontal, paddingTop: Spacing.xl, gap: Spacing.lg },
  input: { height: 52, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: Spacing.md, fontSize: 16 },
  footer: { padding: Spacing.screenHorizontal, paddingBottom: Spacing.xl, gap: Spacing.sm },
  button: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  secondaryButton: { height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
