import { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ImageWithFallback } from '@/components/ui/image-with-fallback';
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
  const { width } = Dimensions.get('window');
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

  const cardWidth = width - Spacing.screenHorizontal * 2;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { width: cardWidth, backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Photo with X overlaid */}
          <View style={[styles.photoContainer, { width: cardWidth, height: cardWidth * 0.75 }]}>
            {photoUrl && completionId ? (
              <ImageWithFallback
                uri={photoUrl}
                completionId={completionId}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
                accessibilityLabel={`Foto: ${activityTitle}`}
              />
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <ThemedText style={styles.closeText}>✕</ThemedText>
            </Pressable>
          </View>

          {/* Title + buttons */}
          <View style={styles.body}>
            <ThemedText style={[styles.title, { color: colors.onSurface }]} numberOfLines={2}>
              {activityTitle}
            </ThemedText>

            <Pressable
              style={[styles.actionButton, { borderColor: colors.primary }]}
              onPress={handleDownload}
              disabled={downloading}
            >
              {downloading
                ? <ActivityIndicator color={colors.primary} />
                : <ThemedText style={[styles.actionText, { color: colors.primary }]}>⬇ Download</ThemedText>}
            </Pressable>

            <Pressable
              style={[styles.actionButton, { borderColor: colors.destructive }]}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator color={colors.destructive} />
                : <ThemedText style={[styles.actionText, { color: colors.destructive }]}>🗑 Delete</ThemedText>}
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
    justifyContent: 'center',
    paddingHorizontal: Spacing.screenHorizontal,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  photoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  body: { padding: Spacing.md, gap: Spacing.sm },
  title: { fontSize: 15, fontWeight: '600' },
  actionButton: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 15, fontWeight: '600' },
});
