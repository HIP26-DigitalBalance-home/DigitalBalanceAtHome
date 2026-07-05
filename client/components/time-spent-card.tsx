import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { DurationPicker } from '@/components/duration-picker';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { timeSpentApi } from '@/lib/api';
import { localDateString } from '@/lib/time-spent-utils';
import { getGermanErrorMessage } from '@/lib/utils/api-error';

// Debounced so typing a custom duration doesn't fire a request per digit
const SAVE_DEBOUNCE_MS = 600;

interface Props {
  onSaved?: () => void;
}

export function TimeSpentCard({ onSaved }: Props) {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const savedRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = localDateString();

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setLoading(true);
    timeSpentApi.getInsight('weekly', today)
      .then((response) => {
        if (cancelled) return;
        const current = response.data.daily_totals.find((item) => item.date === today)?.manual_minutes ?? 0;
        const value = current > 0 ? current : null;
        savedRef.current = value;
        setSelectedMinutes(value);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [today]));

  function handleChange(minutes: number | null) {
    setSelectedMinutes(minutes);
    setError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (minutes == null || minutes === savedRef.current) return;
    timerRef.current = setTimeout(() => save(minutes), SAVE_DEBOUNCE_MS);
  }

  async function save(minutes: number) {
    try {
      const response = await timeSpentApi.upsertManualTime(today, minutes);
      savedRef.current = response.data.minutes;
      setSelectedMinutes(response.data.minutes);
      onSaved?.();
    } catch (reason) {
      setSelectedMinutes(savedRef.current);
      setError(`${t('timeSpent.saveFailed')} ${getGermanErrorMessage(reason)}`);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card }]}>
      <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>{t('timeSpent.sectionLabel')}</ThemedText>
      <ThemedText style={styles.title}>{t('timeSpent.cardTitle')}</ThemedText>
      {loading ? <ActivityIndicator color={colors.primary} /> : (
        <DurationPicker value={selectedMinutes} onChange={handleChange} horizontal />
      )}
      {error && <ThemedText style={[styles.message, { color: colors.muted }]}>{error}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: Spacing.sm, gap: Spacing.xs },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  title: { fontSize: 15, fontWeight: '700' },
  message: { fontSize: 12 },
});
