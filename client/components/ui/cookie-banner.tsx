import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';

const COOKIE_KEY = '@dba_cookie_dismissed';
const TAB_BAR_HEIGHT = 49;

// Monster display size and offset so its "ledge" aligns with the banner's top edge.
// Image is 400×309 (landscape); ledge sits at ~75% from the top.
const MONSTER_W = 200;
const MONSTER_H = 155;
const MONSTER_TOP_OFFSET = -122; // lifts claws clear of the text area

export function CookieBanner() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const { isAuthenticated } = useAuth();
  const onboardingComplete = useOnboardingStatus();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const colors = Colors[useColorScheme() ?? 'light'];
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem(COOKIE_KEY).then((val) => setDismissed(val === '1'));
  }, []);

  // Only show over tab screens; hide on full-screen stack routes that have no tab bar
  const inTabsGroup = segments[0] === '(tabs)';
  if (!isAuthenticated || !onboardingComplete || dismissed !== false || !inTabsGroup) {
    return null;
  }

  const handleDismiss = async () => {
    await AsyncStorage.setItem(COOKIE_KEY, '1');
    setDismissed(true);
  };

  return (
    <View
      style={[styles.wrapper, { bottom: insets.bottom + TAB_BAR_HEIGHT }]}
      pointerEvents="box-none"
    >
      {/* Decorative monster — pokes its head above the banner, non-interactive */}
      <View style={styles.monsterContainer} pointerEvents="none">
        <Image
          source={require('@/assets/images/cookie-monster.png')}
          style={styles.monster}
          accessible={false}
          resizeMode="contain"
        />
      </View>

      <View
        style={[styles.banner, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
        accessibilityRole="alert"
      >
        <ThemedText style={styles.text}>
          Diese App speichert Daten lokal und auf unseren EU-Servern, um dich angemeldet zu halten
          und Aktivitäten zu synchronisieren. Wir verwenden keine Werbe-Cookies oder
          Drittanbieter-Tracking.
        </ThemedText>
        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push('/privacy-policy' as any)}
            accessibilityRole="link"
            accessibilityLabel="Datenschutzerklärung öffnen"
          >
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              Datenschutzerklärung
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleDismiss}
            style={[styles.button, { backgroundColor: colors.buttonBackground }]}
            accessibilityRole="button"
            accessibilityLabel="Hinweis schließen"
          >
            <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>
              Verstanden
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'visible',
  },
  monsterContainer: {
    position: 'absolute',
    right: 0,
    top: MONSTER_TOP_OFFSET,
    width: MONSTER_W,
    height: MONSTER_H,
    zIndex: 101,
  },
  monster: {
    width: MONSTER_W,
    height: MONSTER_H,
  },
  banner: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 100,
  },
  text: {
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 16,
  },
  link: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
