import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ActivityItem } from '@/lib/api';

const SEASON_EMOJI: Record<string, string> = {
  spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️',
};
const WEATHER_EMOJI: Record<string, string> = {
  sunny: '☀️', cloudy: '☁️', rainy: '🌧️', any: '🌤️',
};

export default function ActivityDetailScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const params = useLocalSearchParams<{ data: string }>();

  let activity: ActivityItem;
  try {
    const parsed = JSON.parse(params.data ?? '');
    if (!parsed?.id) throw new Error('invalid');
    activity = parsed as ActivityItem;
  } catch {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ThemedText style={{ color: colors.destructive }}>Activity not found.</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const costLabel = activity.cost_indicator === 'free' ? 'Free' : 'Low cost';
  const costColor = activity.cost_indicator === 'free' ? colors.accent : colors.primary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary }}>← Back</ThemedText>
        </Pressable>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{activity.title}</ThemedText>

        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: costColor + '22', borderColor: costColor }]}>
            <ThemedText style={[styles.badgeText, { color: costColor }]}>{costLabel}</ThemedText>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.border }]}>
            <ThemedText style={styles.badgeText}>⏱ {activity.estimated_duration_minutes} min</ThemedText>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.border }]}>
            <ThemedText style={styles.badgeText}>
              👧 {activity.age_min}–{activity.age_max} yrs
            </ThemedText>
          </View>
        </View>

        <ThemedText style={[styles.description, { color: colors.onSurface }]}>
          {activity.description}
        </ThemedText>

        {activity.season_relevance && activity.season_relevance.length > 0 && (
          <View style={styles.tagGroup}>
            <ThemedText style={[styles.tagLabel, { color: colors.muted }]}>SEASONS</ThemedText>
            <View style={styles.tags}>
              {activity.season_relevance.map(s => (
                <View key={s} style={[styles.tag, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ThemedText style={styles.tagText}>{SEASON_EMOJI[s]} {s}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {activity.weather_suitability && activity.weather_suitability.length > 0 && (
          <View style={styles.tagGroup}>
            <ThemedText style={[styles.tagLabel, { color: colors.muted }]}>WEATHER</ThemedText>
            <View style={styles.tags}>
              {activity.weather_suitability.map(w => (
                <View key={w} style={[styles.tag, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ThemedText style={styles.tagText}>{WEATHER_EMOJI[w]} {w}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.ctaBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.ctaHint, { color: colors.muted }]}>
            Include this activity when creating a challenge from the Home screen.
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { width: 72 },
  content: { padding: Spacing.screenHorizontal, gap: Spacing.lg },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: { fontSize: 13, fontWeight: '500' },
  description: { fontSize: 16, lineHeight: 26 },
  tagGroup: { gap: Spacing.xs },
  tagLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  tagText: { fontSize: 13 },
  ctaBox: { borderRadius: 12, borderWidth: 1, padding: Spacing.md },
  ctaHint: { fontSize: 13, textAlign: 'center' },
});
