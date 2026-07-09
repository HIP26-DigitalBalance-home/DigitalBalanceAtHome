import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddResourceSheet, type ResourceDraft } from '@/components/add-resource-sheet';
import { ResourceList } from '@/components/resource-list';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { activitiesApi, type ActivityDetail, type ActivityItem, type ActivityResource } from '@/lib/api';
import { showAlert } from '@/lib/utils/alert';

const SEASON_EMOJI: Record<string, string> = {
  spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️',
};
const WEATHER_EMOJI: Record<string, string> = {
  sunny: '☀️', cloudy: '☁️', rainy: '🌧️', any: '🌤️',
};

const MAX_RESOURCES = 10;

export default function ActivityDetailScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id: string; data?: string }>();

  // The `data` param (when a caller passes the full activity) renders the base
  // fields instantly; the fetch below fills in resources + can_edit.
  let initial: ActivityItem | null = null;
  try {
    const parsed = JSON.parse(params.data ?? '');
    if (parsed?.id) initial = parsed as ActivityItem;
  } catch {
    initial = null;
  }

  const activityId = params.id ?? initial?.id ?? null;

  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingResource, setEditingResource] = useState<ActivityResource | null>(null);

  const load = useCallback(async () => {
    if (!activityId) return null;
    const res = await activitiesApi.getDetail(activityId);
    return res.data;
  }, [activityId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await load();
        if (!cancelled && data) setDetail(data);
      } catch {
        // keep whatever we can render from the `data` param
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // While any photo is still compressing, re-fetch so it appears once ready.
  const hasProcessing = detail?.resources?.some((r) => r.photos?.some((p) => p.status === 'processing'));
  useEffect(() => {
    if (!hasProcessing) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await load();
        if (!cancelled && data) setDetail(data);
      } catch {
        // next interaction retries
      }
    }, 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [hasProcessing, detail, load]);

  async function refresh() {
    try {
      const data = await load();
      if (data) setDetail(data);
    } catch {
      // leave the current state
    }
  }

  async function saveFromSheet(draft: ResourceDraft) {
    if (!activityId) return;
    setSheetVisible(false);
    try {
      if (editingResource) {
        await activitiesApi.updateResource(activityId, editingResource.id, {
          label: draft.label,
          url: draft.kind === 'external' ? draft.url : undefined,
          note_text: draft.kind === 'internal' ? draft.noteText : undefined,
        });
      } else if (draft.kind === 'internal' && draft.photoUri) {
        await activitiesApi.createResourcePhoto(activityId, draft.photoUri, draft.photoMime ?? 'image/jpeg', draft.noteText);
      } else {
        await activitiesApi.createResource(activityId, {
          kind: draft.kind,
          label: draft.label,
          url: draft.url,
          note_text: draft.noteText,
        });
      }
    } catch {
      showAlert(t('common.error'));
    }
    setEditingResource(null);
    await refresh();
  }

  async function removeResource(resourceId: string) {
    if (!activityId) return;
    try {
      await activitiesApi.deleteResource(activityId, resourceId);
    } catch {
      showAlert(t('common.error'));
    }
    await refresh();
  }

  async function removePhoto(resourceId: string, photoId: string) {
    if (!activityId) return;
    try {
      await activitiesApi.deleteResourcePhoto(activityId, resourceId, photoId);
    } catch {
      showAlert(t('common.error'));
    }
    await refresh();
  }

  function startEdit(resource: ActivityResource) {
    setEditingResource(resource);
    setSheetVisible(true);
  }

  const activity: ActivityItem | null = detail ?? initial;

  if (!activity) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <ThemedText style={{ color: colors.destructive }}>{t('activityDetail.notFound')}</ThemedText>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const seasonLabel: Record<string, string> = {
    spring: t('season.spring'), summer: t('season.summer'), autumn: t('season.autumn'), winter: t('season.winter'),
  };
  const weatherLabel: Record<string, string> = {
    sunny: t('weather.sunny'), cloudy: t('weather.cloudy'), rainy: t('weather.rainy'), any: t('weather.any'),
  };

  const costLabel = activity.cost_indicator === 'free' ? t('cost.free') : t('cost.lowCost');
  const costColor = activity.cost_indicator === 'free' ? colors.accent : colors.primary;
  const resources = detail?.resources ?? [];
  const canEdit = detail?.can_edit ?? false;

  const editingDraft: ResourceDraft | null = editingResource
    ? {
        key: editingResource.id,
        kind: editingResource.kind,
        label: editingResource.label,
        url: editingResource.url,
        noteText: editingResource.note_text,
      }
    : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary }}>← {t('common.back')}</ThemedText>
        </Pressable>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{activity.title}</ThemedText>

        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: costColor + '22', borderColor: costColor }]}>
            <ThemedText style={[styles.badgeText, { color: costColor }]}>{costLabel}</ThemedText>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.border }]}>
            <ThemedText style={styles.badgeText}>{t('common.minutes', { count: activity.estimated_duration_minutes })}</ThemedText>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.border }]}>
            <ThemedText style={styles.badgeText}>
              👧 {t('activityDetail.years', { min: activity.age_min, max: activity.age_max })}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={[styles.description, { color: colors.onSurface }]}>
          {activity.description}
        </ThemedText>

        {activity.season_relevance && activity.season_relevance.length > 0 && (
          <View style={styles.tagGroup}>
            <ThemedText style={[styles.tagLabel, { color: colors.muted }]}>{t('activityDetail.seasons')}</ThemedText>
            <View style={styles.tags}>
              {activity.season_relevance.map(s => (
                <View key={s} style={[styles.tag, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ThemedText style={styles.tagText}>{SEASON_EMOJI[s]} {seasonLabel[s] ?? s}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {activity.weather_suitability && activity.weather_suitability.length > 0 && (
          <View style={styles.tagGroup}>
            <ThemedText style={[styles.tagLabel, { color: colors.muted }]}>{t('activityDetail.weather')}</ThemedText>
            <View style={styles.tags}>
              {activity.weather_suitability.map(w => (
                <View key={w} style={[styles.tag, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ThemedText style={styles.tagText}>{WEATHER_EMOJI[w]} {weatherLabel[w] ?? w}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {(resources.length > 0 || canEdit) && (
          <View style={styles.tagGroup}>
            <ThemedText style={[styles.tagLabel, { color: colors.muted }]}>{t('resources.sectionTitle')}</ThemedText>

            {resources.length === 0 && (
              <ThemedText style={[styles.emptyText, { color: colors.muted }]}>{t('resources.none')}</ThemedText>
            )}

            <ResourceList
              resources={resources}
              canEdit={canEdit}
              onEditResource={startEdit}
              onRemoveResource={removeResource}
              onRemovePhoto={removePhoto}
            />

            {canEdit && resources.length < MAX_RESOURCES && (
              <Pressable
                style={[styles.addResourceButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => {
                  setEditingResource(null);
                  setSheetVisible(true);
                }}
                accessibilityRole="button"
              >
                <ThemedText style={{ color: colors.primary }}>+ {t('resources.addButton')}</ThemedText>
              </Pressable>
            )}
          </View>
        )}

        <View style={[styles.ctaBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.ctaHint, { color: colors.muted }]}>
            {t('activityDetail.ctaHint')}
          </ThemedText>
        </View>
      </ScrollView>

      <AddResourceSheet
        visible={sheetVisible}
        initial={editingDraft}
        allowPhoto={!editingResource}
        onClose={() => {
          setSheetVisible(false);
          setEditingResource(null);
        }}
        onSave={saveFromSheet}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { width: 72, minHeight: 44, justifyContent: 'center' },
  content: { padding: Spacing.screenHorizontal, gap: Spacing.lg },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: { fontSize: 13, fontWeight: '500' },
  description: { fontSize: 16, lineHeight: 26 },
  tagGroup: { gap: Spacing.xs },
  tagLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  tagText: { fontSize: 13 },
  emptyText: { fontSize: 12 },
  addResourceButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  ctaBox: { borderRadius: 12, borderWidth: 1, padding: Spacing.md },
  ctaHint: { fontSize: 13, textAlign: 'center' },
});
