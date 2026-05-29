import * as Google from 'expo-auth-session/providers/google';
import { ResponseType } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

export default function SignInScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    // Web: use id_token flow (no server-side code exchange — web clients can't embed client_secret)
    // Native: default code flow (server exchanges with client_secret)
    responseType: Platform.OS === 'web' ? ResponseType.IdToken : undefined,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;

    const idToken = response.params.id_token;  // web (ResponseType.IdToken)
    const code = response.params.code;          // native (ResponseType.Code)

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
