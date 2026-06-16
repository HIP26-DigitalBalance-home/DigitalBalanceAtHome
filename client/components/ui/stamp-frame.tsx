import React, { useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * A postage-stamp frame: the scalloped, perforated outline used for each
 * section in the Bond prototype. The SVG outline is generated to fit whatever
 * size the frame lays out at, so it works for the flexible-width Explore cards.
 *
 * Children render inside the stamp, inset past the perforations.
 */

// Number of bumps + the exact gap for one edge, so whole bumps fit with a
// straight segment at both ends (square corners) and even gaps between.
function edgeLayout(length: number, r: number, gapTarget: number): { n: number; gap: number } {
  const n = Math.max(1, Math.round((length - gapTarget) / (2 * r + gapTarget)));
  const gap = (length - n * 2 * r) / (n + 1);
  return { n, gap };
}

// Builds a clockwise stamp outline (top → right → bottom → left). The body is a
// rectangle inset by `r` from the view edges; each edge carries semicircular
// bumps protruding outward to the view edge, separated by straight segments,
// with square corners — matching the postage-stamp template.
function buildStampPath(width: number, height: number, r: number, gapTarget: number): string {
  const W = width;
  const H = height;
  const top = edgeLayout(W - 2 * r, r, gapTarget);
  const side = edgeLayout(H - 2 * r, r, gapTarget);
  // sweep flag 0 → arc bulges outward (away from interior).
  const bump = (x: number, y: number) => `A ${r} ${r} 0 0 0 ${x.toFixed(2)} ${y.toFixed(2)}`;
  const line = (x: number, y: number) => `L ${x.toFixed(2)} ${y.toFixed(2)}`;

  let d = `M ${r} ${r} `;
  // top: left → right, bumps point up
  let x = r;
  for (let i = 0; i < top.n; i++) { x += top.gap; d += line(x, r) + ' '; x += 2 * r; d += bump(x, r) + ' '; }
  d += line(W - r, r) + ' ';
  // right: top → bottom, bumps point right
  let y = r;
  for (let i = 0; i < side.n; i++) { y += side.gap; d += line(W - r, y) + ' '; y += 2 * r; d += bump(W - r, y) + ' '; }
  d += line(W - r, H - r) + ' ';
  // bottom: right → left, bumps point down
  x = W - r;
  for (let i = 0; i < top.n; i++) { x -= top.gap; d += line(x, H - r) + ' '; x -= 2 * r; d += bump(x, H - r) + ' '; }
  d += line(r, H - r) + ' ';
  // left: bottom → top, bumps point left
  y = H - r;
  for (let i = 0; i < side.n; i++) { y -= side.gap; d += line(r, y) + ' '; y -= 2 * r; d += bump(r, y) + ' '; }
  d += line(r, r) + ' ';
  return d + 'Z';
}

interface StampFrameProps {
  fill: string;
  stroke: string;
  /** Radius of each half-circle bump in px. Default 8. */
  bumpRadius?: number;
  /** Target straight-segment length between bumps in px. Default 10. */
  bumpGap?: number;
  strokeWidth?: number;
  /** Inset for children so content clears the perforated edge. Default = bumpRadius + 8. */
  contentInset?: number;
  style?: StyleProp<ViewStyle>;
  /** Style for the inner content container (e.g. layout, gap). */
  contentStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function StampFrame({
  fill,
  stroke,
  bumpRadius = 8,
  bumpGap = 10,
  strokeWidth = 1.5,
  contentInset,
  style,
  contentStyle,
  children,
}: StampFrameProps) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.width - width) > 0.5 || Math.abs(size.height - height) > 0.5) {
      setSize({ width, height });
    }
  }

  const inset = contentInset ?? bumpRadius + 8;

  return (
    <View style={style} onLayout={onLayout}>
      {size ? (
        <Svg
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Path
            d={buildStampPath(size.width, size.height, bumpRadius, bumpGap)}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
      <View style={[{ padding: inset }, contentStyle]}>{children}</View>
    </View>
  );
}
