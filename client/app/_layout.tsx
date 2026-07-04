import React, { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack, useLocalSearchParams, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import 'react-native-reanimated';
import '@/assets/styles/global.css';
import '@/lib/i18n';

import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { WebScreenTransition } from '@/components/ui/web-screen-transition';
import { ErrorBoundary } from '@/components/error-boundary';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { CookieBanner } from '@/components/ui/cookie-banner';
import { StandardProvider } from '@/lib/services/standard-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { pendingInvite } from '@/lib/pending-invite';
import { AppThemeProvider, useAppTheme } from '@/lib/app-theme-context';
import { LanguageProvider, useLanguage } from '@/lib/i18n/language-context';
import { TabBarProvider } from '@/lib/tab-bar-context';
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
  const { chosen: languageChosen } = useLanguage();
  const onboardingComplete = useOnboardingStatus(isAuthenticated);
  const segments = useSegments();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const segment = segments[0] as string;
  const onSignIn = segment === 'sign-in';
  const onOnboarding = segment === '(onboarding)';
  const onChooseLanguage = segment === 'choose-language';

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

  // Language choice gates everything else — a fresh install lands here first.
  if (!languageChosen && !onChooseLanguage) {
    return <Redirect href={'/choose-language' as any} />;
  }
  if (languageChosen && onChooseLanguage) {
    return <Redirect href={(isAuthenticated ? '/(tabs)' : '/sign-in') as any} />;
  }

  if (!isAuthenticated && !onSignIn && !onChooseLanguage) {
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
  const { colors } = useAppTheme();

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          // Scene background must match the app theme, not the navigation
          // theme default (white/black) — otherwise every push/pop flashes
          // the mismatched colour behind the sliding screens.
          contentStyle: { backgroundColor: colors.background },
        }}
        // Native stack animations don't run on web — fade screens in on mount instead.
        screenLayout={
          Platform.OS === 'web'
            ? ({ children }) => <WebScreenTransition>{children}</WebScreenTransition>
            : undefined
        }
      >
        <Stack.Screen name="(tabs)" />
        {/* Auth/gate screens swap via Redirect — a lateral slide reads wrong there. */}
        <Stack.Screen name="choose-language" options={{ animation: 'fade' }} />
        <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
        <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
        {/* Create/join flows rise from the bottom like sheets (animation only —
            presentation: 'modal' would change safe-area insets and shift layout). */}
        <Stack.Screen name="create-group" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="join-group" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="join-family" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="group/[id]" />
        <Stack.Screen name="activity/[id]" />
        <Stack.Screen name="collage-builder" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="create-activity" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="challenges" />
        <Stack.Screen name="challenge/[id]" />
        <Stack.Screen name="celebration" options={{ animation: 'fade' }} />
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
  const { effectiveScheme, colors } = useAppTheme();

  // Stock navigation themes use plain white/near-black backgrounds; our themes
  // are tinted (cream, sage, …). Feed the app palette into the navigation
  // theme so navigator-owned surfaces (stack container during transitions,
  // tab scenes) never flash a mismatched colour.
  const navigationTheme = useMemo(() => {
    const base = effectiveScheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.surface,
        border: colors.border,
        text: colors.onSurface,
        primary: colors.primary,
      },
    };
  }, [effectiveScheme, colors]);

  return (
    <ThemeProvider value={navigationTheme}>
      <TabBarProvider>
        <StandardProvider>
          <AuthProvider>
            <RouteGuard>
              <RootLayoutNav />
              <StatusBar style={effectiveScheme === 'dark' ? 'light' : 'dark'} />
            </RouteGuard>
          </AuthProvider>
        </StandardProvider>
      </TabBarProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AppThemeProvider>
          <ThemedApp />
        </AppThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
