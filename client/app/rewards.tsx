import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ui/error-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { ThemedText } from '@/components/themed-text';
import { fadeIn } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import { rewardsApi, type RewardLevelProgress, type RewardsBalance } from '@/lib/api';
import { getGermanErrorMessage } from '@/lib/utils/api-error';
import { showAlert } from '@/lib/utils/alert';

export default function RewardsScreen() {
  const { colors, radii } = useAppTheme();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<RewardsBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // chosen option per level id (only levels with choice_options)
  const [chosenOptions, setChosenOptions] = useState<Record<string, string>>({});
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await rewardsApi.getRewardsBalance();
      setData(res.data);
    } catch (e) {
      setError(getGermanErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBalance(); }, [fetchBalance, i18n.language]);

  async function handleRedeem(level: RewardLevelProgress) {
    if (redeemingId) return;
    const chosen = level.choice_options ? chosenOptions[level.id] : undefined;
    if (level.choice_options && !chosen) return; // button is disabled in this state anyway
    setRedeemingId(level.id);
    try {
      const res = await rewardsApi.redeemLevel(level.id, chosen);
      showAlert(
        t('rewards.redeemSuccessTitle'),
        t('rewards.redeemSuccessMessage', { code: res.data.voucher_code }),
      );
      fetchBalance();
    } catch (e) {
      showAlert(t('common.error'), getGermanErrorMessage(e));
    } finally {
      setRedeemingId(null);
    }
  }

  function optionLabel(option: string): string {
    // Known options have translations; unknown ones fall back to the raw key.
    const key = `rewards.options.${option}`;
    const label = t(key);
    return label === key ? option : label;
  }

  function renderLevel(level: RewardLevelProgress) {
    if (!data) return null;
    const isRedeeming = redeemingId === level.id;
    const capReached =
      level.annual_redemption_cap != null &&
      (level.redemptions_this_year ?? 0) >= level.annual_redemption_cap;
    const canRedeem =
      level.state === 'unlocked' &&
      !capReached &&
      (!level.choice_options || !!chosenOptions[level.id]);
    const ratio = level.points_threshold > 0 ? Math.min(data.balance / level.points_threshold, 1) : 0;

    return (
      <View key={level.id} style={[styles.levelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.levelHeader}>
          <ThemedText style={[styles.levelNumber, { color: colors.muted }]}>
            {t('rewards.levelLabel', { number: level.level_number })}
          </ThemedText>
          {level.state === 'redeemed_this_quarter' ? (
            <View style={[styles.stateBadge, { backgroundColor: colors.accent + '22' }]}>
              <ThemedText style={[styles.stateBadgeText, { color: colors.accent }]}>
                {t('rewards.alreadyRedeemed')}
              </ThemedText>
            </View>
          ) : level.state === 'unlocked' ? (
            <View style={[styles.stateBadge, { backgroundColor: colors.primary + '22' }]}>
              <ThemedText style={[styles.stateBadgeText, { color: colors.primary }]}>
                {t('rewards.unlocked')}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <ThemedText style={[styles.levelTitle, { color: colors.onSurface }]}>{level.title}</ThemedText>
        {level.description ? (
          <ThemedText style={[styles.levelDesc, { color: colors.muted }]}>{level.description}</ThemedText>
        ) : null}

        {/* Progress toward threshold */}
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${ratio * 100}%` as any, backgroundColor: level.state === 'locked' ? colors.muted : colors.accent },
            ]}
          />
        </View>
        <ThemedText style={[styles.progressLabel, { color: colors.muted }]}>
          {t('rewards.pointsProgress', { balance: data.balance, threshold: level.points_threshold })}
        </ThemedText>

        {/* Annual cap messaging (Level 4) */}
        {level.annual_redemption_cap != null && (
          <ThemedText style={[styles.capLabel, { color: capReached ? colors.destructiveMuted : colors.muted }]}>
            {capReached
              ? t('rewards.annualCapReached')
              : t('rewards.annualCapStatus', { used: level.redemptions_this_year ?? 0, cap: level.annual_redemption_cap })}
          </ThemedText>
        )}

        {/* Choice picker (Level 3) — only interactive while redeemable */}
        {level.choice_options && level.state === 'unlocked' && !capReached && (
          <>
            <ThemedText style={[styles.chooseLabel, { color: colors.muted }]}>{t('rewards.chooseOption')}</ThemedText>
            <View style={styles.optionsRow}>
              {level.choice_options.map((option) => {
                const selected = chosenOptions[level.id] === option;
                return (
                  <Pressable
                    key={option}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                        borderRadius: radii.badge,
                      },
                    ]}
                    onPress={() => setChosenOptions((prev) => ({ ...prev, [level.id]: option }))}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <ThemedText style={[styles.optionText, { color: selected ? colors.buttonText : colors.onSurface }]}>
                      {optionLabel(option)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {level.state === 'unlocked' && (
          <Pressable
            style={[
              styles.redeemButton,
              {
                backgroundColor: canRedeem ? colors.primary : colors.border,
                borderRadius: radii.button,
              },
            ]}
            onPress={() => handleRedeem(level)}
            disabled={!canRedeem || isRedeeming}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canRedeem || isRedeeming }}
          >
            {isRedeeming
              ? <ActivityIndicator color={colors.buttonText} />
              : <ThemedText style={[styles.redeemText, { color: canRedeem ? colors.buttonText : colors.muted }]}>
                  {t('rewards.redeem')}
                </ThemedText>}
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary }}>← {t('common.back')}</ThemedText>
        </Pressable>
        <ThemedText type="defaultSemiBold" style={styles.headerTitle}>{t('rewards.title')}</ThemedText>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.skeletonContainer}><SkeletonList count={4} rowHeight={140} /></View>
      ) : error ? (
        <View style={styles.center}>
          <ErrorState message={error} onRetry={fetchBalance} />
        </View>
      ) : data ? (
        <Animated.View entering={fadeIn()} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content}>
            {/* Quarter balance header */}
            <View style={[styles.balanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.balanceValue, { color: colors.primary }]}>{data.balance}</ThemedText>
              <ThemedText style={[styles.balanceLabel, { color: colors.onSurface }]}>
                {t('rewards.quarterBalance')}
              </ThemedText>
              <ThemedText style={[styles.quarterKey, { color: colors.muted }]}>
                {t('rewards.quarterLabel', { key: data.quarter_key })}
              </ThemedText>
            </View>

            {data.levels.map((level) => renderLevel(level))}

            <ThemedText style={[styles.infoNote, { color: colors.muted }]}>
              {t('rewards.infoNote')}
            </ThemedText>
          </ScrollView>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { width: 72, minHeight: 44, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, textAlign: 'center' },
  skeletonContainer: { flex: 1, padding: Spacing.md },
  content: { padding: Spacing.screenHorizontal, gap: Spacing.md, paddingBottom: Spacing.xl },
  balanceCard: {
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 2,
  },
  balanceValue: { fontSize: 44, fontWeight: '800', lineHeight: 52 },
  balanceLabel: { fontSize: 15, fontWeight: '600' },
  quarterKey: { fontSize: 12 },
  levelCard: { borderRadius: DEFAULT_RADII.card, borderWidth: 1, padding: Spacing.md, gap: Spacing.xs },
  levelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelNumber: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  stateBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: DEFAULT_RADII.badge },
  stateBadgeText: { fontSize: 11, fontWeight: '700' },
  levelTitle: { fontSize: 16, fontWeight: '700' },
  levelDesc: { fontSize: 13, lineHeight: 18 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: Spacing.xs },
  progressFill: { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 12 },
  capLabel: { fontSize: 12, fontWeight: '600' },
  chooseLabel: { fontSize: 12, fontWeight: '600', marginTop: Spacing.xs },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  optionChip: { borderWidth: 1, paddingHorizontal: Spacing.md, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  optionText: { fontSize: 13, fontWeight: '600' },
  redeemButton: { height: 46, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs },
  redeemText: { fontSize: 15, fontWeight: '700' },
  infoNote: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: Spacing.sm },
});
