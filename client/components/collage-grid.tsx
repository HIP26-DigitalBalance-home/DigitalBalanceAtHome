import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useState } from 'react';

import { ImageWithFallback } from '@/components/ui/image-with-fallback';
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

// Each card is inset 3px per side inside its grid cell so that corner bleed
// from rotation stays within the cell's bounds (math: slotSize * sin(1.6°) ≈ 3px).
const CARD_INSET = 3;

// Deterministic rotation per grid position: cycles through ±1.6° values.
function slotRotation(gridPosition: number): string {
  const steps = [-1.6, 1.2, -0.8, 1.6, -1.2, 0.8, -0.4];
  return `${steps[gridPosition % steps.length]}deg`;
}

// Progress dots: up to 5 filled/empty circles.
function ProgressDots({ filled, total, color }: { filled: number; total: number; color: string }) {
  const cap = Math.min(total, 5);
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: cap }).map((_, i) => (
        <ThemedText key={i} style={[dotStyles.dot, { color: i < filled ? color : color + '40' }]}>
          {i < filled ? '●' : '○'}
        </ThemedText>
      ))}
    </View>
  );
}

export function CollageGrid({ slots, groupFamiliesCount, localCompletions, onSlotPress, onPhotoPress }: Props) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const numColumns = 3;
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
    const isCompleted = !isEmpty;

    function handlePress() {
      if (isEmpty) { onSlotPress?.(item); return; }
      if (isReady && effectivePhotoUrl && effectiveCompletionId) {
        onPhotoPress?.(item, effectivePhotoUrl, effectiveCompletionId);
      }
    }

    const rotation = slotRotation(item.grid_position);

    return (
      // Outer cell: owns the grid dimensions and stays overflow-visible so
      // the rotated card's corners and shadow can bleed into the gap space.
      <View style={{ width: slotSize, height: slotSize, overflow: 'visible' }}>
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={isEmpty ? `${item.activity.title} – ausfüllen` : `${item.activity.title} – abgeschlossen`}
          style={[
            styles.card,
            {
              // 3px inset per side: card fits the rotated visual within the cell.
              position: 'absolute',
              top: CARD_INSET,
              bottom: CARD_INSET,
              left: CARD_INSET,
              right: CARD_INSET,
              backgroundColor: isCompleted ? '#FFF3E0' : colors.surface,
              borderColor: isCompleted ? '#E8C99A' : colors.border,
              transform: [{ rotate: rotation }],
              shadowColor: '#6B3A2A',
              shadowOpacity: isCompleted ? 0.14 : 0.08,
              shadowRadius: isCompleted ? 6 : 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: isCompleted ? 4 : 2,
            },
          ]}
        >
          {isReady && effectivePhotoUrl && effectiveCompletionId ? (
            // Photo needs its own overflow:hidden layer to be clipped to the
            // card's rounded corners — the outer card is overflow:visible for shadows.
            <>
              <View style={[StyleSheet.absoluteFillObject, styles.photoClip]}>
                <ImageWithFallback
                  uri={effectivePhotoUrl}
                  completionId={effectiveCompletionId}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                  accessibilityLabel={item.activity.title}
                />
              </View>
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
              <View style={[styles.stampCircle, { borderColor: colors.primary }]}>
                <ThemedText style={[styles.stampCheck, { color: colors.primary }]}>✓</ThemedText>
              </View>
              <ThemedText style={[styles.slotTitleSmall, { color: colors.onSurface }]} numberOfLines={2}>
                {item.activity.title}
              </ThemedText>
            </>
          ) : isReady ? (
            // ready but photo URL still loading
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

          {groupFamiliesCount != null && groupFamiliesCount > 0 && (
            <View style={styles.dotsContainer}>
              <ProgressDots
                filled={item.families_completed_count ?? 0}
                total={groupFamiliesCount}
                color={colors.primary}
              />
            </View>
          )}
        </Pressable>
      </View>
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
  grid: { gap: Spacing.sm },
  row: { gap: Spacing.xs },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    gap: Spacing.xs,
    // overflow:visible so the card's shadow isn't clipped; photo has its own
    // overflow:hidden layer (photoClip) to stay within the rounded corners.
    overflow: 'visible',
  },
  photoClip: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  slotTitle: { fontSize: 11, textAlign: 'center', lineHeight: 15 },
  slotTitleSmall: { fontSize: 10, textAlign: 'center', lineHeight: 13 },
  stampCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampCheck: { fontSize: 16, fontWeight: '800', lineHeight: 20 },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 4,
  },
  photoTitle: { fontSize: 9, color: '#fff', textAlign: 'center', lineHeight: 13 },
  dotsContainer: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
});

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 1 },
  dot: { fontSize: 7, lineHeight: 9 },
});
