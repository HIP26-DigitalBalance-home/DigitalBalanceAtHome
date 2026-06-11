import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack, useLocalSearchParams, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import 'react-native-reanimated';
import '@/assets/styles/global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { ErrorBoundary } from '@/components/error-boundary';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { StandardProvider } from '@/lib/services/standard-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { pendingInvite } from '@/lib/pending-invite';

// Must run before routing resolves so the popup callback is processed
// even if the route guard would otherwise redirect away from sign-in.
WebBrowser.maybeCompleteAuthSession();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RouteGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const onboardingComplete = useOnboardingStatus();
  const segments = useSegments();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const segment = segments[0] as string;
  const onSignIn = segment === 'sign-in';
  const onOnboarding = segment === '(onboarding)';

  // Store pending invite tokens before redirecting unauthenticated users
  useEffect(() => {
    if (!isAuthenticated && !authLoading && token) {
      if (segment === 'join-group') pendingInvite.storeGroupToken(token);
      if (segment === 'join-family') pendingInvite.storeFamilyToken(token);
    }
  }, [isAuthenticated, authLoading, segment, token]);

  if (authLoading || (isAuthenticated && onboardingComplete === null)) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated && !onSignIn) {
    return <Redirect href={'/sign-in' as any} />;
  }
  if (isAuthenticated && onSignIn) {
    return <Redirect href="/(tabs)" />;
  }
  if (isAuthenticated && !onboardingComplete && !onOnboarding) {
    return <Redirect href={'/(onboarding)/welcome' as any} />;
  }
  if (isAuthenticated && onboardingComplete && onOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="create-group" />
        <Stack.Screen name="join-group" />
        <Stack.Screen name="join-family" />
        <Stack.Screen name="group/[id]" />
        <Stack.Screen name="activity/[id]" />
        <Stack.Screen name="create-challenge" />
        <Stack.Screen name="challenges" />
        <Stack.Screen name="challenge/[id]" />
        <Stack.Screen name="celebration" />
        <Stack.Screen name="group-feed/[id]" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
      </Stack>
      <OfflineBanner />
    </>
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
