import React from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Durations } from '@/constants/motion';

// Web-only stand-in for native stack transitions: react-native-screens ignores
// the `animation` option on web, so pushed screens pop in instantly. Passed as
// `screenLayout` to a navigator (gated to Platform.OS === 'web'), this fades
// each screen in on mount. Back navigation returns to an already-mounted
// screen, so no animation runs there — that matches the instant feel of
// browser back and avoids fighting the history stack.
export function WebScreenTransition({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View
      testID="web-screen-transition"
      style={{ flex: 1 }}
      entering={FadeIn.duration(Durations.base).reduceMotion(ReduceMotion.System)}
    >
      {children}
    </Animated.View>
  );
}
