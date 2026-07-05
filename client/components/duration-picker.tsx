import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

interface Props {
  value: number | null;
  onChange: (minutes: number | null) => void;
  horizontal?: boolean;
}

export function DurationPicker({ value, onChange, horizontal = false }: Props) {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();
  const isPreset = value != null && DURATION_OPTIONS.includes(value as (typeof DURATION_OPTIONS)[number]);
  const [customActive, setCustomActive] = useState(value != null && !isPreset);
  const [customValue, setCustomValue] = useState(value != null && !isPreset ? String(value) : '');
  const [customError, setCustomError] = useState(false);

  useEffect(() => {
    const preset = value != null && DURATION_OPTIONS.includes(value as (typeof DURATION_OPTIONS)[number]);
    if (preset) {
      setCustomActive(false);
      setCustomValue('');
      setCustomError(false);
    } else if (value != null) {
      setCustomActive(true);
      setCustomValue(String(value));
    }
  }, [value]);

  function selectCustom() {
    setCustomActive(true);
    setCustomValue('');
    setCustomError(false);
    onChange(null);
  }

  function changeCustom(text: string) {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 4);
    setCustomValue(digits);
    const parsed = Number(digits);
    const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 1440;
    setCustomError(digits.length > 0 && !valid);
    onChange(valid ? parsed : null);
  }

  const chips = (
    <View style={[styles.row, !horizontal && styles.wrap]}>
      {DURATION_OPTIONS.map((minutes) => {
        const selected = !customActive && value === minutes;
        const label = minutes === 120
          ? t('completeModal.durationMinutesPlus', { count: minutes })
          : t('completeModal.durationMinutes', { count: minutes });
        return (
          <Pressable
            key={minutes}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? colors.primary : colors.surface,
                borderColor: selected ? colors.primary : colors.border,
                borderRadius: radii.badge,
              },
            ]}
            onPress={() => {
              setCustomActive(false);
              onChange(minutes);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
          >
            <ThemedText style={[styles.chipText, { color: selected ? colors.buttonText : colors.onSurface }]}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
      <Pressable
        style={[
          styles.chip,
          {
            backgroundColor: customActive ? colors.primary : colors.surface,
            borderColor: customActive ? colors.primary : colors.border,
            borderRadius: radii.badge,
          },
        ]}
        onPress={selectCustom}
        accessibilityRole="button"
        accessibilityState={{ selected: customActive }}
        accessibilityLabel={t('completeModal.customDuration')}
      >
        <ThemedText style={[styles.chipText, { color: customActive ? colors.buttonText : colors.onSurface }]}>
          {t('completeModal.customDuration')}
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      {horizontal ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {chips}
        </ScrollView>
      ) : chips}
      {customActive && (
        <>
          <TextInput
            value={customValue}
            onChangeText={changeCustom}
            keyboardType="number-pad"
            placeholder={t('completeModal.customMinutesPlaceholder')}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t('completeModal.customMinutesPlaceholder')}
            style={[
              styles.input,
              { color: colors.onSurface, borderColor: customError ? colors.destructive : colors.border, borderRadius: radii.input },
            ]}
          />
          {customError && (
            <ThemedText style={[styles.error, { color: colors.destructive }]}>
              {t('completeModal.invalidDuration')}
            </ThemedText>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  row: { flexDirection: 'row', gap: Spacing.xs },
  wrap: { flexWrap: 'wrap' },
  scrollContent: { paddingRight: Spacing.md },
  chip: {
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 44, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: 15 },
  error: { fontSize: 12 },
});
