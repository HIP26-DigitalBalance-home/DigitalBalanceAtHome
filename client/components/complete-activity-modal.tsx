import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ChallengeActivitySlot } from '@/lib/api';

interface Props {
  visible: boolean;
  slot: ChallengeActivitySlot | null;
  isGroupChallenge?: boolean;
  onClose: () => void;
  onSelfReported: (slotId: string, sharedToFeed: boolean) => void;
  onPhotoSelected: (slotId: string, imageUri: string, mimeType: string, sharedToFeed: boolean) => void;
}

export function CompleteActivityModal({ visible, slot, isGroupChallenge, onClose, onSelfReported, onPhotoSelected }: Props) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [picking, setPicking] = useState(false);
  const [sharedToFeed, setSharedToFeed] = useState(false);

  useEffect(() => {
    if (visible) setSharedToFeed(false);
  }, [visible]);

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
        const mimeType = asset.mimeType ?? 'image/jpeg';
        onPhotoSelected(slot.id, asset.uri, mimeType, sharedToFeed);
      }
    } finally {
      setPicking(false);
    }
  }

  if (!slot) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <ThemedText style={[styles.activityTitle, { color: colors.onSurface }]} numberOfLines={2}>
            {slot.activity.title}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
            ⏱ {slot.activity.estimated_duration_minutes} min · Mark as complete
          </ThemedText>

          {isGroupChallenge && (
            <View style={[styles.shareRow, { borderColor: colors.border }]}>
              <ThemedText style={[styles.shareLabel, { color: colors.onSurface }]}>Share to group feed</ThemedText>
              <Switch
                value={sharedToFeed}
                onValueChange={setSharedToFeed}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
          )}

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
                  {Platform.OS === 'web' ? '📎 Choose photo' : '🖼 Photo library'}
                </ThemedText>
              )}
            </Pressable>

            <Pressable
              style={[styles.button, { backgroundColor: colors.accent }]}
              onPress={() => slot && onSelfReported(slot.id, sharedToFeed)}
            >
              <ThemedText style={styles.buttonText}>✓ Mark without photo</ThemedText>
            </Pressable>

            <Pressable
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <ThemedText style={{ color: colors.muted }}>Cancel</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
