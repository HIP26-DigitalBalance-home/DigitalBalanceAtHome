import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ChallengeActivitySlot } from '@/lib/api';

interface Props {
  slots: ChallengeActivitySlot[];
  groupFamiliesCount?: number | null;
  onSlotPress?: (slot: ChallengeActivitySlot) => void;
}

export function CollageGrid({ slots, groupFamiliesCount, onSlotPress }: Props) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const numColumns = Math.max(2, Math.ceil(Math.sqrt(slots.length)));
  const screenWidth = Dimensions.get('window').width;
  const slotSize = (screenWidth - Spacing.screenHorizontal * 2 - Spacing.xs * (numColumns - 1)) / numColumns;

  const sortedSlots = [...slots].sort((a, b) => a.grid_position - b.grid_position);

  function renderSlot({ item }: { item: ChallengeActivitySlot }) {
    const completion = item.completion;
    const isCompleted = completion != null;
    const isProcessing = completion?.status === 'processing';
    const isSelfReported = completion?.status === 'self_reported';
    const isReady = completion?.status === 'ready';

    return (
      <Pressable
        onPress={() => !isCompleted && onSlotPress?.(item)}
        style={[
          styles.slot,
          {
            width: slotSize,
            height: slotSize,
            backgroundColor: isCompleted ? colors.accent + '22' : colors.surface,
            borderColor: isCompleted ? colors.accent : colors.border,
          },
        ]}
      >
        {isProcessing && (
          <ActivityIndicator color={colors.primary} />
        )}

        {isSelfReported && (
          <ThemedText style={[styles.checkmark, { color: colors.accent }]}>✓</ThemedText>
        )}

        {isReady && (
          <ThemedText style={[styles.checkmark, { color: colors.accent }]}>📷</ThemedText>
        )}

        {!isCompleted && (
          <ThemedText style={[styles.slotTitle, { color: colors.muted }]} numberOfLines={3}>
            {item.activity.title}
          </ThemedText>
        )}

        {isCompleted && !isProcessing && (
          <ThemedText style={[styles.slotTitleSmall, { color: colors.onSurface }]} numberOfLines={2}>
            {item.activity.title}
          </ThemedText>
        )}

        {groupFamiliesCount != null && (
          <View style={[styles.progressBadge, { backgroundColor: colors.border }]}>
            <ThemedText style={[styles.progressText, { color: colors.muted }]}>
              {item.families_completed_count ?? 0}/{groupFamiliesCount}
            </ThemedText>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <FlatList
      key={numColumns}
      data={sortedSlots}
      numColumns={numColumns}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
      renderItem={renderSlot}
      contentContainerStyle={styles.grid}
    />
  );
}

const styles = StyleSheet.create({
  grid: { gap: Spacing.xs },
  row: { gap: Spacing.xs },
  slot: {
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    gap: Spacing.xs,
    position: 'relative',
  },
  slotTitle: { fontSize: 11, textAlign: 'center', lineHeight: 15 },
  slotTitleSmall: { fontSize: 10, textAlign: 'center', lineHeight: 13 },
  checkmark: { fontSize: 22, fontWeight: '700' },
  progressBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  progressText: { fontSize: 9, fontWeight: '600' },
});
