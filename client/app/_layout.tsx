import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '@/assets/styles/global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { ErrorBoundary } from '@/components/error-boundary';
import { StandardProvider } from '@/lib/services/standard-context';
import { AuthProvider, useAuth } from '@/lib/auth';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RouteGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const onboardingComplete = useOnboardingStatus();
  const segments = useSegments();

  // Wait for both auth and onboarding status to resolve
  if (authLoading || (isAuthenticated && onboardingComplete === null)) {
    return <LoadingScreen />;
  }

  const onSignIn = (segments[0] as string) === 'sign-in';
  const onOnboarding = (segments[0] as string) === '(onboarding)';

  if (!isAuthenticated && !onSignIn) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <Redirect href={'/sign-in' as any} />;
  }
  if (isAuthenticated && onSignIn) {
    return <Redirect href="/(tabs)" />;
  }
  if (isAuthenticated && !onboardingComplete && !onOnboarding) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <Redirect href={'/(onboarding)/welcome' as any} />;
  }
  if (isAuthenticated && onboardingComplete && onOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ErrorBoundary>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StandardProvider>
          <AuthProvider>
            <RouteGuard>
              <RootLayoutNav />
              <StatusBar style="auto" />
            </RouteGuard>
          </AuthProvider>
        </StandardProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
