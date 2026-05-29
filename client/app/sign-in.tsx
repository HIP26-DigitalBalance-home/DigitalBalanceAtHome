import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export default function SignInScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;

    const code = response.params.code;
    const redirectUri = request?.redirectUri ?? '';
    const codeVerifier = request?.codeVerifier ?? null;

    setIsSigningIn(true);
    login(code, redirectUri, codeVerifier)
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
