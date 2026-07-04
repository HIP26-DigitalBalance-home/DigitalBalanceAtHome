import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ui/error-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';
import { fadeIn } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import { notificationsApi, type NotificationItem } from '@/lib/api';
import { getGermanErrorMessage } from '@/lib/utils/api-error';

function initialsOf(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function relativeTime(iso: string, t: TFunction): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t('notifications.justNow');
  if (minutes < 60) return t('notifications.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('notifications.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('notifications.daysAgo', { count: days });
}

export default function NotificationsScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    notificationsApi.list()
      .then((r) => {
        if (cancelled) return;
        setItems(r.data);
        // Opening the activity box marks everything as read
        if (r.data.some((n) => !n.read)) notificationsApi.markAllRead().catch(() => {});
      })
      .catch((e) => { if (!cancelled) setError(getGermanErrorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary }}>← {t('common.back')}</ThemedText>
        </Pressable>
        <ThemedText style={styles.headerTitle}>{t('notifications.title')}</ThemedText>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.skeletonContainer}><SkeletonList count={4} rowHeight={72} /></View>
      ) : error ? (
        <View style={styles.center}><ErrorState message={error} /></View>
      ) : items.length === 0 ? (
        <Animated.View entering={fadeIn()} style={styles.center}>
          <ThemedText style={{ fontSize: 40 }}>🔔</ThemedText>
          <ThemedText style={{ color: colors.muted, textAlign: 'center' }}>{t('notifications.empty')}</ThemedText>
        </Animated.View>
      ) : (
        <Animated.View entering={fadeIn()} style={{ flex: 1 }}>
          <FlatList
            data={items}
            keyExtractor={(n) => n.id}
            contentContainerStyle={styles.content}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.row,
                  { backgroundColor: colors.surface, borderColor: item.read ? colors.border : colors.primary },
                ]}
                onPress={() => {
                  if (item.challenge_id) {
                    router.push({ pathname: '/challenge/[id]', params: { id: item.challenge_id } } as any);
                  }
                }}
                disabled={!item.challenge_id}
              >
                <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
                  <ThemedText style={[styles.avatarText, { color: colors.primary }]}>
                    {item.actor_display_name ? initialsOf(item.actor_display_name) : '👥'}
                  </ThemedText>
                </View>
                <View style={styles.rowInfo}>
                  <ThemedText style={styles.rowText}>
                    {t('notifications.challengeInvite', {
                      name: item.actor_display_name ?? t('notifications.someone'),
                      title: item.challenge_title ?? t('notifications.aChallenge'),
                    })}
                  </ThemedText>
                  <ThemedText style={[styles.rowTime, { color: colors.muted }]}>
                    {relativeTime(item.created_at, t)}
                  </ThemedText>
                </View>
                {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
              </Pressable>
            )}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  backButton: { minHeight: 44, justifyContent: 'center' },
  skeletonContainer: { flex: 1, padding: Spacing.screenHorizontal },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg },
  content: { padding: Spacing.screenHorizontal, gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.md,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700' },
  rowInfo: { flex: 1, gap: 2 },
  rowText: { fontSize: 14, lineHeight: 19 },
  rowTime: { fontSize: 12 },
  unreadDot: { width: 9, height: 9, borderRadius: 5 },
});
