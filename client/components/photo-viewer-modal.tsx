import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { completionsApi } from '@/lib/api';

interface Props {
  visible: boolean;
  photoUrl: string | null;
  completionId: string | null;
  activityTitle: string;
  familiesCompletedCount?: number | null;
  groupFamiliesCount?: number | null;
  onClose: () => void;
  onDeleted: (completionId: string) => void;
}

// Same lerp as in collage-grid: sand #E8C99A → salmon #F4845F
function progressColor(ratio: number): string {
  const r = Math.round(232 + (244 - 232) * ratio);
  const g = Math.round(201 + (132 - 201) * ratio);
  const b = Math.round(154 + (95  - 154) * ratio);
  return `rgb(${r},${g},${b})`;
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

export function PhotoViewerModal({ visible, photoUrl, completionId, activityTitle, familiesCompletedCount, groupFamiliesCount, onClose, onDeleted }: Props) {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();
  const { width } = Dimensions.get('window');
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDelete() {
    if (!completionId) return;
    const confirmed = Platform.OS === 'web'
      ? window.confirm(t('photoViewer.deleteConfirm'))
      : true; // Alert.alert callback not needed — we confirm inline
    if (!confirmed) return;

    setDeleting(true);
    try {
      await completionsApi.delete(completionId);
      onDeleted(completionId);
      onClose();
    } catch {
      if (Platform.OS === 'web') window.alert(t('photoViewer.deleteFailed'));
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
      if (Platform.OS === 'web') window.alert(t('photoViewer.downloadFailed'));
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
                accessibilityLabel={t('photoViewer.photoOf', { title: activityTitle })}
              />
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <ThemedText style={styles.closeText}>✕</ThemedText>
            </Pressable>
          </View>

          {/* Title + group progress + buttons */}
          <View style={styles.body}>
            <ThemedText style={[styles.title, { color: colors.onSurface }]} numberOfLines={2}>
              {activityTitle}
            </ThemedText>

            {groupFamiliesCount != null && groupFamiliesCount > 0 && familiesCompletedCount != null && (
              <View style={styles.progressSection}>
                <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                  {familiesCompletedCount > 0 && (
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(familiesCompletedCount / groupFamiliesCount, 1) * 100}%` as any,
                          backgroundColor: progressColor(familiesCompletedCount / groupFamiliesCount),
                        },
                      ]}
                    />
                  )}
                </View>
                <ThemedText style={[styles.progressLabel, { color: colors.muted }]}>
                  {familiesCompletedCount} / {groupFamiliesCount} Familien
                </ThemedText>
              </View>
            )}

            <Pressable
              style={[styles.actionButton, { borderColor: colors.primary }]}
              onPress={handleDownload}
              disabled={downloading}
            >
              {downloading
                ? <ActivityIndicator color={colors.primary} />
                : <ThemedText style={[styles.actionText, { color: colors.primary }]}>⬇ {t('photoViewer.download')}</ThemedText>}
            </Pressable>

            <Pressable
              style={[styles.actionButton, { borderColor: colors.destructive }]}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator color={colors.destructive} />
                : <ThemedText style={[styles.actionText, { color: colors.destructive }]}>🗑 {t('common.delete')}</ThemedText>}
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
  progressSection: { gap: 6 },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: 5, borderRadius: 3 },
  progressLabel: { fontSize: 12 },
  actionButton: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 15, fontWeight: '600' },
});
