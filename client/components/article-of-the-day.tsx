import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ArticleDetailModal } from '@/components/article-detail-modal';
import { PaginationDots } from '@/components/onboarding/PaginationDots';
import { ThemedText } from '@/components/themed-text';
import { Illustration, type IllustrationName } from '@/components/ui/illustration';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';

export interface ArticleSource {
  label: string;
  url: string;
}

export interface ArticlePage {
  heading?: string;
  body: string;
  sources?: ArticleSource[];
}

export interface Article {
  id: string;
  icon: IllustrationName;
  eyebrow: string;
  title: string;
  description: string;
  pages: ArticlePage[];
}

const ARTICLE_IDS = ['screenTimeByAge', 'screenTimeAndSleep', 'movementMatters'] as const;
const ARTICLE_ICONS: Record<(typeof ARTICLE_IDS)[number], IllustrationName> = {
  screenTimeByAge: 'toco-phone',
  screenTimeAndSleep: 'bunny-night',
  movementMatters: 'podium-cheer',
};

export function ArticleOfTheDay() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [openArticle, setOpenArticle] = useState<Article | null>(null);

  const articles: Article[] = ARTICLE_IDS.map((id) => ({
    id,
    icon: ARTICLE_ICONS[id],
    eyebrow: t(`home.articles.${id}.eyebrow`),
    title: t(`home.articles.${id}.title`),
    description: t(`home.articles.${id}.description`),
    pages: t(`home.articles.${id}.pages`, { returnObjects: true }) as ArticlePage[],
  }));

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (carouselWidth === 0) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / carouselWidth);
    setActiveIndex(Math.max(0, Math.min(index, articles.length - 1)));
  }

  function goToIndex(index: number) {
    const clamped = Math.max(0, Math.min(index, articles.length - 1));
    if (clamped === activeIndex) return;
    setActiveIndex(clamped);
    // On web, `pagingEnabled` applies CSS scroll-snap; a smooth programmatic
    // scroll fights the mandatory snap and produces a visible pre-jump. An
    // instant scroll lands exactly on the snap point with no glitch. Native
    // has no CSS snap, so the animated scroll stays smooth there.
    scrollRef.current?.scrollTo({ x: clamped * carouselWidth, animated: Platform.OS !== 'web' });
  }

  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>
        {t('home.articleOfTheDay')}
      </ThemedText>

      <View onLayout={(e) => setCarouselWidth(e.nativeEvent.layout.width)}>
        {carouselWidth > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            onScroll={handleScroll}
            onMomentumScrollEnd={handleScroll}
            scrollEventThrottle={16}
          >
            {articles.map((article) => (
              <Pressable
                key={article.id}
                style={{ width: carouselWidth }}
                onPress={() => setOpenArticle(article)}
                accessibilityRole="button"
                accessibilityLabel={article.title}
              >
                <View style={[styles.card, { backgroundColor: colors.accent + '14', borderColor: colors.accent + '33' }]}>
                  <View style={styles.cardText}>
                    <ThemedText style={[styles.eyebrow, { color: colors.accent }]}>{article.eyebrow}</ThemedText>
                    <ThemedText style={[styles.title, { color: colors.onSurface }]} numberOfLines={2}>
                      {article.title}
                    </ThemedText>
                    <ThemedText style={[styles.description, { color: colors.muted }]} numberOfLines={3}>
                      {article.description}
                    </ThemedText>
                  </View>
                  <View style={[styles.iconBubble, { backgroundColor: colors.accent + '22' }]}>
                    <Illustration name={article.icon} size={44} />
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.dotsRow}>
        <Pressable
          onPress={() => goToIndex(activeIndex - 1)}
          disabled={activeIndex === 0}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.previous', 'Previous')}
          style={styles.arrow}
        >
          <ThemedText style={[styles.arrowText, { color: colors.primary, opacity: activeIndex === 0 ? 0.25 : 1 }]}>
            ‹
          </ThemedText>
        </Pressable>

        <PaginationDots count={articles.length} activeIndex={activeIndex} />

        <Pressable
          onPress={() => goToIndex(activeIndex + 1)}
          disabled={activeIndex === articles.length - 1}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.next', 'Next')}
          style={styles.arrow}
        >
          <ThemedText
            style={[
              styles.arrowText,
              { color: colors.primary, opacity: activeIndex === articles.length - 1 ? 0.25 : 1 },
            ]}
          >
            ›
          </ThemedText>
        </Pressable>
      </View>

      <ArticleDetailModal
        visible={openArticle !== null}
        article={openArticle}
        onClose={() => setOpenArticle(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: DEFAULT_RADII.card, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardText: { flex: 1, gap: 4 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  description: { fontSize: 13, lineHeight: 18 },
  iconBubble: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.xs,
  },
  arrow: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 26, fontWeight: '700', lineHeight: 28 },
});
