import { PropsWithChildren, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Durations, timing } from '@/constants/motion';
import { useAppTheme } from '@/lib/app-theme-context';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { colors } = useAppTheme();
  const rotation = useSharedValue(0);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <ThemedView>
      <TouchableOpacity
        style={styles.heading}
        onPress={() => {
          rotation.value = withTiming(isOpen ? 0 : 90, timing(Durations.fast));
          setIsOpen((value) => !value);
        }}
        activeOpacity={0.8}>
        <Animated.View style={chevronStyle}>
          <IconSymbol name="chevron.right" size={18} color={colors.icon} />
        </Animated.View>
        <ThemedText type="defaultSemiBold">{title}</ThemedText>
      </TouchableOpacity>
      {isOpen && (
        <Animated.View entering={FadeIn.duration(Durations.fast).reduceMotion(ReduceMotion.System)}>
          <ThemedView style={styles.content}>{children}</ThemedView>
        </Animated.View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  content: {
    marginTop: 6,
    marginLeft: 24,
  },
});
