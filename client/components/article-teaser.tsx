import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ArticleDetailModal } from '@/components/article-detail-modal';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Illustration } from '@/components/ui/illustration';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import {
  ARTICLE_ICONS,
  ARTICLE_IDS,
  ARTICLES_READ_KEY,
  dailyArticleIndex,
  type Article,
  type ArticlePage,
} from '@/lib/articles';

/**
 * Slim "Article of the Day" teaser pinned near the top of the Home screen.
 *
 * Shows one article at a time: the daily rotation pick, skipping ahead to the
 * first unread article so new content always wins. Once every article has
 * been read the teaser stays as a compact "read" row that can still be tapped
 * to revisit today's article. Read state is tracked locally (AsyncStorage) —
 * marked when the reader finishes the last page of the detail modal.
 */
export function ArticleTeaser() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const [readIds, setReadIds] = useState<string[] | null>(null);
  const [openArticle, setOpenArticle] = useState<Article | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      AsyncStorage.getItem(ARTICLES_READ_KEY).then(
        (raw) => {
          if (cancelled) return;
          try {
            const parsed = raw ? JSON.parse(raw) : [];
            setReadIds(Array.isArray(parsed) ? parsed : []);
          } catch {
            setReadIds([]);
          }
        },
        () => {
          if (!cancelled) setReadIds([]);
        }
      );
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const articles: Article[] = useMemo(
    () =>
      ARTICLE_IDS.map((id) => ({
        id,
        icon: ARTICLE_ICONS[id],
        eyebrow: t(`home.articles.${id}.eyebrow`),
        title: t(`home.articles.${id}.title`),
        description: t(`home.articles.${id}.description`),
        pages: t(`home.articles.${id}.pages`, { returnObjects: true }) as ArticlePage[],
      })),
    [t]
  );

  function markRead(id: string) {
    setReadIds((prev) => {
      if (prev?.includes(id)) return prev;
      const next = [...(prev ?? []), id];
      AsyncStorage.setItem(ARTICLES_READ_KEY, JSON.stringify(next)).catch(() => {
        // best-effort — worst case the teaser shows the article as unread again
      });
      return next;
    });
  }

  // Wait for the storage check to avoid a "unread → read" flicker on mount.
  if (readIds === null) return null;

  const read = new Set(readIds);
  const startIndex = dailyArticleIndex();
  // Today's rotation pick — unless it has been read and another one hasn't.
  let featured = articles[startIndex];
  for (let offset = 0; offset < articles.length; offset++) {
    const candidate = articles[(startIndex + offset) % articles.length];
    if (!read.has(candidate.id)) {
      featured = candidate;
      break;
    }
  }
  const isRead = read.has(featured.id);
  const metaText = isRead ? t('home.articleTeaser.read') : t('home.articleTeaser.readTime');

  return (
    <>
      <PressableScale
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setOpenArticle(featured)}
        accessibilityRole="button"
        accessibilityLabel={`${t('home.articleOfTheDay')}: ${featured.title}`}
      >
        <View style={[styles.iconBubble, { backgroundColor: colors.accent + '22' }]}>
          <Illustration name={featured.icon} size={30} />
        </View>
        <View style={styles.textBlock}>
          <ThemedText style={[styles.label, { color: colors.primary + '99' }]} numberOfLines={1}>
            {t('home.articleOfTheDay')} · {metaText}
          </ThemedText>
          <ThemedText style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>
            {featured.title}
          </ThemedText>
        </View>
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </PressableScale>

      <ArticleDetailModal
        visible={openArticle !== null}
        article={openArticle}
        onClose={() => setOpenArticle(null)}
        onCompleted={() => {
          if (openArticle) markRead(openArticle.id);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  iconBubble: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  textBlock: { flex: 1, gap: 2 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
});
