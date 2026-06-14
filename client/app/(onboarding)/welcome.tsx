import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeatureCard } from '@/components/onboarding/FeatureCard';
import { PaginationDots } from '@/components/onboarding/PaginationDots';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function WelcomeScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();
  const SLIDES = [
    { icon: '🌿', title: t('welcome.slide1Title'), body: t('welcome.slide1Body') },
    { icon: '📸', title: t('welcome.slide2Title'), body: t('welcome.slide2Body') },
  ];
  const [activeIndex, setActiveIndex] = useState(0);
  const isLast = activeIndex === SLIDES.length - 1;
  const slide = SLIDES[activeIndex];

  function handleNext() {
    if (isLast) {
      router.push('/(onboarding)/consent');
    } else {
      setActiveIndex((i) => i + 1);
    }
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}>
      <View style={styles.slide}>
        <FeatureCard icon={slide.icon} title={slide.title} body={slide.body} />
      </View>

      <View style={styles.footer}>
        <PaginationDots count={SLIDES.length} activeIndex={activeIndex} />
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleNext}>
          <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>
            {isLast ? t('welcome.getStarted') : t('common.next')}
          </ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: { flex: 1 },
  footer: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingBottom: Spacing.xl,
  },
  button: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
