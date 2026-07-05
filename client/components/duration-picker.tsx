import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';

// OD-105: fixed duration options; 120 is the open-ended "120+" bucket.
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

interface Props {
  value: number | null;
  onChange: (minutes: number) => void;
}

export function DurationPicker({ value, onChange }: Props) {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      {DURATION_OPTIONS.map((minutes) => {
        const selected = value === minutes;
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
            onPress={() => onChange(minutes)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '600' },
});
