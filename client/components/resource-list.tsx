import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import type { ActivityResource } from '@/lib/api';
import { showAlert } from '@/lib/utils/alert';

interface Props {
  resources: ActivityResource[];
  /** Smaller photos and paddings for embedding inside a modal. */
  compact?: boolean;
  /** When set, per-resource edit/remove and per-photo remove affordances render. */
  canEdit?: boolean;
  onEditResource?: (resource: ActivityResource) => void;
  onRemoveResource?: (resourceId: string) => void;
  onRemovePhoto?: (resourceId: string, photoId: string) => void;
}

function urlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function ResourceList({
  resources,
  compact = false,
  canEdit = false,
  onEditResource,
  onRemoveResource,
  onRemovePhoto,
}: Props) {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();

  async function openExternal(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      showAlert(t('resources.openFailed'));
    }
  }

  const photoSize = compact ? styles.photoCompact : styles.photo;

  return (
    <View style={styles.list}>
      {resources.map((resource) => (
        <View
          key={resource.id}
          style={[
            compact ? styles.cardCompact : styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {resource.kind === 'external' ? (
            <Pressable
              onPress={() => resource.url && openExternal(resource.url)}
              accessibilityRole="link"
              style={styles.row}
            >
              <ThemedText style={styles.icon}>🔗</ThemedText>
              <View style={styles.body}>
                <ThemedText style={{ color: colors.primary }} numberOfLines={2}>
                  {resource.label || (resource.url ? urlHost(resource.url) : '')}
                </ThemedText>
                <ThemedText style={[styles.meta, { color: colors.muted }]}>
                  ↗ {t('resources.externalHint')}
                  {resource.label && resource.url ? ` · ${urlHost(resource.url)}` : ''}
                </ThemedText>
              </View>
            </Pressable>
          ) : (
            <View style={styles.row}>
              <ThemedText style={styles.icon}>📝</ThemedText>
              <View style={styles.body}>
                {resource.label ? <ThemedText style={styles.label}>{resource.label}</ThemedText> : null}
                {resource.note_text ? (
                  <ThemedText style={{ color: colors.onSurface }}>{resource.note_text}</ThemedText>
                ) : null}
                {resource.photos && resource.photos.length > 0 && (
                  <View style={styles.photoRow}>
                    {resource.photos.map((photo) => (
                      <View key={photo.id}>
                        {photo.status === 'ready' && photo.photo_url ? (
                          <Image
                            source={{ uri: photo.photo_url }}
                            style={[photoSize, { borderRadius: radii.input }]}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={[photoSize, styles.photoPlaceholder, { borderRadius: radii.input, backgroundColor: colors.border }]}
                          >
                            <ThemedText style={[styles.meta, { color: colors.muted }]}>
                              {t('resources.processing')}
                            </ThemedText>
                          </View>
                        )}
                        {canEdit && onRemovePhoto && (
                          <Pressable
                            onPress={() => onRemovePhoto(resource.id, photo.id)}
                            accessibilityRole="button"
                            hitSlop={8}
                            style={[styles.photoRemove, { backgroundColor: colors.background, borderColor: colors.border }]}
                          >
                            <ThemedText style={{ color: colors.destructive, fontSize: 12 }}>✕</ThemedText>
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {canEdit && (
            <View style={[styles.actions, { borderTopColor: colors.border }]}>
              {onEditResource && (
                <Pressable onPress={() => onEditResource(resource)} accessibilityRole="button" hitSlop={8}>
                  <ThemedText style={[styles.meta, { color: colors.primary }]}>{t('common.edit')}</ThemedText>
                </Pressable>
              )}
              {onRemoveResource && (
                <Pressable onPress={() => onRemoveResource(resource.id)} accessibilityRole="button" hitSlop={8}>
                  <ThemedText style={[styles.meta, { color: colors.destructive }]}>{t('resources.remove')}</ThemedText>
                </Pressable>
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm },
  card: { borderRadius: 12, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  cardCompact: { borderRadius: 10, borderWidth: 1, padding: Spacing.sm, gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  icon: { fontSize: 16, lineHeight: 22 },
  body: { flex: 1, gap: Spacing.xs },
  label: { fontWeight: '600' },
  meta: { fontSize: 12 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  photo: { width: 96, height: 96 },
  photoCompact: { width: 64, height: 64 },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xs },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.lg,
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
});
