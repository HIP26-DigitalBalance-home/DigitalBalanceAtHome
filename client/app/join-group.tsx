import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { groupsApi } from '@/lib/api';

export default function JoinGroupScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  // Pre-fill from URL: /join-group?token=xxx
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
      const res = await groupsApi.joinGroup(trimmed);
      const groupId: string = res.data.id;
      router.replace(`/group/${groupId}` as any);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'group_invite_expired') setError(t('joinGroup.inviteExpired'));
      else if (code === 'group_invite_already_used') setError(t('joinGroup.inviteUsed'));
      else if (code === 'already_group_member') setError(t('joinGroup.alreadyMember'));
      else if (code === 'no_family') setError(t('joinGroup.noFamily'));
      else if (code === 'group_invite_not_found') setError(t('joinGroup.notFound'));
      else setError(t('joinGroup.failed'));
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary, fontSize: 16 }}>{t('common.cancel')}</ThemedText>
        </Pressable>
        <ThemedText type="defaultSemiBold" style={styles.headerTitle}>{t('joinGroup.title')}</ThemedText>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <ThemedText style={{ color: colors.muted }}>
          {t('joinGroup.intro')}
        </ThemedText>

        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          placeholder={t('joinGroup.placeholder')}
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
            <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>{t('joinGroup.submit')}</ThemedText>
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
