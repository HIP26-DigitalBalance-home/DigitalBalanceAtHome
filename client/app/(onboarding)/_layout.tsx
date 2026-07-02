import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { WebScreenTransition } from '@/components/ui/web-screen-transition';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      // Native stack animations don't run on web — fade screens in on mount instead.
      screenLayout={
        Platform.OS === 'web'
          ? ({ children }) => <WebScreenTransition>{children}</WebScreenTransition>
          : undefined
      }
    />
  );
}
