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
import { useTranslation } from 'react-i18next';

import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
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

// RGB lerp: warm sand #E8C99A (0%) → salmon #F4845F (100%).
// Both colors are already in the app palette, so the bar reads as "on-brand"
// at every fill level rather than using a traffic-light hue shift.
function progressFillColor(ratio: number): string {
  const r = Math.round(232 + (244 - 232) * ratio); // 232 → 244
  const g = Math.round(201 + (132 - 201) * ratio); // 201 → 132
  const b = Math.round(154 + (95  - 154) * ratio); // 154 → 95
  return `rgb(${r},${g},${b})`;
}

// Thin pill bar that scales continuously — works for 3 or 30 families.
function ProgressBar({ filled, total, trackColor }: { filled: number; total: number; trackColor: string }) {
  const ratio = total > 0 ? Math.min(filled / total, 1) : 0;
  return (
    <View style={[barStyles.track, { backgroundColor: trackColor }]}>
      {ratio > 0 && (
        <View
          style={[
            barStyles.fill,
            { width: `${ratio * 100}%` as any, backgroundColor: progressFillColor(ratio) },
          ]}
        />
      )}
    </View>
  );
}

export function CollageGrid({ slots, groupFamiliesCount, localCompletions, onSlotPress, onPhotoPress }: Props) {
  const { colors, radii, theme, effectiveScheme } = useAppTheme();
  const { t } = useTranslation();
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
    const hasGroupBar = groupFamiliesCount != null && groupFamiliesCount > 0;

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
          accessibilityLabel={isEmpty ? t('collage.slotFill', { title: item.activity.title }) : t('collage.slotDone', { title: item.activity.title })}
          // Not PressableScale: its animated transform would override the
          // card's static rotation, so press feedback is opacity-only here.
          style={({ pressed }) => [
            styles.card,
            {
              opacity: pressed ? 0.85 : 1,
              // 3px inset per side: card fits the rotated visual within the cell.
              position: 'absolute',
              top: CARD_INSET,
              bottom: CARD_INSET,
              left: CARD_INSET,
              right: CARD_INSET,
              backgroundColor: isCompleted
                ? (effectiveScheme === 'light'
                    ? (theme.completedSlotBg ?? '#E8DCC8')
                    : colors.primary + '28')   // dark mode: primary tint over dark surface
                : colors.surface,
              borderWidth: 0,
              borderRadius: radii.sm,
              transform: [{ rotate: rotation }],
              shadowColor: theme.cardShadowColor ?? '#1C1208',
              shadowOpacity: theme.cardShadowOpacity ?? 0.12,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: (theme.cardShadowOpacity ?? 0.12) > 0 ? 3 : 0,
              // Reserve space for the bar only on non-photo cards (photo fills the card).
              paddingBottom: (hasGroupBar && !(isReady && effectivePhotoUrl)) ? 22 : Spacing.sm,
            },
          ]}
        >
          {/* Bar first so text always paints above it. Hidden for photo cards — the
              viewer modal shows title + progress when the user taps the photo. */}
          {hasGroupBar && !(isReady && effectivePhotoUrl) && (
            <ProgressBar
              filled={item.families_completed_count ?? 0}
              total={groupFamiliesCount!}
              trackColor={colors.border}
            />
          )}

          {isReady && effectivePhotoUrl && effectiveCompletionId ? (
            // Photo fills the card cleanly — no title overlay, no progress bar.
            // Tap opens the viewer which shows both.
            <View style={[StyleSheet.absoluteFillObject, styles.photoClip, { borderRadius: radii.sm }]}>
              <ImageWithFallback
                uri={effectivePhotoUrl}
                completionId={effectiveCompletionId}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
                accessibilityLabel={item.activity.title}
              />
            </View>
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
    borderRadius: DEFAULT_RADII.sm,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    gap: Spacing.xs,
    // overflow:visible so the card's shadow isn't clipped; photo has its own
    // overflow:hidden layer (photoClip) to stay within the rounded corners.
    overflow: 'visible',
  },
  photoClip: {
    borderRadius: DEFAULT_RADII.sm,
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
});

const barStyles = StyleSheet.create({
  // Sits at the bottom of the card, inset from the edges so it clears the
  // border-radius corners and reads as a deliberate design element.
  track: {
    position: 'absolute',
    bottom: 6,
    left: 7,
    right: 7,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    borderRadius: 2,
  },
});
