import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiClient, activitiesApi, onboardingApi, type ActivityItem } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CITY_KEY = '@dba_city_preference';

export default function HomeScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [suggestion, setSuggestion] = useState<ActivityItem | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSuggestion() {
      try {
        // Get first child's ID for age/interest matching
        const childrenRes = await onboardingApi.getChildren();
        const firstChild = childrenRes.data[0];
        const city = await AsyncStorage.getItem(CITY_KEY);
        const res = await activitiesApi.suggestion(firstChild?.id, city);
        if (!cancelled) setSuggestion(res.data);
      } catch {
        // suggestion is best-effort; silent failure is fine
      } finally {
        if (!cancelled) setLoadingSuggestion(false);
      }
    }

    loadSuggestion();
    return () => { cancelled = true; };
  }, []);

  function openSuggestion() {
    if (!suggestion) return;
    router.push({ pathname: '/activity/[id]', params: { id: suggestion.id, data: JSON.stringify(suggestion) } } as any);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">DigitalBalance @home</ThemedText>

        {/* Suggestion card */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>TODAY'S SUGGESTION</ThemedText>

          {loadingSuggestion ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.md }} />
          ) : suggestion ? (
            <>
              <ThemedText style={styles.suggestionTitle}>{suggestion.title}</ThemedText>
              <ThemedText style={[styles.suggestionMeta, { color: colors.muted }]}>
                ⏱ {suggestion.estimated_duration_minutes} min ·{' '}
                {suggestion.cost_indicator === 'free' ? 'Free' : 'Low cost'}
              </ThemedText>
              <Pressable
                style={[styles.ctaButton, { backgroundColor: colors.primary }]}
                onPress={openSuggestion}>
                <ThemedText style={[styles.ctaText, { color: colors.buttonText }]}>Let's do it →</ThemedText>
              </Pressable>
            </>
          ) : (
            <ThemedText style={{ color: colors.muted, fontSize: 14 }}>
              No suggestion available right now.
            </ThemedText>
          )}
        </View>

        {/* Collage placeholder */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>YOUR COLLAGE</ThemedText>
          <ThemedText style={{ color: colors.muted, fontSize: 14 }}>
            Challenges and collage coming in Milestone 6.
          </ThemedText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.screenHorizontal, gap: Spacing.lg, paddingTop: Spacing.lg },
  section: { borderRadius: 16, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  suggestionTitle: { fontSize: 17, fontWeight: '600', lineHeight: 24 },
  suggestionMeta: { fontSize: 13 },
  ctaButton: { height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs },
  ctaText: { fontSize: 15, fontWeight: '600' },
});
