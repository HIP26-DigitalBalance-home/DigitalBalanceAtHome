import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri, ResponseType } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

export default function SignInScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const isWeb = Platform.OS === 'web';
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    // Web: authorization code flow routed through the server (which holds client_secret).
    // PKCE is skipped because the server exchanges with client_secret — no code_verifier needed.
    // Auto-exchange is disabled so the raw code reaches the sign-in handler below.
    // Native: default behaviour (PKCE code flow, client-side auto-exchange to id_token).
    responseType: isWeb ? ResponseType.Code : undefined,
    redirectUri: isWeb ? makeRedirectUri({ path: 'sign-in' }) : undefined,
    usePKCE: isWeb ? false : undefined,
    shouldAutoExchangeCode: isWeb ? false : undefined,
  });

  useEffect(() => {
    if (!response) return;

    if (response.type === 'error') {
      setError(response.error?.message ?? 'Google authentication failed. Please try again.');
      return;
    }

    if (response.type !== 'success') return;

    // After PKCE auto-exchange, id_token is populated for all platforms.
    // The code fallback handles the rare case where auto-exchange hasn't resolved yet.
    const idToken = response.params.id_token;
    const code = response.params.code;

    setIsSigningIn(true);

    const payload = idToken
      ? { id_token: idToken }
      : { code, redirect_uri: request?.redirectUri ?? '', code_verifier: request?.codeVerifier ?? null };

    login(payload)
      .catch((err) => {
        setError(err?.message ?? 'Sign-in failed. Please try again.');
        setIsSigningIn(false);
      });
  }, [response]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <ThemedText type="title">DigitalBalance @home</ThemedText>
        <ThemedText style={{ color: colors.muted, textAlign: 'center' }}>
          Encouraging families to spend{'\n'}intentional time together
        </ThemedText>

        {error && (
          <ThemedText style={[styles.error, { color: colors.destructive }]}>{error}</ThemedText>
        )}

        <Pressable
          style={[
            styles.button,
            { backgroundColor: colors.primary, opacity: !request || isSigningIn ? 0.5 : 1 },
          ]}
          onPress={() => {
            setError(null);
            promptAsync();
          }}
          disabled={!request || isSigningIn}>
          {isSigningIn ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>
              Sign in with Google
            </ThemedText>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.screenHorizontal,
  },
  button: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  error: { fontSize: 14, textAlign: 'center' },
});
