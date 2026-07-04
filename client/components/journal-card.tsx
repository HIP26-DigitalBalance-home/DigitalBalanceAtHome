import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MOOD_BY_KEY, MOODS, type Mood } from '@/constants/journal';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import { journalApi } from '@/lib/api';
import { localDateString } from '@/lib/journal-utils';
import { showAlert } from '@/lib/utils/alert';
import { getGermanErrorMessage } from '@/lib/utils/api-error';

const ANSWERED_KEY = '@dba_journal_answered_date';

interface AnsweredRecord {
  date: string;
  mood: Mood;
}

async function storeAnswered(date: string, mood: Mood): Promise<void> {
  await AsyncStorage.setItem(ANSWERED_KEY, JSON.stringify({ date, mood } satisfies AnsweredRecord));
}

/**
 * Daily mood check-in. Once today's mood has been answered — checked via
 * AsyncStorage first (fast path) and the server (other devices) — the card
 * stays put but switches to a "completed" state linking to the mood history.
 */
export function JournalCard() {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [answeredMood, setAnsweredMood] = useState<Mood | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const today = localDateString();

      async function check() {
        const raw = await AsyncStorage.getItem(ANSWERED_KEY);
        if (cancelled) return;
        // Older builds stored a bare date string here instead of {date, mood} —
        // treat anything unparseable as "no local record" and fall through to
        // the server check below rather than crashing.
        let stored: AnsweredRecord | null = null;
        if (raw) {
          try {
            stored = JSON.parse(raw);
          } catch {
            stored = null;
          }
        }
        if (stored?.date === today) {
          setAnsweredMood(stored.mood);
          setVisible(true);
          return;
        }
        try {
          const res = await journalApi.getEntries(today, today);
          if (cancelled) return;
          if (res.data.length > 0) {
            const mood = res.data[0].mood;
            storeAnswered(today, mood);
            setAnsweredMood(mood);
          }
          setVisible(true);
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
        storeAnswered(today, mood);
        setAnsweredMood(mood);
      })
      .catch((e) => {
        if (e?.response?.status === 409) {
          // Already answered today (e.g. on another device) — just mark done
          storeAnswered(today, mood);
          setAnsweredMood(mood);
        } else {
          showAlert(t('common.error'), getGermanErrorMessage(e));
        }
      })
      .finally(() => setSubmitting(false));
  }

  if (!visible) return null;

  if (answeredMood) {
    const mood = MOOD_BY_KEY[answeredMood];
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/activity-history', params: { tab: 'analyze' } } as any)}
        accessibilityRole="button"
        accessibilityLabel={t('journal.viewHistory')}
        style={({ pressed }) => [
          styles.section,
          styles.completedSection,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={[styles.moodCircle, styles.completedCircle, { backgroundColor: colors.primary + '14' }]}>
          <ThemedText style={styles.moodEmoji}>{mood.emoji}</ThemedText>
        </View>
        <View style={styles.completedTextBlock}>
          <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>{t('journal.sectionLabel')}</ThemedText>
          <ThemedText style={styles.completedText}>{t('journal.answeredToday', { mood: t(mood.labelKey) })}</ThemedText>
        </View>
        <ThemedText style={[styles.completedLink, { color: colors.primary }]}>{t('journal.viewHistory')} →</ThemedText>
      </Pressable>
    );
  }

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
  completedSection: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  completedCircle: { width: 40, height: 40, borderRadius: 20 },
  completedTextBlock: { flex: 1, gap: 2 },
  completedText: { fontSize: 14, fontWeight: '600' },
  completedLink: { fontSize: 12, fontWeight: '600' },
});
