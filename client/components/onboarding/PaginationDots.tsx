import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Durations, timing } from '@/constants/motion';
import { useAppTheme } from '@/lib/app-theme-context';

interface PaginationDotsProps {
  count: number;
  activeIndex: number;
}

function Dot({ active, activeColor, inactiveColor }: { active: boolean; activeColor: string; inactiveColor: string }) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, timing(Durations.fast));
  }, [active, progress]);

  const animStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [8, 20]),
    backgroundColor: interpolateColor(progress.value, [0, 1], [inactiveColor, activeColor]),
  }));

  return <Animated.View style={[styles.dot, animStyle]} />;
}

export function PaginationDots({ count, activeIndex }: PaginationDotsProps) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <Dot key={i} active={i === activeIndex} activeColor={colors.primary} inactiveColor={colors.border} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
});
