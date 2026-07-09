import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DurationPicker } from '@/components/duration-picker';
import { ResourceList } from '@/components/resource-list';
import { ThemedText } from '@/components/themed-text';
import { AnimatedModal } from '@/components/ui/animated-modal';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { resolveEffortTier } from '@/lib/challenge-utils';
import { activitiesApi, type ActivityDetail, type ChallengeActivitySlot } from '@/lib/api';

interface Props {
  visible: boolean;
  slot: ChallengeActivitySlot | null;
  /** Initial state of the share switch — public collages default to sharing. */
  defaultShared?: boolean;
  onClose: () => void;
  onSelfReported: (slotId: string, sharedToFeed: boolean, durationMinutes: number, caption?: string) => void;
  onPhotoSelected: (
    slotId: string,
    imageUri: string,
    mimeType: string,
    sharedToFeed: boolean,
    caption?: string,
    durationMinutes?: number | null,
  ) => void;
}

interface SelectedPhoto {
  uri: string;
  mimeType: string;
}

export function CompleteActivityModal({ visible, slot, defaultShared = false, onClose, onSelfReported, onPhotoSelected }: Props) {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [picking, setPicking] = useState(false);
  const [sharedToFeed, setSharedToFeed] = useState(defaultShared);
  const [caption, setCaption] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null);
  const [withoutPhoto, setWithoutPhoto] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  // The parent nulls `slot` at the moment it closes the modal — latch the last
  // value so the content stays rendered while the exit animation plays.
  const [latchedSlot, setLatchedSlot] = useState(slot);
  const renderSlot = slot ?? latchedSlot;

  useEffect(() => {
    if (slot) setLatchedSlot(slot);
  }, [slot]);

  useEffect(() => {
    if (visible) {
      setSharedToFeed(defaultShared);
      setCaption('');
      setSelectedPhoto(null);
      setWithoutPhoto(false);
      setDurationMinutes(null);
      setInfoOpen(false);
    }
  }, [visible, defaultShared]);

  // Attached resources (prep links/notes) for the tapped activity. Kept behind
  // a collapsed toggle so the upload flow stays uncluttered; hidden entirely
  // when the activity has none.
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const activityId = slot?.activity.id ?? null;

  useEffect(() => {
    if (!visible || !activityId) return;
    let cancelled = false;
    setDetail(null);
    activitiesApi
      .getDetail(activityId)
      .then((res) => {
        if (!cancelled) setDetail(res.data);
      })
      .catch(() => {
        // no info row is shown — completing works without it
      });
    return () => {
      cancelled = true;
    };
  }, [visible, activityId]);

  const resources = detail?.resources ?? [];

  // Self-reported completions always require time. The existing 30-minute
  // point gate additionally requires it for casual-tier photo completions.
  const isCasual = renderSlot ? resolveEffortTier(renderSlot.activity) === 'casual' : false;
  const durationRequired = withoutPhoto || (isCasual && selectedPhoto !== null);
  const durationMissing = durationRequired && durationMinutes === null;

  async function pickImage() {
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0] && slot) {
        const asset = result.assets[0];
        // expo-image-picker transcodes to JPEG on iOS (even from HEIC sources) but
        // asset.mimeType still reflects the original format — normalize it.
        const rawMime = asset.mimeType ?? 'image/jpeg';
        const mimeType = (['image/jpeg', 'image/jpg', 'image/png'] as string[]).includes(rawMime)
          ? rawMime
          : 'image/jpeg';
        setSelectedPhoto({ uri: asset.uri, mimeType });
        setWithoutPhoto(false);
      }
    } finally {
      setPicking(false);
    }
  }

  function selectWithoutPhoto() {
    setSelectedPhoto(null);
    setWithoutPhoto(true);
  }

  function submit() {
    if (!slot) return;
    const normalizedCaption = caption.trim() || undefined;

    if (selectedPhoto) {
      if (durationMissing) return;
      onPhotoSelected(
        slot.id,
        selectedPhoto.uri,
        selectedPhoto.mimeType,
        sharedToFeed,
        normalizedCaption,
        isCasual ? durationMinutes : null,
      );
    } else if (withoutPhoto && durationMinutes != null) {
      onSelfReported(slot.id, sharedToFeed, durationMinutes, normalizedCaption);
    }
  }

  if (!renderSlot) return null;

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
          {
            // Symmetric vertical breathing room that always clears the notch /
            // home indicator, so the sheet never touches the top or bottom edge.
            paddingTop: insets.top + Spacing.md,
            paddingBottom: insets.bottom + Spacing.md,
          },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      >
        <ScrollView
          style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ThemedText style={[styles.activityTitle, { color: colors.onSurface }]} numberOfLines={2}>
            {renderSlot.activity.title}
          </ThemedText>

          {selectedPhoto && (
            <Image
              source={{ uri: selectedPhoto.uri }}
              style={[styles.preview, { borderRadius: radii.input }]}
              contentFit="cover"
              accessibilityLabel={t('completeModal.selectedPhoto')}
            />
          )}

          <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
            {t('completeModal.subtitle', { count: renderSlot.activity.estimated_duration_minutes })}
          </ThemedText>

          {resources.length > 0 && (
            <View style={[styles.infoBox, { borderColor: colors.border, borderRadius: radii.input }]}>
              <Pressable
                onPress={() => setInfoOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityState={{ expanded: infoOpen }}
                style={styles.infoToggle}
              >
                <ThemedText style={styles.infoIcon}>ℹ️</ThemedText>
                <ThemedText
                  style={[styles.infoToggleText, { color: colors.primary }]}
                  numberOfLines={1}
                >
                  {t('resources.toggle', { count: resources.length })}
                </ThemedText>
                <ThemedText style={[styles.infoChevron, { color: colors.muted }]}>
                  {infoOpen ? '▾' : '▸'}
                </ThemedText>
              </Pressable>
              {infoOpen && (
                <View style={styles.infoContent}>
                  <ResourceList resources={resources} compact />
                  {detail?.can_edit && (
                    <Pressable
                      onPress={() => {
                        onClose();
                        router.push({ pathname: '/activity/[id]', params: { id: activityId } } as any);
                      }}
                      accessibilityRole="button"
                      style={styles.infoEditLink}
                    >
                      <ThemedText style={[styles.infoToggleText, { color: colors.primary }]}>
                        {t('common.edit')}
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          )}

          {(withoutPhoto || (isCasual && selectedPhoto)) && (
            <>
              <ThemedText style={[styles.fieldLabel, { color: colors.muted }]}>
                {t('completeModal.durationQuestion')}
              </ThemedText>
              <DurationPicker value={durationMinutes} onChange={setDurationMinutes} />
            </>
          )}

          <ThemedText style={[styles.fieldLabel, { color: colors.muted }]}>
            {t('completeModal.description')}
          </ThemedText>
          <TextInput
            style={[
              styles.descriptionInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.input,
                color: colors.onSurface,
              },
            ]}
            value={caption}
            onChangeText={setCaption}
            placeholder={t('completeModal.descriptionPlaceholder')}
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
            maxLength={500}
            textAlignVertical="top"
          />

          <View style={[styles.shareRow, { borderColor: colors.border }]}>
            <ThemedText style={[styles.shareLabel, { color: colors.onSurface }]}>
              {t('completeModal.shareToFeed')}
            </ThemedText>
            <Switch
              value={sharedToFeed}
              onValueChange={setSharedToFeed}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <View style={styles.buttons}>
            <Pressable
              style={[
                styles.button,
                {
                  backgroundColor: selectedPhoto ? colors.primary : colors.surface,
                  borderColor: selectedPhoto ? colors.primary : colors.border,
                  borderRadius: radii.button,
                },
              ]}
              onPress={pickImage}
              disabled={picking}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedPhoto !== null, disabled: picking }}
            >
              {picking ? (
                <ActivityIndicator color={selectedPhoto ? colors.buttonText : colors.primary} />
              ) : (
                <ThemedText
                  style={[styles.buttonText, { color: selectedPhoto ? colors.buttonText : colors.onSurface }]}
                >
                  {selectedPhoto
                    ? t('completeModal.changePhoto')
                    : Platform.OS === 'web'
                      ? t('completeModal.choosePhoto')
                      : t('completeModal.photoLibrary')}
                </ThemedText>
              )}
            </Pressable>

            <Pressable
              style={[
                styles.button,
                {
                  backgroundColor: withoutPhoto ? colors.accent : colors.surface,
                  borderColor: withoutPhoto ? colors.accent : colors.border,
                  borderRadius: radii.button,
                },
              ]}
              onPress={selectWithoutPhoto}
              accessibilityRole="button"
              accessibilityState={{ selected: withoutPhoto }}
            >
              <ThemedText
                style={[styles.buttonText, { color: withoutPhoto ? colors.buttonText : colors.onSurface }]}
              >
                {withoutPhoto ? t('completeModal.withoutPhotoSelected') : t('completeModal.markWithoutPhoto')}
              </ThemedText>
            </Pressable>

            {durationMissing && (
              <ThemedText style={[styles.durationHint, { color: colors.muted }]}>
                {t('completeModal.durationRequired')}
              </ThemedText>
            )}
            <Pressable
              style={[
                styles.button,
                {
                  backgroundColor: (selectedPhoto || withoutPhoto) && !durationMissing ? colors.primary : colors.border,
                  borderColor: (selectedPhoto || withoutPhoto) && !durationMissing ? colors.primary : colors.border,
                  borderRadius: radii.button,
                },
              ]}
              onPress={submit}
              disabled={(!selectedPhoto && !withoutPhoto) || durationMissing}
              accessibilityRole="button"
              accessibilityState={{ disabled: (!selectedPhoto && !withoutPhoto) || durationMissing }}
            >
              <ThemedText
                style={[
                  styles.buttonText,
                  { color: (selectedPhoto || withoutPhoto) && !durationMissing ? colors.buttonText : colors.muted },
                ]}
              >
                {t('completeModal.upload')}
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.cancelButton, { borderColor: colors.border, borderRadius: radii.button }]}
              onPress={onClose}
              accessibilityRole="button"
            >
              <ThemedText style={{ color: colors.muted }}>{t('common.cancel')}</ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    // Centre the sheet and let it grow only as tall as its content, capped at
    // the padded area (maxHeight below) where the inner ScrollView takes over.
    justifyContent: 'center',
    paddingHorizontal: Spacing.screenHorizontal,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '100%',
    borderRadius: 20,
    borderWidth: 1,
  },
  sheetContent: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  activityTitle: { fontSize: 17, fontWeight: '700' },
  preview: { width: '100%', height: 180 },
  subtitle: { fontSize: 13, marginBottom: Spacing.xs },
  infoBox: { borderWidth: 1, marginBottom: Spacing.xs },
  infoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
  },
  infoIcon: { fontSize: 15, lineHeight: 20 },
  infoToggleText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  infoChevron: { fontSize: 14, lineHeight: 20 },
  infoContent: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm },
  infoEditLink: { alignSelf: 'flex-end', minHeight: 32, justifyContent: 'center', paddingHorizontal: Spacing.xs },
  fieldLabel: { fontSize: 12, fontWeight: '600' },
  descriptionInput: {
    minHeight: 76,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
  },
  shareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: Spacing.sm, marginBottom: Spacing.xs },
  shareLabel: { fontSize: 14, fontWeight: '500' },
  buttons: { gap: Spacing.sm },
  durationHint: { fontSize: 12, textAlign: 'center' },
  button: { height: 50, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600' },
  cancelButton: { height: 44, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
