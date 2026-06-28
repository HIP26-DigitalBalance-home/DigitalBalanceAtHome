import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { CATEGORY_KEY_SET, INTEREST_CATEGORIES } from '@/constants/interest-categories';
import { useAppTheme } from '@/lib/app-theme-context';

const MAX_TOTAL = 20;
const MAX_CHAR = 60;

interface InterestPickerProps {
  value: string[];
  onChange: (interests: string[]) => void;
}

export function InterestPicker({ value, onChange }: InterestPickerProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const customTags = value.filter((v) => !CATEGORY_KEY_SET.has(v));

  function toggleCategory(key: string) {
    if (value.includes(key)) {
      onChange(value.filter((v) => v !== key));
    } else {
      onChange([...value, key]);
    }
  }

  function addCustomTag() {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (trimmed.length > MAX_CHAR) {
      setError(t('interests.charLimitError'));
      return;
    }
    if (value.length >= MAX_TOTAL) {
      setError(t('interests.capError'));
      return;
    }
    if (value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      setInput('');
      return;
    }

    setError(null);
    setInput('');
    onChange([...value, trimmed]);
  }

  function removeTag(tag: string) {
    onChange(value.filter((v) => v !== tag));
  }

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.sectionLabel, { color: colors.text }]}>
        {t('interests.sectionLabel')}
      </ThemedText>

      {/* Category grid */}
      <View style={styles.grid}>
        {INTEREST_CATEGORIES.map((cat) => {
          const selected = value.includes(cat.key);
          return (
            <Pressable
              key={cat.key}
              onPress={() => toggleCategory(cat.key)}
              style={[
                styles.card,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}>
              <MaterialIcons
                name={cat.icon as any}
                size={24}
                color={selected ? colors.buttonText : colors.muted}
              />
              <ThemedText
                style={[
                  styles.cardLabel,
                  { color: selected ? colors.buttonText : colors.text },
                ]}>
                {t(cat.labelKey)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* Custom tag input */}
      <ThemedText style={[styles.customLabel, { color: colors.text }]}>
        {t('interests.customLabel')}
      </ThemedText>
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: error ? colors.destructive : colors.border,
              color: colors.text,
              backgroundColor: colors.surface,
              flex: 1,
            },
          ]}
          placeholder={t('interests.customPlaceholder')}
          placeholderTextColor={colors.muted}
          value={input}
          onChangeText={(v) => { setInput(v); setError(null); }}
          onSubmitEditing={addCustomTag}
          returnKeyType="done"
          maxLength={MAX_CHAR + 1}
        />
        <Pressable
          onPress={addCustomTag}
          style={[styles.addButton, { backgroundColor: colors.primary }]}>
          <ThemedText style={[styles.addButtonText, { color: colors.buttonText }]}>
            {t('interests.addButton')}
          </ThemedText>
        </Pressable>
      </View>
      {error && (
        <ThemedText style={[styles.error, { color: colors.destructive }]}>{error}</ThemedText>
      )}

      {/* Custom tag chips */}
      {customTags.length > 0 && (
        <View style={styles.chips}>
          {customTags.map((tag) => (
            <View
              key={tag}
              style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.chipText, { color: colors.text }]}>{tag}</ThemedText>
              <Pressable onPress={() => removeTag(tag)} style={styles.chipRemove} hitSlop={8}>
                <MaterialIcons name="close" size={14} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  sectionLabel: { fontSize: 14, fontWeight: '500' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  card: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  cardLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  customLabel: { fontSize: 14, fontWeight: '500', marginTop: Spacing.xs },
  inputRow: { flexDirection: 'row', gap: Spacing.sm },
  input: {
    height: 44,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
  },
  addButton: {
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { fontSize: 14, fontWeight: '600' },
  error: { fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  chipText: { fontSize: 13 },
  chipRemove: { padding: 2 },
});
