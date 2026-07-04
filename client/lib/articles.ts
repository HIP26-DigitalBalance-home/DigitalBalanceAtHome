import type { IllustrationName } from '@/components/ui/illustration';

/** Educational articles — client-side content, sourced from the i18n bundles. */

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

export const ARTICLE_IDS = ['screenTimeByAge', 'screenTimeAndSleep', 'movementMatters'] as const;
export type ArticleId = (typeof ARTICLE_IDS)[number];

export const ARTICLE_ICONS: Record<ArticleId, IllustrationName> = {
  screenTimeByAge: 'toco-phone',
  screenTimeAndSleep: 'bunny-night',
  movementMatters: 'podium-cheer',
};

/** AsyncStorage key holding a JSON string[] of read article ids. */
export const ARTICLES_READ_KEY = '@dba_articles_read';

/**
 * Deterministic daily rotation through the article catalogue: every day
 * features the next article, so all of them get surfaced over time without
 * any backend involvement.
 */
export function dailyArticleIndex(date: Date = new Date()): number {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000);
  return dayOfYear % ARTICLE_IDS.length;
}
