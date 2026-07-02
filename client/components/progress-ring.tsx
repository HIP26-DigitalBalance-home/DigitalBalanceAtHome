import { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Circle, Svg } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import { Durations, timing } from '@/constants/motion';
import { useAppTheme } from '@/lib/app-theme-context';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  value: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export function ProgressRing({ value, goal, size = 56, strokeWidth = 5, style }: ProgressRingProps) {
  const { colors } = useAppTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = goal > 0 ? Math.min(value / goal, 1) : 0;
  const center = size / 2;

  // Sweeps from empty on mount and eases between values on change.
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(progress, timing(Durations.slow));
  }, [progress, animatedProgress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  return (
    // Start from the top (−90°): rotate the entire SVG so 0% starts at 12 o'clock
    <Svg width={size} height={size} style={[{ transform: [{ rotate: '-90deg' }] }, style as any]}>
      {/* Track */}
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={colors.border}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Progress arc */}
      <AnimatedCircle
        cx={center}
        cy={center}
        r={radius}
        stroke={colors.primary}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        animatedProps={animatedProps}
        strokeLinecap="round"
      />
    </Svg>
  );
}
