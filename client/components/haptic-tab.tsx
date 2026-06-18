import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { StyleSheet } from 'react-native';

import { useAppTheme } from '@/lib/app-theme-context';

export function HapticTab(props: BottomTabBarButtonProps) {
  const { colors } = useAppTheme();
  const isSelected = props.accessibilityState?.selected;

  return (
    <PlatformPressable
      {...props}
      style={[
        props.style,
        styles.pill,
        isSelected && { backgroundColor: colors.tabIconSelected + '15' },
      ]}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    overflow: 'hidden',
  },
});
