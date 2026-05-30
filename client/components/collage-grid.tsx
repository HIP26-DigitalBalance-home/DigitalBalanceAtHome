import { ActivityIndicator, Dimensions, FlatList, Image, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ChallengeActivitySlot } from '@/lib/api';

export interface LocalCompletion {
  status: string;
  photoUrl?: string | null;
  completionId?: string;
}

interface Props {
  slots: ChallengeActivitySlot[];
  groupFamiliesCount?: number | null;
  localCompletions?: Record<string, LocalCompletion>;
  onSlotPress?: (slot: ChallengeActivitySlot) => void;
  onPhotoPress?: (slot: ChallengeActivitySlot, photoUrl: string, completionId: string) => void;
}

export function CollageGrid({ slots, groupFamiliesCount, localCompletions, onSlotPress, onPhotoPress }: Props) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const numColumns = Math.max(2, Math.ceil(Math.sqrt(slots.length)));
  // Start with a best-guess width; replaced on first layout with the real container width.
  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width - Spacing.screenHorizontal * 2
  );
  const slotSize = (containerWidth - Spacing.xs * (numColumns - 1)) / numColumns;

  const sortedSlots = [...slots].sort((a, b) => a.grid_position - b.grid_position);

  function renderSlot({ item }: { item: ChallengeActivitySlot }) {
    const local = localCompletions?.[item.id];
    const effectiveStatus = local?.status === 'deleted' ? null : (local?.status ?? item.completion?.status ?? null);
    const effectivePhotoUrl = local?.photoUrl ?? item.completion?.photo_url ?? null;
    const effectiveCompletionId = local?.completionId ?? item.completion?.id ?? null;

    const isEmpty = effectiveStatus === null;
    const isProcessing = effectiveStatus === 'processing';
    const isSelfReported = effectiveStatus === 'self_reported';
    const isReady = effectiveStatus === 'ready';

    function handlePress() {
      if (isEmpty) { onSlotPress?.(item); return; }
      if (isReady && effectivePhotoUrl && effectiveCompletionId) {
        onPhotoPress?.(item, effectivePhotoUrl, effectiveCompletionId);
      }
    }

    return (
      <Pressable
        onPress={handlePress}
        style={[
          styles.slot,
          {
            width: slotSize,
            height: slotSize,
            backgroundColor: isEmpty ? colors.surface : colors.accent + '22',
            borderColor: isEmpty ? colors.border : colors.accent,
            overflow: 'hidden',
          },
        ]}
      >
        {isReady && effectivePhotoUrl ? (
          <>
            <Image
              source={{ uri: effectivePhotoUrl }}
              style={{ width: slotSize, height: slotSize, position: 'absolute', top: 0, left: 0 }}
              resizeMode="cover"
            />
            <View style={styles.photoOverlay}>
              <ThemedText style={styles.photoTitle} numberOfLines={2}>
                {item.activity.title}
              </ThemedText>
            </View>
          </>
        ) : isProcessing ? (
          <>
            <ActivityIndicator color={colors.primary} />
            <ThemedText style={[styles.slotTitleSmall, { color: colors.muted }]} numberOfLines={2}>
              {item.activity.title}
            </ThemedText>
          </>
        ) : isSelfReported ? (
          <>
            <ThemedText style={[styles.checkmark, { color: colors.accent }]}>✓</ThemedText>
            <ThemedText style={[styles.slotTitleSmall, { color: colors.onSurface }]} numberOfLines={2}>
              {item.activity.title}
            </ThemedText>
          </>
        ) : isReady ? (
          // ready but no URL yet (still fetching)
          <>
            <ActivityIndicator color={colors.accent} />
            <ThemedText style={[styles.slotTitleSmall, { color: colors.onSurface }]} numberOfLines={2}>
              {item.activity.title}
            </ThemedText>
          </>
        ) : (
          <ThemedText style={[styles.slotTitle, { color: colors.muted }]} numberOfLines={3}>
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
    <View onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}>
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
    </View>
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
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 4,
  },
  photoTitle: { fontSize: 9, color: '#fff', textAlign: 'center', lineHeight: 13 },
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
