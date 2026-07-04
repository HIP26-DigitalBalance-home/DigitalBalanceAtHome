import { Easing, FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

// Shared motion tokens — all animations use these so transitions feel
// consistent across the app. Animate opacity/transform only, never layout.

export const Durations = {
  fast: 150, // press feedback, small state toggles
  base: 250, // fades, banners, modal backdrops
  slow: 400, // content reveals, progress sweeps
};

export const Easings = {
  standard: Easing.bezier(0.2, 0, 0, 1), // decelerate — entrances, reveals
  exit: Easing.bezier(0.4, 0, 1, 1), // accelerate — exits
};

// Default config for withTiming; honours the OS reduce-motion setting.
export function timing(duration: number = Durations.base) {
  return {
    duration,
    easing: Easings.standard,
    reduceMotion: ReduceMotion.System,
  };
}

// Default `entering` animation for content appearing in place (e.g. skeleton →
// loaded content); honours the OS reduce-motion setting.
export function fadeIn(duration: number = Durations.base) {
  return FadeIn.duration(duration).reduceMotion(ReduceMotion.System);
}

// Default `exiting` animation — the counterpart to fadeIn(), so a view being
// replaced (e.g. a skeleton) crossfades out instead of vanishing a frame
// before its replacement fades in.
export function fadeOut(duration: number = Durations.fast) {
  return FadeOut.duration(duration).reduceMotion(ReduceMotion.System);
}
