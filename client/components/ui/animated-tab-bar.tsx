import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NAV_MIN_BOTTOM } from '@/constants/nav';
import { timing } from '@/constants/motion';
import { useTabBar } from '@/lib/tab-bar-context';

// Wraps the default tab bar so hiding it (e.g. while a modal is open) slides it
// off-screen instead of the previous instant display:none. This wrapper owns
// the floating pill's absolute position — visual styling stays in tabBarStyle.
// The wrapper must keep a real layout height (Android drops touches on
// children outside the parent's bounds), which is why the pill's position
// lives here and not on tabBarStyle.
export function AnimatedTabBar(props: BottomTabBarProps) {
  const { hidden } = useTabBar();
  const insets = useSafeAreaInsets();
  const shown = useSharedValue(hidden ? 0 : 1);

  useEffect(() => {
    shown.value = withTiming(hidden ? 0 : 1, timing());
  }, [hidden, shown]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * 120 }],
  }));

  return (
    <Animated.View
      style={[styles.wrap, { bottom: insets.bottom > 0 ? insets.bottom : NAV_MIN_BOTTOM }, animStyle]}
      pointerEvents={hidden ? 'none' : 'box-none'}
    >
      <BottomTabBar {...props} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
});
