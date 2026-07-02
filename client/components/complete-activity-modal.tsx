import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { AnimatedModal } from '@/components/ui/animated-modal';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import type { ChallengeActivitySlot } from '@/lib/api';

interface Props {
  visible: boolean;
  slot: ChallengeActivitySlot | null;
  /** Initial state of the share switch — public collages default to sharing. */
  defaultShared?: boolean;
  onClose: () => void;
  onSelfReported: (slotId: string, sharedToFeed: boolean) => void;
  onPhotoSelected: (slotId: string, imageUri: string, mimeType: string, sharedToFeed: boolean) => void;
}

export function CompleteActivityModal({ visible, slot, defaultShared = false, onClose, onSelfReported, onPhotoSelected }: Props) {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();
  const [picking, setPicking] = useState(false);
  const [sharedToFeed, setSharedToFeed] = useState(defaultShared);
  // The parent nulls `slot` at the moment it closes the modal — latch the last
  // value so the content stays rendered while the exit animation plays.
  const [latchedSlot, setLatchedSlot] = useState(slot);
  const renderSlot = slot ?? latchedSlot;

  useEffect(() => {
    if (slot) setLatchedSlot(slot);
  }, [slot]);

  useEffect(() => {
    if (visible) setSharedToFeed(defaultShared);
  }, [visible, defaultShared]);

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
        onPhotoSelected(slot.id, asset.uri, mimeType, sharedToFeed);
      }
    } finally {
      setPicking(false);
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
      <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <ThemedText style={[styles.activityTitle, { color: colors.onSurface }]} numberOfLines={2}>
          {renderSlot.activity.title}
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
          {t('completeModal.subtitle', { count: renderSlot.activity.estimated_duration_minutes })}
        </ThemedText>

        <View style={[styles.shareRow, { borderColor: colors.border }]}>
          <ThemedText style={[styles.shareLabel, { color: colors.onSurface }]}>{t('completeModal.shareToFeed')}</ThemedText>
          <Switch
            value={sharedToFeed}
            onValueChange={setSharedToFeed}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        <View style={styles.buttons}>
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={pickImage}
            disabled={picking}
          >
            {picking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>
                {Platform.OS === 'web' ? t('completeModal.choosePhoto') : t('completeModal.photoLibrary')}
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            style={[styles.button, { backgroundColor: colors.accent }]}
            onPress={() => slot && onSelfReported(slot.id, sharedToFeed)}
          >
            <ThemedText style={styles.buttonText}>{t('completeModal.markWithoutPhoto')}</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.cancelButton, { borderColor: colors.border }]}
            onPress={onClose}
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
    justifyContent: 'flex-end',
    paddingBottom: 32,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginHorizontal: Spacing.screenHorizontal,
  },
  activityTitle: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 13, marginBottom: Spacing.sm },
  shareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: Spacing.sm, marginBottom: Spacing.xs },
  shareLabel: { fontSize: 14, fontWeight: '500' },
  buttons: { gap: Spacing.sm },
  button: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cancelButton: { height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
