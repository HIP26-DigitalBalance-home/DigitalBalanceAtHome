import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { AnimatedModal } from '@/components/ui/animated-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { photosApi } from '@/lib/api';
import { getGermanErrorMessage } from '@/lib/utils/api-error';
import { showAlert } from '@/lib/utils/alert';

interface Props {
  visible: boolean;
  completionId: string | null;
  rejectionReason: string | null;
  activityTitle?: string;
  onClose: () => void;
  /** Called after a successful re-upload so the parent can refresh/poll. */
  onReuploaded: (completionId: string) => void;
}

interface SelectedPhoto {
  uri: string;
  mimeType: string;
}

export function ReuploadModal({ visible, completionId, rejectionReason, activityTitle, onClose, onReuploaded }: Props) {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null);

  useEffect(() => {
    if (visible) setSelectedPhoto(null);
  }, [visible]);

  async function pickImage() {
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // expo-image-picker transcodes to JPEG on iOS (even from HEIC sources) but
        // asset.mimeType still reflects the original format — normalize it.
        const rawMime = asset.mimeType ?? 'image/jpeg';
        const mimeType = (['image/jpeg', 'image/jpg', 'image/png'] as string[]).includes(rawMime)
          ? rawMime
          : 'image/jpeg';
        setSelectedPhoto({ uri: asset.uri, mimeType });
      }
    } finally {
      setPicking(false);
    }
  }

  async function submit() {
    if (!completionId || !selectedPhoto || uploading) return;
    setUploading(true);
    try {
      await photosApi.reupload(completionId, selectedPhoto.uri, selectedPhoto.mimeType);
      onReuploaded(completionId);
      onClose();
    } catch (e) {
      showAlert(t('common.error'), getGermanErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <AnimatedModal
      visible={visible}
      variant="dialog"
      onRequestClose={onClose}
      onBackdropPress={onClose}
      contentContainerStyle={styles.container}
    >
      <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
        {activityTitle ? (
          <ThemedText style={[styles.activityTitle, { color: colors.onSurface }]} numberOfLines={2}>
            {activityTitle}
          </ThemedText>
        ) : null}

        <View style={styles.rejectedRow}>
          <IconSymbol name="exclamationmark" color={colors.destructive} size={18} />
          <ThemedText style={[styles.rejectedTitle, { color: colors.destructive }]}>
            {t('verification.rejected')}
          </ThemedText>
        </View>

        <ThemedText style={[styles.reasonLabel, { color: colors.muted }]}>
          {t('verification.rejectionReason')}
        </ThemedText>
        <ThemedText style={[styles.reasonText, { color: colors.onSurface }]}>
          {rejectionReason || t('verification.noReason')}
        </ThemedText>

        <ThemedText style={[styles.hintText, { color: colors.muted }]}>
          {t('verification.reupload')}
        </ThemedText>

        {selectedPhoto && (
          <Image
            source={{ uri: selectedPhoto.uri }}
            style={[styles.preview, { borderRadius: radii.input }]}
            contentFit="cover"
            accessibilityLabel={t('verification.selectedPhoto')}
          />
        )}

        <View style={styles.buttons}>
          <Pressable
            style={[
              styles.button,
              {
                backgroundColor: selectedPhoto ? colors.surface : colors.primary,
                borderColor: selectedPhoto ? colors.border : colors.primary,
                borderRadius: radii.button,
              },
            ]}
            onPress={pickImage}
            disabled={picking || uploading}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedPhoto !== null, disabled: picking || uploading }}
          >
            {picking ? (
              <ActivityIndicator color={selectedPhoto ? colors.primary : colors.buttonText} />
            ) : (
              <ThemedText style={[styles.buttonText, { color: selectedPhoto ? colors.onSurface : colors.buttonText }]}>
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
                backgroundColor: selectedPhoto ? colors.primary : colors.border,
                borderColor: selectedPhoto ? colors.primary : colors.border,
                borderRadius: radii.button,
              },
            ]}
            onPress={submit}
            disabled={!selectedPhoto || uploading}
            accessibilityRole="button"
            accessibilityState={{ disabled: !selectedPhoto || uploading }}
          >
            {uploading ? (
              <ActivityIndicator color={colors.buttonText} />
            ) : (
              <ThemedText style={[styles.buttonText, { color: selectedPhoto ? colors.buttonText : colors.muted }]}>
                {t('verification.reuploadButton')}
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            style={[styles.cancelButton, { borderColor: colors.border, borderRadius: radii.button }]}
            onPress={onClose}
            disabled={uploading}
            accessibilityRole="button"
          >
            <ThemedText style={{ color: colors.muted }}>{t('common.cancel')}</ThemedText>
          </Pressable>
        </View>
      </View>
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.screenHorizontal,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  activityTitle: { fontSize: 17, fontWeight: '700' },
  rejectedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  rejectedTitle: { fontSize: 15, fontWeight: '700' },
  reasonLabel: { fontSize: 12, fontWeight: '600' },
  reasonText: { fontSize: 14, lineHeight: 20 },
  hintText: { fontSize: 13, lineHeight: 18 },
  preview: { width: '100%', height: 180 },
  buttons: { gap: Spacing.sm, marginTop: Spacing.xs },
  button: { height: 50, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600' },
  cancelButton: { height: 44, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
