import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { activitiesApi, type ActivityFilters, type ActivityItem } from '@/lib/api';
import { getGermanErrorMessage } from '@/lib/utils/api-error';

interface Props {
  visible: boolean;
  onSelect: (activity: ActivityItem) => void;
  onClose: () => void;
  // Delegated to the parent so it can close this modal before navigating away
  // (a visible RN Modal would otherwise overlay the create-activity screen).
  onCreateNew: () => void;
  // When set, the matching activity floats to the top of the list so the user
  // can see (and re-read) their current selection without scrolling.
  selectedId?: string;
}

type ChipGroup = { label: string; value: string | undefined; icon?: IconSymbolName };

export function ActivityPickerModal({ visible, onSelect, onClose, onCreateNew, selectedId }: Props) {
  const { colors, radii } = useAppTheme();
  const { t, i18n } = useTranslation();

  const COST_CHIPS: ChipGroup[] = [
    { label: t('common.all'), value: undefined },
    { label: t('cost.free'), value: 'free' },
    { label: t('cost.lowCost'), value: 'low_cost' },
  ];

  const SEASON_CHIPS: ChipGroup[] = [
    { label: t('picker.allSeasons'), value: undefined },
    { label: t('season.spring'), value: 'spring', icon: 'leaf.fill' },
    { label: t('season.summer'), value: 'summer', icon: 'sun.max.fill' },
    { label: t('season.autumn'), value: 'autumn', icon: 'wind' },
    { label: t('season.winter'), value: 'winter', icon: 'snowflake' },
  ];

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [season, setSeason] = useState<string | undefined>(undefined);
  const [cost, setCost] = useState<string | undefined>(undefined);

  // Float the selected activity to position 0 so the user can read it without scrolling.
  const sortedActivities = useMemo(() => {
    if (!selectedId) return activities;
    const idx = activities.findIndex((a) => a.id === selectedId);
    if (idx <= 0) return activities;
    const copy = [...activities];
    copy.unshift(copy.splice(idx, 1)[0]);
    return copy;
  }, [activities, selectedId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: ActivityFilters = { season, cost };
      const res = await activitiesApi.list(filters);
      setActivities(res.data);
    } catch (e) {
      setError(getGermanErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [season, cost, i18n.language]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  function renderChip(chip: ChipGroup, active: boolean, onPress: () => void) {
    const textColor = active ? colors.buttonText : colors.onSurface;
    return (
      <Pressable
        key={chip.value ?? 'all'}
        style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
        onPress={onPress}
      >
        {chip.icon && <IconSymbol name={chip.icon} size={13} color={textColor} />}
        <ThemedText style={[styles.chipText, { color: textColor }]}>{chip.label}</ThemedText>
      </Pressable>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <ThemedText style={styles.title}>{t('picker.title')}</ThemedText>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={8}>
            <ThemedText style={[styles.close, { color: colors.primary }]}>✕</ThemedText>
          </Pressable>
        </View>

        <Pressable
          style={[styles.createRow, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
          onPress={onCreateNew}
          accessibilityRole="button"
        >
          <ThemedText style={[styles.createText, { color: colors.primary }]}>{t('picker.createNew')}</ThemedText>
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersRow}>
          {SEASON_CHIPS.map((chip) => renderChip(chip, season === chip.value, () => setSeason(chip.value)))}
          <View style={[styles.chipDivider, { backgroundColor: colors.border }]} />
          {COST_CHIPS.map((chip) => renderChip(chip, cost === chip.value, () => setCost(chip.value)))}
        </ScrollView>

        {loading ? (
          <View style={styles.skeletonContainer}>
            <SkeletonList count={6} rowHeight={64} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <ErrorState message={error} onRetry={load} />
          </View>
        ) : (
          <FlatList
            data={sortedActivities}
            keyExtractor={(a) => a.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState icon="🌱" title={t('picker.emptyTitle')} body={t('picker.emptyBody')} />
            }
            renderItem={({ item }) => {
              const isSelected = item.id === selectedId;
              return (
              <Pressable
                style={[styles.card, {
                  backgroundColor: isSelected ? colors.primary + '12' : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                }]}
                onPress={() => onSelect(item)}
              >
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
                  <ThemedText style={[styles.cardDesc, { color: colors.muted }]} numberOfLines={2}>{item.description}</ThemedText>
                </View>
                <ThemedText style={[styles.cardMeta, { color: item.cost_indicator === 'free' ? colors.accent : colors.primary }]}>
                  {item.cost_indicator === 'free' ? t('cost.free') : t('cost.lowCost')}
                </ThemedText>
              </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '700' },
  close: { fontSize: 20, fontWeight: '600' },
  createRow: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
  },
  createText: { fontSize: 15, fontWeight: '600' },
  filtersScroll: { maxHeight: 60, flexShrink: 0 },
  filtersRow: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs, flexDirection: 'row', alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, minHeight: 40 },
  chipText: { fontSize: 13, fontWeight: '500' },
  chipDivider: { width: 1, height: 20, marginHorizontal: 4 },
  skeletonContainer: { flex: 1, padding: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardDesc: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  cardMeta: { fontSize: 12, fontWeight: '600' },
});
