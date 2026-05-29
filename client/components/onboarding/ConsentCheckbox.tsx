import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ConsentCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  sublabel?: string;
  required?: boolean;
}

export function ConsentCheckbox({
  checked,
  onToggle,
  label,
  sublabel,
  required,
}: ConsentCheckboxProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  return (
    <Pressable style={styles.row} onPress={onToggle} accessibilityRole="checkbox">
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? colors.primary : colors.border,
            backgroundColor: checked ? colors.primary : 'transparent',
          },
        ]}>
        {checked && <ThemedText style={styles.check}>✓</ThemedText>}
      </View>
      <View style={styles.labels}>
        <View style={styles.labelRow}>
          <ThemedText style={styles.label}>{label}</ThemedText>
          {required && (
            <ThemedText style={[styles.required, { color: colors.destructive }]}> *</ThemedText>
          )}
        </View>
        {sublabel && (
          <ThemedText style={[styles.sublabel, { color: colors.muted }]}>{sublabel}</ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  check: { color: '#fff', fontSize: 14, fontWeight: '700' },
  labels: { flex: 1 },
  labelRow: { flexDirection: 'row' },
  label: { fontSize: 15, fontWeight: '500' },
  required: { fontSize: 15, fontWeight: '700' },
  sublabel: { fontSize: 13, marginTop: 2 },
});
