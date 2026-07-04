import { useEffect, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';
import Animated, {
  SharedValue,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Durations, timing } from '@/constants/motion';
import { useAppTheme } from '@/lib/app-theme-context';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const TWO_PI = Math.PI * 2;

// The arc is drawn as this many slices, each with its own solid colour. SVG
// has no conic gradient and animating a LinearGradient inside <Defs> makes
// react-native-svg rebuild the brush every frame (the stroke flashes empty —
// "blinking"), so the along-the-arc gradient is faked with per-slice colours
// instead: nothing inside <Defs> ever animates. 32 slices keeps the colour
// step between neighbours far below what the eye can see.
const SEGMENTS = 32;

// How far the shade travels from tail to head, as lighten/darken amounts of
// the theme's primary colour. Single hue throughout — only lightness moves —
// so the strongest contrast sits exactly where head meets tail on a full ring.
const TAIL_LIGHTEN = 0.5;
const HEAD_DARKEN = 0.12;

// Angular size of the overlap each slice paints over its predecessor, hiding
// hairline antialiasing seams between adjacent filled slices.
const SLICE_OVERLAP = 0.03;

interface ProgressRingProps {
  value: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

// A ring that's fully caught up must look identical whether the parent hit the
// goal exactly or blew past it (e.g. value=7, goal=2 renders exactly like
// value=2, goal=2) — clamp once, up front, before this ratio ever reaches the
// arc math or the animation.
function clampedProgress(value: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(value / goal, 1);
}

// Shifts `hex` toward white (amount > 0) or black (amount < 0) while keeping
// the hue, so every slice stays a shade of the same colour.
function shade(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  const target = amount >= 0 ? 255 : 0;
  const f = Math.abs(amount);
  const mix = (shift: number) => {
    const c = (num >> shift) & 255;
    return Math.round(c + (target - c) * f);
  };
  return `rgb(${mix(16)}, ${mix(8)}, ${mix(0)})`;
}

interface SliceGeometry {
  progress: SharedValue<number>;
  center: number;
  radius: number;
  strokeWidth: number;
  maxHeadWidth: number;
}

interface ArcSliceProps extends SliceGeometry {
  index: number;
  color: string;
}

// One slice of the arc, drawn as a filled outline (outer edge out at
// radius + w/2, inner edge back at radius − w/2) rather than a stroked line.
// The width function w(θ) is continuous across slice boundaries, so the drop
// taper stays perfectly smooth — stroked slices with stepped widths and round
// caps produce a lumpy caterpillar outline instead. Colour is fixed; only the
// geometry animates, driven by the shared progress value on the UI thread.
function ArcSlice({ index, progress, center, radius, strokeWidth, maxHeadWidth, color }: ArcSliceProps) {
  const s0 = index / SEGMENTS;
  const s1 = (index + 1) / SEGMENTS;

  const animatedProps = useAnimatedProps(() => {
    const t = progress.value;
    const arc = t * TWO_PI;

    // Drop shape: the band keeps its base width for most of the arc, then
    // swells over the last ~63° (less on short arcs) with an ease-in curve up
    // to the head width. The head width itself grows in over the first ~12%
    // of progress so a nearly-empty ring is a plain thin arc, not a blob.
    const flare = Math.min(1.1, arc * 0.55);
    const headWidth = strokeWidth + (maxHeadWidth - strokeWidth) * Math.min(1, t / 0.12);
    const widthAt = (theta: number) => {
      const u = flare > 0 ? Math.min(Math.max((theta - (arc - flare)) / flare, 0), 1) : 0;
      return strokeWidth + (headWidth - strokeWidth) * u * u;
    };
    const edgePoint = (theta: number, side: 1 | -1) => {
      const r = radius + (side * widthAt(theta)) / 2;
      return `${center + r * Math.cos(theta)} ${center + r * Math.sin(theta)}`;
    };

    // Later slices paint on top, so each one reaches slightly back over its
    // predecessor (never past the start) to hide the seam between fills.
    const a = index > 0 ? Math.max(0, arc * s0 - SLICE_OVERLAP) : 0;
    const b = arc * s1;
    const m = (a + b) / 2;

    return {
      d:
        `M ${edgePoint(a, 1)} L ${edgePoint(m, 1)} L ${edgePoint(b, 1)}` +
        ` L ${edgePoint(b, -1)} L ${edgePoint(m, -1)} L ${edgePoint(a, -1)} Z`,
      // At t≈0 every slice degenerates to a point at 12 o'clock — hide until
      // there is an actual arc.
      opacity: t < 0.004 ? 0 : 1,
    };
  });

  return <AnimatedPath animatedProps={animatedProps} fill={color} />;
}

// Circular tip drawn exactly at the head point, matching the width the taper
// has reached there — this is what makes the drop end in a clean round head.
function HeadCap({ progress, center, radius, strokeWidth, maxHeadWidth, color }: SliceGeometry & { color: string }) {
  const animatedProps = useAnimatedProps(() => {
    const t = progress.value;
    const arc = t * TWO_PI;
    const headWidth = strokeWidth + (maxHeadWidth - strokeWidth) * Math.min(1, t / 0.12);
    return {
      cx: center + radius * Math.cos(arc),
      cy: center + radius * Math.sin(arc),
      r: headWidth / 2,
      opacity: t < 0.004 ? 0 : 1,
    };
  });

  return <AnimatedCircle animatedProps={animatedProps} fill={color} />;
}

export function ProgressRing({ value, goal, size = 56, strokeWidth = 5, style }: ProgressRingProps) {
  const { colors } = useAppTheme();
  const radius = (size - strokeWidth) / 2;
  const progress = clampedProgress(value, goal);
  const complete = goal > 0 && value >= goal;

  // The head swells wider than the stroke itself, so it reaches slightly past
  // the ring's nominal edges. Draw the SVG on a padded canvas (rather than
  // exactly `size`) so the bulge never gets clipped by the SVG's own edge,
  // while the outer box callers lay out against stays exactly `size`.
  const maxHeadWidth = strokeWidth * 1.8;
  const pad = Math.max(0, (maxHeadWidth - strokeWidth) / 2) + 1;
  const boxSize = size + pad * 2;
  const center = boxSize / 2;

  // Static per-slice shades: lightest at the tail, through the pure primary,
  // to slightly darkened at the head.
  const segmentColors = useMemo(
    () =>
      Array.from({ length: SEGMENTS }, (_, j) => {
        const s = (j + 0.5) / SEGMENTS;
        return shade(colors.primary, TAIL_LIGHTEN - (TAIL_LIGHTEN + HEAD_DARKEN) * s);
      }),
    [colors.primary],
  );
  const tailColor = shade(colors.primary, TAIL_LIGHTEN);
  const headColor = shade(colors.primary, -HEAD_DARKEN);

  // Sweeps from empty on mount and eases between values on change.
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(progress, timing(Durations.slow));
  }, [progress, animatedProgress]);

  // Round cap on the tail — static geometry, only shown once there is an arc.
  const tailCapProps = useAnimatedProps(() => ({
    opacity: animatedProgress.value < 0.004 ? 0 : 1,
  }));

  return (
    <View style={[{ width: size, height: size }, style]}>
      {/* Canvas is padded beyond `size` (see `pad` above) and centered on the
          same point, so the ring itself still looks exactly `size` big. */}
      {/* Start from the top (−90°): rotate the entire SVG so 0% starts at 12 o'clock */}
      <Svg
        width={boxSize}
        height={boxSize}
        style={{ position: 'absolute', top: -pad, left: -pad, transform: [{ rotate: '-90deg' }] }}
      >
        {/* Track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Tail cap sits underneath everything at the fixed start point. */}
        <AnimatedCircle
          cx={center + radius}
          cy={center}
          r={strokeWidth / 2}
          fill={tailColor}
          animatedProps={tailCapProps}
        />
        {/* Progress arc, tail slice first so the head paints on top — on a
            full ring the dark drop tip overlaps the light tail at 12 o'clock. */}
        {segmentColors.map((color, index) => (
          <ArcSlice
            key={index}
            index={index}
            progress={animatedProgress}
            center={center}
            radius={radius}
            strokeWidth={strokeWidth}
            maxHeadWidth={maxHeadWidth}
            color={color}
          />
        ))}
        <HeadCap
          progress={animatedProgress}
          center={center}
          radius={radius}
          strokeWidth={strokeWidth}
          maxHeadWidth={maxHeadWidth}
          color={headColor}
        />
      </Svg>
      <View style={styles.centerContent} pointerEvents="none">
        {complete ? (
          <ThemedText style={[styles.checkmark, { color: colors.primary, fontSize: size * 0.32 }]}>✓</ThemedText>
        ) : (
          <ThemedText style={[styles.count, { color: colors.onSurface, fontSize: size * 0.24 }]}>
            {value}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { fontWeight: '700' },
  count: { fontWeight: '700' },
});
