import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ArticleDetailModal } from '@/components/article-detail-modal';
import { PaginationDots } from '@/components/onboarding/PaginationDots';
import { ThemedText } from '@/components/themed-text';
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
  icon: string;
  eyebrow: string;
  title: string;
  description: string;
  pages: ArticlePage[];
}

const ARTICLE_IDS = ['screenTimeByAge', 'screenTimeAndSleep', 'movementMatters'] as const;
const ARTICLE_ICONS: Record<(typeof ARTICLE_IDS)[number], string> = {
  screenTimeByAge: '📱',
  screenTimeAndSleep: '😴',
  movementMatters: '🏃',
};

export function ArticleOfTheDay() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
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

  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ThemedText style={[styles.sectionLabel, { color: colors.primary + '99' }]}>
        {t('home.articleOfTheDay')}
      </ThemedText>

      <View onLayout={(e) => setCarouselWidth(e.nativeEvent.layout.width)}>
        {carouselWidth > 0 && (
          <ScrollView
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
                    <ThemedText style={styles.iconEmoji}>{article.icon}</ThemedText>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.dotsRow}>
        <PaginationDots count={articles.length} activeIndex={activeIndex} />
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
  iconEmoji: { fontSize: 30 },
  dotsRow: { alignItems: 'center', paddingTop: Spacing.xs },
});
