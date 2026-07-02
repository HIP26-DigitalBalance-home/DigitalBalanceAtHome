import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MOODS, type Mood } from '@/constants/journal';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import { journalApi } from '@/lib/api';
import { localDateString } from '@/lib/journal-utils';
import { showAlert } from '@/lib/utils/alert';
import { getGermanErrorMessage } from '@/lib/utils/api-error';

const ANSWERED_KEY = '@dba_journal_answered_date';

/**
 * Daily mood check-in. Renders nothing once today's mood has been answered —
 * checked via AsyncStorage first (fast path) and the server (other devices).
 */
export function JournalCard() {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const today = localDateString();

      async function check() {
        const answered = await AsyncStorage.getItem(ANSWERED_KEY);
        if (cancelled) return;
        if (answered === today) {
          setVisible(false);
          return;
        }
        try {
          const res = await journalApi.getEntries(today, today);
          if (cancelled) return;
          if (res.data.length > 0) {
            AsyncStorage.setItem(ANSWERED_KEY, today);
            setVisible(false);
          } else {
            setVisible(true);
          }
        } catch {
          // If the check fails, show the card — duplicates are rejected server-side
          if (!cancelled) setVisible(true);
        }
      }

      check();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  function handleSelect(mood: Mood) {
    if (submitting) return;
    setSubmitting(true);
    const today = localDateString();
    journalApi
      .createEntry(today, mood)
      .then(() => {
        AsyncStorage.setItem(ANSWERED_KEY, today);
        setVisible(false);
      })
      .catch((e) => {
        if (e?.response?.status === 409) {
          // Already answered today (e.g. on another device) — just hide
          AsyncStorage.setItem(ANSWERED_KEY, today);
          setVisible(false);
        } else {
          showAlert(t('common.error'), getGermanErrorMessage(e));
        }
      })
      .finally(() => setSubmitting(false));
  }

  if (!visible) return null;

  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card }]}>
      <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>{t('journal.sectionLabel')}</ThemedText>
      <ThemedText style={styles.question}>{t('journal.question')}</ThemedText>
      <View style={styles.moodRow}>
        {MOODS.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => handleSelect(m.key)}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={t(m.labelKey)}
            style={({ pressed }) => [styles.moodButton, (pressed || submitting) && { opacity: 0.6 }]}
          >
            <View style={[styles.moodCircle, { backgroundColor: colors.primary + '14' }]}>
              <ThemedText style={styles.moodEmoji}>{m.emoji}</ThemedText>
            </View>
            <ThemedText style={[styles.moodLabel, { color: colors.muted }]} numberOfLines={1}>
              {t(m.labelKey)}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: DEFAULT_RADII.card, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  question: { fontSize: 17, fontWeight: '600', lineHeight: 24 },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
  moodButton: { alignItems: 'center', gap: Spacing.xs, flex: 1 },
  moodCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  moodEmoji: { fontSize: 26, lineHeight: 34 },
  moodLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
});
