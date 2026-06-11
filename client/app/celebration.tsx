import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollageGrid } from '@/components/collage-grid';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { challengesApi, type ChallengeWithProgress } from '@/lib/api';
import { saveCollagePng, shareCollagePng } from '@/lib/collage-export';
import { showAlert } from '@/lib/utils/alert';

export default function CelebrationScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const [challenge, setChallenge] = useState<ChallengeWithProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!challengeId) return;
    let cancelled = false;
    challengesApi.getById(challengeId)
      .then((r) => { if (!cancelled) setChallenge(r.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [challengeId]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const confetti = (await import('canvas-confetti')).default;
        const duration = 3000;
        const end = Date.now() + duration;

        function frame() {
          confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.7 },
            colors: ['#F4845F', '#4CAF82', '#F9B49A', '#FFD700'],
          });
          confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.7 },
            colors: ['#F4845F', '#4CAF82', '#F9B49A', '#FFD700'],
          });
          if (Date.now() < end) requestAnimationFrame(frame);
        }
        frame();

        cleanup = () => confetti.reset();
      } catch {
        // confetti not available
      }
    })();

    return () => cleanup?.();
  }, []);

  async function handleSave() {
    if (!challenge) return;
    setExporting(true);
    try {
      await saveCollagePng(challenge.title, challenge.activities);
    } catch {
      showAlert('Error', 'Could not export the collage. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function handleShare() {
    if (!challenge) return;
    setExporting(true);
    try {
      await shareCollagePng(challenge.title, challenge.activities);
    } catch {
      // user cancelled or not supported
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!challenge) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ThemedText>Challenge not found.</ThemedText>
          <Pressable onPress={() => router.back()}>
            <ThemedText style={{ color: colors.primary }}>Go back</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={[styles.emoji]}>🎉</ThemedText>
        <ThemedText type="title" style={[styles.headline, { color: colors.onSurface }]}>
          Challenge complete!
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
          You filled every slot in &quot;{challenge.title}&quot; — amazing work with your family!
        </ThemedText>

        <View collapsable={false} style={styles.collageWrapper}>
          <CollageGrid slots={challenge.activities} />
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={exporting}
          >
            {exporting
              ? <ActivityIndicator color={colors.buttonText} />
              : <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>Save as PNG</ThemedText>}
          </Pressable>
          <Pressable
            style={[styles.button, { backgroundColor: colors.accent }]}
            onPress={handleShare}
            disabled={exporting}
          >
            <ThemedText style={[styles.buttonText, { color: '#fff' }]}>Share</ThemedText>
          </Pressable>
        </View>

        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <ThemedText style={{ color: colors.primary, fontSize: 15 }}>← Back to home</ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  content: {
    padding: Spacing.screenHorizontal,
    paddingTop: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  emoji: { fontSize: 56 },
  headline: { textAlign: 'center' },
  subtitle: { textAlign: 'center', fontSize: 15, lineHeight: 22, paddingHorizontal: Spacing.md },
  collageWrapper: { width: '100%' },
  buttonRow: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  backLink: { paddingVertical: Spacing.md },
});
