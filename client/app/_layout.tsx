import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack, useLocalSearchParams, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import 'react-native-reanimated';
import '@/assets/styles/global.css';
import '@/lib/i18n';

import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { ErrorBoundary } from '@/components/error-boundary';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { CookieBanner } from '@/components/ui/cookie-banner';
import { StandardProvider } from '@/lib/services/standard-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { pendingInvite } from '@/lib/pending-invite';
import { AppThemeProvider, useAppTheme } from '@/lib/app-theme-context';
// Side-effect: fires AsyncStorage read immediately at bundle evaluation time.
import '@/lib/theme-preloader';

// Must run before routing resolves so the popup callback is processed
// even if the route guard would otherwise redirect away from sign-in.
WebBrowser.maybeCompleteAuthSession();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RouteGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const onboardingComplete = useOnboardingStatus(isAuthenticated);
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
        <Stack.Screen name="collage-builder" />
        <Stack.Screen name="create-activity" />
        <Stack.Screen name="create-challenge" />
        <Stack.Screen name="challenges" />
        <Stack.Screen name="challenge/[id]" />
        <Stack.Screen name="celebration" />
        <Stack.Screen name="group-feed/[id]" />
        <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
      </Stack>
      <OfflineBanner />
      <CookieBanner />
    </>
  );
}

// Inner component — lives inside AppThemeProvider so it can read effectiveScheme.
function ThemedApp() {
  const { effectiveScheme } = useAppTheme();

  return (
    <ThemeProvider value={effectiveScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StandardProvider>
        <AuthProvider>
          <RouteGuard>
            <RootLayoutNav />
            <StatusBar style={effectiveScheme === 'dark' ? 'light' : 'dark'} />
          </RouteGuard>
        </AuthProvider>
      </StandardProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AppThemeProvider>
        <ThemedApp />
      </AppThemeProvider>
    </ErrorBoundary>
  );
}
