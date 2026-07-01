import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaginationDots } from '@/components/onboarding/PaginationDots';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import { showAlert } from '@/lib/utils/alert';
import type { Article } from '@/components/article-of-the-day';

interface Props {
  visible: boolean;
  article: Article | null;
  onClose: () => void;
}

export function ArticleDetailModal({ visible, article, onClose }: Props) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const [pageIndex, setPageIndex] = useState(0);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setPageIndex(0);
      setSourcesOpen(false);
    }
  }, [visible]);

  if (!article) return null;

  const pages = article.pages;
  const page = pages[pageIndex];
  const isLastPage = pageIndex === pages.length - 1;

  function handleNext() {
    setSourcesOpen(false);
    setPageIndex((i) => Math.min(i + 1, pages.length - 1));
  }

  function handleBack() {
    setSourcesOpen(false);
    setPageIndex((i) => Math.max(i - 1, 0));
  }

  async function handleOpenSource(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      showAlert(t('common.error'), t('home.articleModal.linkError'));
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.dotsRow}>
          <PaginationDots count={pages.length} activeIndex={pageIndex} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.accent + '14', borderColor: colors.accent + '33' }]}>
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <IconSymbol name="xmark" size={20} color={colors.onSurface} />
          </Pressable>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {page.heading && (
              <ThemedText type="title" style={[styles.heading, { color: colors.onSurface }]}>
                {page.heading}
              </ThemedText>
            )}
            <ThemedText style={[styles.body, { color: colors.onSurface }]}>{page.body}</ThemedText>

            {page.sources && page.sources.length > 0 && (
              <View>
                <Pressable onPress={() => setSourcesOpen((o) => !o)} hitSlop={8}>
                  <ThemedText style={[styles.sourcesToggle, { color: colors.primary }]}>
                    {t('home.articleModal.sources')} {sourcesOpen ? '▲' : '▼'}
                  </ThemedText>
                </Pressable>
                {sourcesOpen &&
                  page.sources.map((source) => (
                    <Pressable
                      key={source.url}
                      onPress={() => handleOpenSource(source.url)}
                      hitSlop={8}
                      accessibilityRole="link"
                    >
                      <ThemedText style={[styles.sourceItem, { color: colors.primary }]}>
                        {source.label}
                      </ThemedText>
                    </Pressable>
                  ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={handleBack}
              hitSlop={8}
              disabled={pageIndex === 0}
              style={{ opacity: pageIndex === 0 ? 0 : 1 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <IconSymbol name="chevron.left" size={24} color={colors.onSurface} />
            </Pressable>

            {isLastPage ? (
              <Pressable
                style={[styles.completeButton, { backgroundColor: colors.primary }]}
                onPress={onClose}
              >
                <ThemedText style={[styles.completeButtonText, { color: colors.buttonText }]}>
                  {t('home.articleModal.completed')}
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleNext}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('common.next')}
              >
                <IconSymbol name="chevron.right" size={24} color={colors.onSurface} />
              </Pressable>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.screenHorizontal, gap: Spacing.md },
  dotsRow: { alignItems: 'center' },
  card: {
    flex: 1,
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  closeButton: { position: 'absolute', top: Spacing.md, right: Spacing.md, zIndex: 1 },
  scrollContent: { paddingTop: Spacing.xl, gap: Spacing.md },
  heading: { fontSize: 26, lineHeight: 32 },
  body: { fontSize: 16, lineHeight: 24 },
  sourcesToggle: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  sourceItem: { fontSize: 13, marginTop: Spacing.xs, textDecorationLine: 'underline' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.md },
  completeButton: { flex: 1, height: 48, borderRadius: DEFAULT_RADII.button, alignItems: 'center', justifyContent: 'center', marginLeft: Spacing.lg },
  completeButtonText: { fontSize: 15, fontWeight: '600' },
});
