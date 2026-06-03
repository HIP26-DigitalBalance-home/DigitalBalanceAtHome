import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { onboardingApi } from '@/lib/api';

export default function JoinFamilyScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(tokenParam ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tokenParam) setToken(tokenParam);
  }, [tokenParam]);

  async function handleJoin() {
    const trimmed = token.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onboardingApi.postFamilyJoin(trimmed);
      router.replace('/(tabs)');
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'invite_expired') setError('This invite link has expired.');
      else if (code === 'invite_already_used') setError('This invite link has already been used.');
      else if (code === 'already_family_member') setError('You are already a member of this family.');
      else setError('Failed to join family. Please check the link and try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary, fontSize: 16 }}>Cancel</ThemedText>
        </Pressable>
        <ThemedText type="defaultSemiBold" style={styles.headerTitle}>Join a family</ThemedText>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <ThemedText style={{ color: colors.muted }}>
          Paste the family invite link or enter the token shared by your partner.
        </ThemedText>

        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          placeholder="Paste invite URL or token"
          placeholderTextColor={colors.muted}
          value={token}
          onChangeText={setToken}
          autoFocus={!tokenParam}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleJoin}
          returnKeyType="join"
        />

        {error && (
          <ThemedText style={[styles.error, { color: colors.destructive }]}>{error}</ThemedText>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.button, {
            backgroundColor: token.trim() ? colors.primary : colors.border,
            opacity: isSubmitting ? 0.7 : 1,
          }]}
          onPress={handleJoin}
          disabled={!token.trim() || isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>
              Join family
            </ThemedText>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { width: 64 },
  headerTitle: { fontSize: 17 },
  content: { flex: 1, padding: Spacing.screenHorizontal, paddingTop: Spacing.lg, gap: Spacing.lg },
  input: { height: 52, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: Spacing.md, fontSize: 15 },
  error: { fontSize: 14 },
  footer: { padding: Spacing.screenHorizontal, paddingBottom: Spacing.xl },
  button: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
