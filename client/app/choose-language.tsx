import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { useLanguage } from '@/lib/i18n/language-context';
import type { AppLanguage } from '@/lib/i18n/language-preloader';

// First screen on a fresh install. Always rendered in English (text is
// hardcoded, not translated) so a new user can read it regardless of the
// underlying i18n default. Choosing a language persists it and the route guard
// then moves the user on to sign-in.
const OPTIONS: { code: AppLanguage; label: string; sub: string }[] = [
  { code: 'en', label: 'English', sub: 'Continue in English' },
  { code: 'de', label: 'Deutsch', sub: 'Auf Deutsch fortfahren' },
];

export default function ChooseLanguageScreen() {
  const { colors } = useAppTheme();
  const { setLanguage } = useLanguage();
  const [pending, setPending] = useState<AppLanguage | null>(null);

  async function choose(code: AppLanguage) {
    if (pending) return;
    setPending(code);
    // Persisting flips `chosen` to true in the language context; the route
    // guard re-renders and redirects away from this screen automatically.
    await setLanguage(code);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <ThemedText type="title">Bond</ThemedText>
        <ThemedText style={[styles.heading]}>Choose your language</ThemedText>
        <ThemedText style={{ color: colors.muted, textAlign: 'center' }}>
          You can change this later in your profile.
        </ThemedText>

        <View style={styles.options}>
          {OPTIONS.map((opt) => {
            const isPending = pending === opt.code;
            return (
              <Pressable
                key={opt.code}
                style={[
                  styles.option,
                  { borderColor: colors.primary, opacity: pending && !isPending ? 0.5 : 1 },
                ]}
                onPress={() => choose(opt.code)}
                disabled={!!pending}
                accessibilityRole="button"
                accessibilityLabel={opt.label}>
                {isPending ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <ThemedText style={[styles.optionLabel, { color: colors.primary }]}>{opt.label}</ThemedText>
                    <ThemedText style={[styles.optionSub, { color: colors.muted }]}>{opt.sub}</ThemedText>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.screenHorizontal,
  },
  heading: { fontSize: 20, fontWeight: '700', marginTop: Spacing.sm },
  options: { width: '100%', gap: Spacing.md, marginTop: Spacing.lg },
  option: {
    width: '100%',
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  optionLabel: { fontSize: 17, fontWeight: '700' },
  optionSub: { fontSize: 13 },
});
