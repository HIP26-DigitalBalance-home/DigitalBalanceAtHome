import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AnimatedModal } from '@/components/ui/animated-modal';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import type { ResourceKind } from '@/lib/api';

export interface ResourceDraft {
  key: string;
  kind: ResourceKind;
  label?: string | null;
  url?: string | null;
  noteText?: string | null;
  photoUri?: string | null;
  photoMime?: string | null;
}

interface Props {
  visible: boolean;
  /** When set the sheet edits this draft (kind is fixed); otherwise it creates a new one. */
  initial?: ResourceDraft | null;
  /** Hide the photo picker (editing an existing resource — photos are managed inline). */
  allowPhoto?: boolean;
  onClose: () => void;
  onSave: (draft: ResourceDraft) => void;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function AddResourceSheet({ visible, initial = null, allowPhoto = true, onClose, onSave }: Props) {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [kind, setKind] = useState<ResourceKind | null>(null);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [noteText, setNoteText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setKind(initial?.kind ?? null);
    setLabel(initial?.label ?? '');
    setUrl(initial?.url ?? '');
    setNoteText(initial?.noteText ?? '');
    setPhotoUri(initial?.photoUri ?? null);
    setPhotoMime(initial?.photoMime ?? null);
    setError(null);
  }, [visible, initial]);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const rawMime = asset.mimeType ?? 'image/jpeg';
      const mimeType = (['image/jpeg', 'image/jpg', 'image/png'] as string[]).includes(rawMime)
        ? rawMime
        : 'image/jpeg';
      setPhotoUri(asset.uri);
      setPhotoMime(mimeType);
    }
  }

  function save() {
    if (kind === 'external') {
      if (!isValidHttpUrl(url.trim())) {
        setError(t('resources.invalidUrl'));
        return;
      }
    } else {
      if (!noteText.trim() && !photoUri) {
        setError(t('resources.emptyNote'));
        return;
      }
    }
    onSave({
      key: initial?.key ?? `draft-${Date.now()}`,
      kind: kind ?? 'internal',
      label: label.trim() || null,
      url: kind === 'external' ? url.trim() : null,
      noteText: kind === 'internal' ? noteText.trim() || null : null,
      photoUri: kind === 'internal' ? photoUri : null,
      photoMime: kind === 'internal' ? photoMime : null,
    });
  }

  return (
    <AnimatedModal
      visible={visible}
      variant="dialog"
      onRequestClose={onClose}
      onBackdropPress={onClose}
      contentContainerStyle={styles.container}
    >
      <KeyboardAvoidingView
        style={[
          styles.keyboardAvoidingView,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.md },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      >
        <ScrollView
          style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {kind === null ? (
            <>
              <ThemedText style={styles.title}>{t('resources.chooseType')}</ThemedText>
              <View style={styles.kindRow}>
                <Pressable
                  style={[styles.kindChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setKind('external')}
                  accessibilityRole="button"
                >
                  <ThemedText style={styles.kindChipText}>{t('resources.linkOption')}</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.kindChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setKind('internal')}
                  accessibilityRole="button"
                >
                  <ThemedText style={styles.kindChipText}>{t('resources.noteOption')}</ThemedText>
                </Pressable>
              </View>
              <Pressable onPress={onClose} style={styles.cancelButton} accessibilityRole="button">
                <ThemedText style={{ color: colors.muted }}>{t('resources.cancel')}</ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText style={styles.title}>
                {kind === 'external' ? t('resources.linkOption') : t('resources.noteOption')}
              </ThemedText>

              {error && (
                <ThemedText style={[styles.errorText, { color: colors.destructive }]}>{error}</ThemedText>
              )}

              {kind === 'external' ? (
                <>
                  <ThemedText style={[styles.fieldLabel, { color: colors.muted }]}>
                    {t('resources.linkUrlLabel')}
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.input, color: colors.onSurface }]}
                    value={url}
                    onChangeText={setUrl}
                    placeholder={t('resources.linkUrlPlaceholder')}
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    maxLength={2048}
                  />
                  <ThemedText style={[styles.fieldLabel, { color: colors.muted }]}>
                    {t('resources.linkLabelLabel')}
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.input, color: colors.onSurface }]}
                    value={label}
                    onChangeText={setLabel}
                    placeholder={t('resources.linkLabelPlaceholder')}
                    placeholderTextColor={colors.muted}
                    maxLength={100}
                  />
                </>
              ) : (
                <>
                  <ThemedText style={[styles.fieldLabel, { color: colors.muted }]}>
                    {t('resources.noteLabel')}
                  </ThemedText>
                  <TextInput
                    style={[styles.input, styles.textarea, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.input, color: colors.onSurface }]}
                    value={noteText}
                    onChangeText={setNoteText}
                    placeholder={t('resources.notePlaceholder')}
                    placeholderTextColor={colors.muted}
                    multiline
                    numberOfLines={4}
                    maxLength={2000}
                  />
                  {allowPhoto && (
                    <>
                      {photoUri && (
                        <Image
                          source={{ uri: photoUri }}
                          style={[styles.preview, { borderRadius: radii.input }]}
                          contentFit="cover"
                          accessibilityLabel={t('resources.photoSelected')}
                        />
                      )}
                      <Pressable
                        style={[styles.photoButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={pickImage}
                        accessibilityRole="button"
                      >
                        <ThemedText style={{ color: colors.onSurface }}>
                          {photoUri ? t('resources.changePhoto') : t('resources.addPhoto')}
                        </ThemedText>
                      </Pressable>
                    </>
                  )}
                </>
              )}

              <View style={styles.actionsRow}>
                <Pressable onPress={onClose} style={styles.cancelButton} accessibilityRole="button">
                  <ThemedText style={{ color: colors.muted }}>{t('resources.cancel')}</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={save}
                  accessibilityRole="button"
                >
                  <ThemedText style={[styles.saveText, { color: colors.buttonText }]}>
                    {t('resources.save')}
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardAvoidingView: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.screenHorizontal },
  sheet: { borderRadius: 16, borderWidth: 1, maxHeight: '100%', flexGrow: 0 },
  sheetContent: { padding: Spacing.lg, gap: Spacing.md },
  title: { fontSize: 17, fontWeight: '600' },
  errorText: { fontSize: 13 },
  kindRow: { flexDirection: 'row', gap: Spacing.sm },
  kindChip: { flex: 1, paddingVertical: Spacing.lg, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  kindChipText: { fontSize: 15, fontWeight: '600' },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  input: { minHeight: 48, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: 15 },
  textarea: { height: 96, paddingTop: Spacing.sm, textAlignVertical: 'top' },
  preview: { width: '100%', height: 160 },
  photoButton: { minHeight: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: Spacing.md },
  cancelButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.sm },
  saveButton: { minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  saveText: { fontSize: 15, fontWeight: '600' },
});
