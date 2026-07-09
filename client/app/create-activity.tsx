import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddResourceSheet, type ResourceDraft } from '@/components/add-resource-sheet';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { activitiesApi, type CreateActivityPayload } from '@/lib/api';
import { pendingActivity } from '@/lib/pending-activity';
import { getGermanErrorMessage } from '@/lib/utils/api-error';

type Cost = 'free' | 'low_cost';

const MAX_RESOURCES = 10;

export default function CreateActivityScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('30');
  const [cost, setCost] = useState<Cost>('free');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ResourceDraft[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);

  function addDraft(draft: ResourceDraft) {
    setDrafts((prev) => [...prev, draft]);
    setSheetVisible(false);
  }

  function removeDraft(key: string) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  async function submit() {
    if (!title.trim()) {
      setError(t('createActivity.titleRequired'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const parsedDuration = parseInt(duration, 10);
      const payload: CreateActivityPayload = {
        title: title.trim(),
        description: description.trim() || null,
        estimated_duration_minutes: Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 30,
        cost_indicator: cost,
      };
      const res = await activitiesApi.create(payload);

      // The activity exists from here on — a failed resource never blocks the
      // save, it can be re-added later from the activity's detail screen.
      for (const draft of drafts) {
        try {
          if (draft.kind === 'internal' && draft.photoUri) {
            await activitiesApi.createResourcePhoto(
              res.data.id,
              draft.photoUri,
              draft.photoMime ?? 'image/jpeg',
              draft.noteText,
            );
          } else {
            await activitiesApi.createResource(res.data.id, {
              kind: draft.kind,
              label: draft.label,
              url: draft.url,
              note_text: draft.noteText,
            });
          }
        } catch {
          // best-effort per resource
        }
      }

      pendingActivity.set(res.data);
      router.back();
    } catch (e) {
      setError(getGermanErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  function draftPreview(draft: ResourceDraft): string {
    if (draft.kind === 'external') return draft.label || draft.url || '';
    if (draft.noteText) return draft.noteText;
    return t('resources.photoSelected');
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <ThemedText style={{ color: colors.primary }}>← {t('common.back')}</ThemedText>
        </Pressable>
        <ThemedText style={styles.headerTitle}>{t('createActivity.title')}</ThemedText>
        <View style={{ width: 60 }} />
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: colors.destructive + '15' }]}>
          <ThemedText style={[styles.errorText, { color: colors.destructive }]}>{error}</ThemedText>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={[styles.label, { color: colors.muted }]}>{t('createActivity.titleLabel')}</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]}
          value={title}
          onChangeText={setTitle}
          placeholder={t('createActivity.titlePlaceholder')}
          placeholderTextColor={colors.muted}
          maxLength={100}
        />

        <ThemedText style={[styles.label, { color: colors.muted }]}>{t('createActivity.descLabel')}</ThemedText>
        <TextInput
          style={[styles.input, styles.textarea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]}
          value={description}
          onChangeText={setDescription}
          placeholder={t('createActivity.descPlaceholder')}
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={3}
          maxLength={500}
        />

        <ThemedText style={[styles.label, { color: colors.muted }]}>{t('createActivity.durationLabel')}</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]}
          value={duration}
          onChangeText={(t) => setDuration(t.replace(/[^0-9]/g, ''))}
          placeholder="30"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
        />

        <ThemedText style={[styles.label, { color: colors.muted }]}>{t('createActivity.costLabel')}</ThemedText>
        <View style={styles.costRow}>
          {(['free', 'low_cost'] as Cost[]).map((c) => (
            <Pressable
              key={c}
              style={[styles.costChip, { backgroundColor: cost === c ? colors.primary : colors.surface, borderColor: cost === c ? colors.primary : colors.border }]}
              onPress={() => setCost(c)}
            >
              <ThemedText style={[styles.costChipText, { color: cost === c ? '#fff' : colors.onSurface }]}>
                {c === 'free' ? t('cost.free') : t('cost.lowCost')}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText style={[styles.label, { color: colors.muted }]}>{t('resources.sectionTitle')}</ThemedText>
        <ThemedText style={[styles.sectionHint, { color: colors.muted }]}>{t('resources.sectionHint')}</ThemedText>

        {drafts.map((draft) => (
          <View
            key={draft.key}
            style={[styles.resourceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <ThemedText style={styles.resourceIcon}>{draft.kind === 'external' ? '🔗' : '📝'}</ThemedText>
            <View style={styles.resourceBody}>
              <ThemedText numberOfLines={2} style={{ color: colors.onSurface }}>
                {draftPreview(draft)}
              </ThemedText>
              {draft.kind === 'internal' && draft.photoUri && draft.noteText ? (
                <ThemedText style={[styles.resourceMeta, { color: colors.muted }]}>
                  {t('resources.photoSelected')}
                </ThemedText>
              ) : null}
            </View>
            <Pressable onPress={() => removeDraft(draft.key)} accessibilityRole="button" hitSlop={8}>
              <ThemedText style={{ color: colors.destructive }}>{t('resources.remove')}</ThemedText>
            </Pressable>
          </View>
        ))}

        {drafts.length === 0 && (
          <ThemedText style={[styles.resourceMeta, { color: colors.muted }]}>{t('resources.none')}</ThemedText>
        )}

        {drafts.length < MAX_RESOURCES && (
          <Pressable
            style={[styles.addResourceButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => setSheetVisible(true)}
            accessibilityRole="button"
          >
            <ThemedText style={{ color: colors.primary }}>+ {t('resources.addButton')}</ThemedText>
          </Pressable>
        )}

        <Pressable
          style={[styles.submitButton, { backgroundColor: submitting ? colors.muted : colors.primary }]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <ThemedText style={[styles.submitText, { color: colors.buttonText }]}>{t('createActivity.submit')}</ThemedText>
          )}
        </Pressable>
      </ScrollView>

      <AddResourceSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSave={addDraft}
      />
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
  headerTitle: { fontSize: 16, fontWeight: '600' },
  errorBox: { marginHorizontal: Spacing.screenHorizontal, marginTop: Spacing.sm, borderRadius: 8, padding: Spacing.sm },
  errorText: { fontSize: 13 },
  content: { padding: Spacing.screenHorizontal, gap: Spacing.md },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  input: { minHeight: 48, borderRadius: 10, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: 15 },
  textarea: { height: 96, paddingTop: Spacing.sm, textAlignVertical: 'top' },
  costRow: { flexDirection: 'row', gap: Spacing.sm },
  costChip: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  costChipText: { fontSize: 14, fontWeight: '600' },
  sectionHint: { fontSize: 13, marginTop: -Spacing.sm },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    padding: Spacing.md,
  },
  resourceIcon: { fontSize: 18 },
  resourceBody: { flex: 1, gap: 2 },
  resourceMeta: { fontSize: 12 },
  addResourceButton: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md },
  submitText: { fontSize: 16, fontWeight: '600' },
});
