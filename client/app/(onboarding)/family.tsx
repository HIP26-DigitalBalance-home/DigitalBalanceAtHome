import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { onboardingApi } from '@/lib/api';
import { pendingInvite } from '@/lib/pending-invite';

export default function FamilyScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
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
      setError('Failed to create family. Please try again.');
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
      if (code === 'invite_expired') setError('This family invite has expired.');
      else if (code === 'invite_already_used') setError('This family invite has already been used.');
      else if (code === 'already_family_member') setError('You are already a member of this family.');
      else setError('Failed to join family. The invite may be invalid.');
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <ThemedText type="title">
          {pendingFamilyToken ? 'Join your family' : 'Create your family'}
        </ThemedText>

        {pendingFamilyToken ? (
          <>
            <ThemedText style={{ color: colors.muted }}>
              You were invited to join a family. Accept the invite or create your own instead.
            </ThemedText>
            {error && (
              <ThemedText style={{ color: colors.destructive, fontSize: 14 }}>{error}</ThemedText>
            )}
          </>
        ) : (
          <>
            <ThemedText style={{ color: colors.muted }}>
              Give your family a name — or skip and we&apos;ll use the default.
            </ThemedText>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
              placeholder="e.g. The Mustermann Family"
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
                  Accept invite
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
                Create a new family instead
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
                Create family
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
