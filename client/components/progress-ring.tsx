import { StyleProp, ViewStyle } from 'react-native';
import { Circle, Svg } from 'react-native-svg';
import { useAppTheme } from '@/lib/app-theme-context';

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
  // Start from the top (−90°): rotate the entire SVG so 0% starts at 12 o'clock
  const strokeDashoffset = circumference * (1 - progress);
  const center = size / 2;

  return (
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
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={colors.primary}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
    </Svg>
  );
}
