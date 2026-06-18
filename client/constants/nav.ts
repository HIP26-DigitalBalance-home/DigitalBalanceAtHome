export const NAV_HEIGHT = 72;
export const NAV_MIN_BOTTOM = 16; // minimum bottom offset when insets.bottom === 0

/** paddingBottom for tab-screen scroll containers so content clears the floating navbar. */
export function tabScreenPaddingBottom(insetsBottom: number): number {
  return (insetsBottom > 0 ? insetsBottom : NAV_MIN_BOTTOM) + NAV_HEIGHT + 16;
}
