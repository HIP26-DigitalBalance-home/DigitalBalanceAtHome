import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { groupsApi } from '@/lib/api';

export default function CreateGroupScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0;

  async function handleCreate() {
    setIsSubmitting(true);
    setError(null);
    try {
      await groupsApi.postGroup({
        name: name.trim(),
        description: description.trim() || null,
      });
      router.back();
    } catch {
      setError('Failed to create group. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary, fontSize: 16 }}>Cancel</ThemedText>
        </Pressable>
        <ThemedText type="defaultSemiBold" style={styles.headerTitle}>New Group</ThemedText>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <View style={styles.field}>
          <ThemedText style={styles.label}>Group name *</ThemedText>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
            placeholder="e.g. 3B Class Parents"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>Description (optional)</ThemedText>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
            placeholder="What is this group for?"
            placeholderTextColor={colors.muted}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {error && (
          <ThemedText style={{ color: colors.destructive, fontSize: 14 }}>{error}</ThemedText>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.button, { backgroundColor: canSubmit ? colors.primary : colors.border, opacity: isSubmitting ? 0.7 : 1 }]}
          onPress={handleCreate}
          disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>Create group</ThemedText>
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
  field: { gap: Spacing.xs },
  label: { fontSize: 14, fontWeight: '500' },
  input: { height: 52, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: Spacing.md, fontSize: 16 },
  footer: { padding: Spacing.screenHorizontal, paddingBottom: Spacing.xl },
  button: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
