import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { GLYPHS, ILLUSTRATIONS } from '@/constants/illustrations.generated';

export type IllustrationName = keyof typeof ILLUSTRATIONS;
export type GlyphName = keyof typeof GLYPHS;

interface IllustrationProps {
  name: IllustrationName;
  /** The illustration is scaled to fit inside a size×size box, preserving aspect ratio. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Full-colour hi,panya!-style character illustration. Decorative by default —
 * pass accessibility props at the call site if the image carries meaning.
 */
export function Illustration({ name, size = 96, style }: IllustrationProps) {
  const { xml, width, height } = ILLUSTRATIONS[name];
  const scale = size / Math.max(width, height);
  return (
    <SvgXml
      xml={xml}
      width={Math.round(width * scale)}
      height={Math.round(height * scale)}
      style={style}
    />
  );
}

interface GlyphProps {
  name: GlyphName;
  size?: number;
  /** Tint colour — glyph SVGs are drawn entirely in currentColor. */
  color: string;
  style?: StyleProp<ViewStyle>;
}

/** Single-colour, tintable UI icon in the same illustration style. */
export function Glyph({ name, size = 24, color, style }: GlyphProps) {
  const { xml } = GLYPHS[name];
  return <SvgXml xml={xml} width={size} height={size} color={color} style={style} />;
}
