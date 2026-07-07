import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ArticleDetailModal } from '@/components/article-detail-modal';
import { CARD_WIDTH } from '@/components/activity-suggestions-row';
import { ThemedText } from '@/components/themed-text';
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
interface Props {
  /**
   * card: fixed-width vertical tile that lines up inside the suggestions
   * carousel. banner: full-width horizontal row for its own line under the
   * 2-up suggestions grid on taller screens.
   */
  variant?: 'card' | 'banner';
}

export function ArticleTeaser({ variant = 'card' }: Props = {}) {
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

  const banner = variant === 'banner';

  return (
    <>
      <PressableScale
        style={[
          banner ? styles.banner : styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onPress={() => setOpenArticle(featured)}
        accessibilityRole="button"
        accessibilityLabel={`${t('home.articleOfTheDay')}: ${featured.title}`}
      >
        <View
          style={[
            banner ? styles.bannerIcon : styles.iconRow,
            { backgroundColor: colors.accent + '22' },
          ]}
        >
          <Illustration name={featured.icon} size={28} />
        </View>
        <View style={banner ? styles.bannerText : undefined}>
          <ThemedText style={[styles.label, { color: colors.primary }]} numberOfLines={1}>
            {t('home.articleOfTheDay')}
          </ThemedText>
          <ThemedText style={[styles.title, { color: colors.onSurface }]} numberOfLines={2}>
            {featured.title}
          </ThemedText>
          <ThemedText style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
            {metaText}
          </ThemedText>
        </View>
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
    width: CARD_WIDTH,
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.sm,
    gap: 2,
  },
  iconRow: {
    height: 44,
    borderRadius: DEFAULT_RADII.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.sm,
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: DEFAULT_RADII.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { flex: 1, gap: 2 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  meta: { fontSize: 11, lineHeight: 15, marginTop: 2 },
});
