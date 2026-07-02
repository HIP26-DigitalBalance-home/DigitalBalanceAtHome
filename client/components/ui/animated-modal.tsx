import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleProp, StyleSheet, ViewStyle, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Durations, Easings, timing } from '@/constants/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedModalProps {
  visible: boolean;
  /** Android back button / hardware close — usually the same handler as closing. */
  onRequestClose: () => void;
  /** dialog: dimmed backdrop, content fades and scales in.
      sheet: full-screen content slides up from the bottom edge. */
  variant: 'dialog' | 'sheet';
  /** Positions the dialog content (alignment + padding); ignored for sheets. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Tap on the dimmed area; dialogs only. */
  onBackdropPress?: () => void;
  children: React.ReactNode;
}

// Replaces the stock RN Modal animationType, which can't be eased or staged:
// here the backdrop dims while the content animates in, and closing plays a
// quicker exit before the native modal unmounts. Callers keep `visible` as the
// single source of truth; content passed as children must stay renderable
// until the exit animation finishes (latch nullable data upstream).
export function AnimatedModal({
  visible,
  onRequestClose,
  variant,
  contentContainerStyle,
  onBackdropPress,
  children,
}: AnimatedModalProps) {
  const { height } = useWindowDimensions();
  // Stays mounted while the exit animation plays, then unmounts the native modal.
  const [mounted, setMounted] = useState(visible);
  // Always start at 0 so a modal mounted with visible=true still animates in.
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, timing());
    } else {
      progress.value = withTiming(
        0,
        {
          // A full-screen sheet travels further than a dialog — give it longer.
          duration: variant === 'sheet' ? Durations.base : Durations.fast,
          easing: Easings.exit,
          reduceMotion: ReduceMotion.System,
        },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      );
    }
  }, [visible, variant, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const dialogStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [16, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.96, 1]) },
    ],
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [height, 0]) }],
  }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onRequestClose}>
      {variant === 'dialog' ? (
        <>
          <AnimatedPressable
            style={[styles.backdrop, backdropStyle]}
            onPress={onBackdropPress}
            accessible={false}
          />
          <Animated.View
            style={[styles.fill, contentContainerStyle, dialogStyle]}
            pointerEvents="box-none"
          >
            {children}
          </Animated.View>
        </>
      ) : (
        <Animated.View style={[styles.fill, sheetStyle]}>{children}</Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  fill: { flex: 1 },
});
