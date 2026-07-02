import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Durations, timing } from '@/constants/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  // Plain styles only (no ({ pressed }) function) — press feedback is the
  // scale/opacity animation itself.
  style?: StyleProp<ViewStyle>;
}

// Drop-in Pressable for cards and buttons: presses squeeze to 97% with a
// slight opacity dip. Transform-only, so layout is never affected.
export function PressableScale({ style, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const pressed = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
    opacity: 1 - pressed.value * 0.15,
  }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animStyle]}
      onPressIn={(e) => {
        pressed.value = withTiming(1, timing(Durations.fast));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withTiming(0, timing(Durations.fast));
        onPressOut?.(e);
      }}
    />
  );
}
