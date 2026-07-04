import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { fadeOut } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';

interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const { colors, radii } = useAppTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.35, { duration: 800 }), -1, true);
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      // Crossfade out on unmount so loaded content (fadeIn) replaces the
      // skeleton without a blank frame in between.
      exiting={fadeOut()}
      style={[{ width, height, borderRadius, backgroundColor: colors.border }, animStyle, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

interface SkeletonListProps {
  count: number;
  rowHeight: number;
  borderRadius?: number;
}

export function SkeletonList({ count, rowHeight, borderRadius = 8 }: SkeletonListProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          width="100%"
          height={rowHeight}
          borderRadius={borderRadius}
          style={{ marginBottom: Spacing.sm }}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
});

void styles;
