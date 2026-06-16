import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityPickerModal } from '@/components/activity-picker-modal';
import { ErrorState } from '@/components/ui/error-state';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import { activitiesApi, type ActivityItem, type CollagePreset } from '@/lib/api';
import { pendingActivity } from '@/lib/pending-activity';
import { getGermanErrorMessage } from '@/lib/utils/api-error';

const SLOT_COUNT = 9;
const NUM_COLUMNS = 3;

type Slot = ActivityItem | null;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function CollageBuilderScreen() {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();
  const { mode, preset: presetParam } = useLocalSearchParams<{ mode: string; preset?: string }>();

  const [slots, setSlots] = useState<Slot[]>(() => Array(SLOT_COUNT).fill(null));
  const [loading, setLoading] = useState(mode !== 'custom');
  const [error, setError] = useState<string | null>(null);
  // editingSlot persists across navigation to create-activity; pickerOpen only
  // controls the modal (closed before navigating away to avoid an overlay).
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width - Spacing.screenHorizontal * 2
  );
  const slotSize = (containerWidth - Spacing.xs * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const resolveSlots = useCallback(async () => {
    setError(null);
    if (mode === 'custom') {
      setSlots(Array(SLOT_COUNT).fill(null));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await activitiesApi.list({});
      const all = res.data;
      if (mode === 'random') {
        setSlots(shuffle(all).slice(0, SLOT_COUNT));
      } else if (mode === 'preset' && presetParam) {
        const preset: CollagePreset = JSON.parse(presetParam);
        const byId = new Map(all.map((a) => [a.id, a]));
        setSlots(preset.activity_ids.slice(0, SLOT_COUNT).map((id) => byId.get(id) ?? null));
      }
    } catch (e) {
      setError(getGermanErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [mode, presetParam]);

  useEffect(() => {
    resolveSlots();
  }, [resolveSlots]);

  // Returning from the create-activity screen: fill the slot the user was editing.
  useFocusEffect(
    useCallback(() => {
      const created = pendingActivity.consume();
      if (created && editingSlot !== null) {
        setSlots((prev) => prev.map((s, i) => (i === editingSlot ? created : s)));
        setEditingSlot(null);
      }
    }, [editingSlot])
  );

  function openPicker(index: number) {
    setEditingSlot(index);
    setPickerOpen(true);
  }

  function handleSelect(activity: ActivityItem) {
    if (editingSlot === null) return;
    setSlots((prev) => prev.map((s, i) => (i === editingSlot ? activity : s)));
    setPickerOpen(false);
    setEditingSlot(null);
  }

  function handleClosePicker() {
    setPickerOpen(false);
    setEditingSlot(null);
  }

  // Close the modal (so it doesn't overlay the pushed screen), keep editingSlot.
  function handleCreateNew() {
    setPickerOpen(false);
    router.push('/create-activity' as any);
  }

  const filledCount = slots.filter((s) => s !== null).length;
  const allFilled = filledCount === SLOT_COUNT;

  function handleContinue() {
    if (!allFilled) return;
    const activityIds = slots.map((s) => s!.id).join(',');
    router.push({ pathname: '/create-challenge', params: { activityIds } } as any);
  }

  function renderSlot({ item, index }: { item: Slot; index: number }) {
    const filled = item !== null;
    return (
      <Pressable
        onPress={() => openPicker(index)}
        accessibilityRole="button"
        accessibilityLabel={filled ? t('builder.slotChange', { title: item!.title }) : t('builder.slotEmpty')}
        style={[
          styles.slot,
          {
            width: slotSize,
            height: slotSize,
            backgroundColor: colors.surface,
            borderColor: filled ? colors.primary : 'rgb(200, 195, 190)',
            borderWidth: filled ? 1.5 : 1,
          },
        ]}
      >
        {filled ? (
          <ThemedText
            style={[styles.slotTitle, { color: colors.onSurface }]}
            numberOfLines={3}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {item!.title}
          </ThemedText>
        ) : (
          <ThemedText style={[styles.plus, { color: colors.muted }]}>＋</ThemedText>
        )}
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <ThemedText style={{ color: colors.primary }}>← {t('common.back')}</ThemedText>
        </Pressable>
        <ThemedText style={styles.headerTitle}>{t('builder.title')}</ThemedText>
        <ThemedText style={[styles.counter, { color: colors.muted }]}>{filledCount}/{SLOT_COUNT}</ThemedText>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.center}><ErrorState message={error} onRetry={resolveSlots} /></View>
      ) : (
        <>
          <ThemedText style={[styles.hint, { color: colors.muted }]}>
            {t('builder.hint')}
          </ThemedText>
          <View style={styles.gridOuter}>
            <View onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}>
              <FlatList
                data={slots}
                numColumns={NUM_COLUMNS}
                scrollEnabled={false}
                keyExtractor={(_, i) => String(i)}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.grid}
                renderItem={renderSlot}
              />
            </View>
          </View>
        </>
      )}

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Pressable
          style={[styles.continueButton, { backgroundColor: allFilled ? colors.primary : colors.muted }]}
          onPress={handleContinue}
          disabled={!allFilled}
          accessibilityRole="button"
        >
          <ThemedText style={[styles.continueText, { color: colors.buttonText }]}>{t('builder.continue')}</ThemedText>
        </Pressable>
      </View>

      <ActivityPickerModal
        visible={pickerOpen}
        selectedId={editingSlot !== null ? (slots[editingSlot]?.id ?? undefined) : undefined}
        onSelect={handleSelect}
        onClose={handleClosePicker}
        onCreateNew={handleCreateNew}
      />
    </SafeAreaView>
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
  headerTitle: { fontSize: 16, fontWeight: '600' },
  counter: { fontSize: 13 },
  hint: { fontSize: 13, paddingHorizontal: Spacing.screenHorizontal, paddingVertical: Spacing.sm },
  gridOuter: { paddingHorizontal: Spacing.screenHorizontal },
  grid: { gap: Spacing.xs },
  row: { gap: Spacing.xs },
  slot: {
    borderRadius: DEFAULT_RADII.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
  },
  slotTitle: { fontSize: 12, textAlign: 'center', lineHeight: 16 },
  plus: { fontSize: 28, fontWeight: '300' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  footer: { padding: Spacing.screenHorizontal, borderTopWidth: 1 },
  continueButton: { height: 50, borderRadius: DEFAULT_RADII.button, alignItems: 'center', justifyContent: 'center' },
  continueText: { fontSize: 16, fontWeight: '600' },
});
