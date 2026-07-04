import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { WebScreenTransition } from '@/components/ui/web-screen-transition';
import { useAppTheme } from '@/lib/app-theme-context';

export default function OnboardingLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        // Match the app theme behind sliding screens (see root _layout.tsx).
        contentStyle: { backgroundColor: colors.background },
      }}
      // Native stack animations don't run on web — fade screens in on mount instead.
      screenLayout={
        Platform.OS === 'web'
          ? ({ children }) => <WebScreenTransition>{children}</WebScreenTransition>
          : undefined
      }
    />
  );
}
