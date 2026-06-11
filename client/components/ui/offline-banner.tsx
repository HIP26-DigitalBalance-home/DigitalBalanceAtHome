import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useNetworkStatus } from '@/hooks/use-network-status';

export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-60);

  React.useEffect(() => {
    opacity.value = withTiming(isOnline ? 0 : 1, { duration: 250 });
    translateY.value = withTiming(isOnline ? -60 : 0, { duration: 250 });
  }, [isOnline, opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[styles.banner, { top: insets.top, backgroundColor: colors.destructive }, animStyle]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
    >
      <Text style={styles.text}>Keine Internetverbindung</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
