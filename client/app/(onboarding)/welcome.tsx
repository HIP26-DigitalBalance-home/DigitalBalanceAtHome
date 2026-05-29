import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeatureCard } from '@/components/onboarding/FeatureCard';
import { PaginationDots } from '@/components/onboarding/PaginationDots';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '🌿',
    title: 'Time that matters',
    body: 'Small activities with your child build lasting bonds. The app guides you — no planning needed.',
  },
  {
    icon: '📸',
    title: 'Your family collage',
    body: 'Every activity you complete fills a slot in your personal collage — a growing memory of time well spent.',
  },
];

export default function WelcomeScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setActiveIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH }}>
            <FeatureCard icon={item.icon} title={item.title} body={item.body} />
          </View>
        )}
        style={styles.list}
      />

      <View style={styles.footer}>
        <PaginationDots count={SLIDES.length} activeIndex={activeIndex} />

        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => {
            if (isLast) {
              router.push('/(onboarding)/consent');
            } else {
              listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
              setActiveIndex(activeIndex + 1);
            }
          }}>
          <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>
            {isLast ? 'Get started' : 'Next'}
          </ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
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
