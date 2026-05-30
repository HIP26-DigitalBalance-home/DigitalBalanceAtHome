import { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { completionsApi } from '@/lib/api';

interface Props {
  visible: boolean;
  photoUrl: string | null;
  completionId: string | null;
  activityTitle: string;
  onClose: () => void;
  onDeleted: (completionId: string) => void;
}

async function downloadPhoto(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export function PhotoViewerModal({ visible, photoUrl, completionId, activityTitle, onClose, onDeleted }: Props) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { width, height } = Dimensions.get('window');
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDelete() {
    if (!completionId) return;
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Delete this photo? This cannot be undone.')
      : true; // Alert.alert callback not needed — we confirm inline
    if (!confirmed) return;

    setDeleting(true);
    try {
      await completionsApi.delete(completionId);
      onDeleted(completionId);
      onClose();
    } catch {
      if (Platform.OS === 'web') window.alert('Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownload() {
    if (!photoUrl) return;
    setDownloading(true);
    try {
      const safeName = activityTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      await downloadPhoto(photoUrl, `${safeName}.jpg`);
    } catch {
      if (Platform.OS === 'web') window.alert('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Close button */}
        <Pressable style={styles.closeButton} onPress={onClose}>
          <ThemedText style={styles.closeText}>✕</ThemedText>
        </Pressable>

        {/* Activity title */}
        <ThemedText style={styles.title} numberOfLines={2}>{activityTitle}</ThemedText>

        {/* Photo */}
        <View style={[styles.imageContainer, { width, height: height * 0.65 }]}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={{ width, height: height * 0.65 }}
              resizeMode="contain"
            />
          ) : (
            <ActivityIndicator color="#fff" />
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
            onPress={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.actionText}>⬇ Download</ThemedText>
            )}
          </Pressable>

          <Pressable
            style={[styles.actionButton, { backgroundColor: colors.destructive + 'CC' }]}
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.actionText}>🗑 Delete</ThemedText>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    marginTop: 60,
  },
  imageContainer: { alignItems: 'center', justifyContent: 'center' },
  actions: {
    flexDirection: 'column',
    gap: Spacing.sm,
    width: '100%',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.xl,
  },
  actionButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
