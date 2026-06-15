import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { challengesApi, groupsApi } from '@/lib/api';

type Step = 1 | 2 | 3;

interface GroupSummary {
  id: string;
  name: string;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function CreateChallengeScreen() {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();
  const { activityIds: activityIdsParam } = useLocalSearchParams<{ activityIds?: string }>();

  // The collage is built before this wizard; activity ids arrive as a param.
  const activityIds = useMemo(
    () => (activityIdsParam ? activityIdsParam.split(',').filter(Boolean) : []),
    [activityIdsParam]
  );

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Title + description
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Dates — default to today → today + 14 days
  const [startDate, setStartDate] = useState(() => toISODate(new Date()));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return toISODate(d);
  });

  // Step 3: Group
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (step === 3 && groups.length === 0) {
      setLoadingGroups(true);
      groupsApi.getMyGroups().then((r) => setGroups(r.data)).catch(() => {}).finally(() => setLoadingGroups(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function validateDates(): string | null {
    if (!startDate || !endDate) return t('createChallenge.bothDates');
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return t('createChallenge.invalidDate');
    if (e < s) return t('createChallenge.endAfterStart');
    const today = toISODate(new Date());
    if (endDate < today) return t('createChallenge.endNotPast');
    return null;
  }

  function nextStep() {
    setError(null);
    if (step === 1) {
      if (!title.trim()) { setError(t('createChallenge.titleRequired')); return; }
      setStep(2);
    } else if (step === 2) {
      const dateError = validateDates();
      if (dateError) { setError(dateError); return; }
      setStep(3);
    }
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await challengesApi.create({
        title: title.trim(),
        description: description.trim() || null,
        group_id: selectedGroupId,
        activity_ids: activityIds,
        start_date: startDate,
        end_date: endDate,
      });
      router.replace({ pathname: '/challenge/[id]', params: { id: res.data.id } } as any);
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? t('createChallenge.createFailed');
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  }

  // The wizard must never be entered without a built collage.
  if (activityIds.length === 0) {
    return <Redirect href={'/(tabs)/explore' as any} />;
  }

  const stepTitle = ['', t('createChallenge.stepDetails'), t('createChallenge.stepDates'), t('createChallenge.stepGroup')][step];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => (step === 1 ? router.back() : setStep((s) => (s - 1) as Step))}>
          <ThemedText style={{ color: colors.primary }}>← {step === 1 ? t('common.back') : t('common.previous')}</ThemedText>
        </Pressable>
        <ThemedText style={styles.stepTitle}>{stepTitle}</ThemedText>
        <ThemedText style={[styles.stepCounter, { color: colors.muted }]}>{step}/3</ThemedText>
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: colors.destructive + '15' }]}>
          <ThemedText style={[styles.errorText, { color: colors.destructive }]}>{error}</ThemedText>
        </View>
      )}

      {step === 1 && (
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText style={[styles.label, { color: colors.muted }]}>{t('createChallenge.titleLabel')}</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]}
            value={title}
            onChangeText={setTitle}
            placeholder={t('createChallenge.titlePlaceholder')}
            placeholderTextColor={colors.muted}
          />
          <ThemedText style={[styles.label, { color: colors.muted }]}>{t('createChallenge.descLabel')}</ThemedText>
          <TextInput
            style={[styles.input, styles.textarea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('createChallenge.descPlaceholder')}
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
          />
          <Pressable style={[styles.nextButton, { backgroundColor: colors.primary }]} onPress={nextStep}>
            <ThemedText style={[styles.nextText, { color: colors.buttonText }]}>{t('createChallenge.nextArrow')}</ThemedText>
          </Pressable>
        </ScrollView>
      )}

      {step === 2 && (
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText style={[styles.label, { color: colors.muted }]}>{t('createChallenge.startDate')}</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="JJJJ-MM-TT"
            placeholderTextColor={colors.muted}
            {...(Platform.OS === 'web' ? ({ type: 'date', min: toISODate(new Date()) } as any) : {})}
          />
          <ThemedText style={[styles.label, { color: colors.muted }]}>{t('createChallenge.endDate')}</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="JJJJ-MM-TT"
            placeholderTextColor={colors.muted}
            {...(Platform.OS === 'web' ? ({ type: 'date', min: startDate || toISODate(new Date()) } as any) : {})}
          />
          <Pressable style={[styles.nextButton, { backgroundColor: colors.primary }]} onPress={nextStep}>
            <ThemedText style={[styles.nextText, { color: colors.buttonText }]}>{t('createChallenge.nextArrow')}</ThemedText>
          </Pressable>
        </ScrollView>
      )}

      {step === 3 && (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText style={[styles.label, { color: colors.muted }]}>{t('createChallenge.whoFor')}</ThemedText>

            <Pressable
              style={[
                styles.groupOption,
                { backgroundColor: selectedGroupId === null ? colors.primary + '15' : colors.surface, borderColor: selectedGroupId === null ? colors.primary : colors.border },
              ]}
              onPress={() => setSelectedGroupId(null)}
            >
              <ThemedText style={{ color: colors.onSurface, fontWeight: '600' }}>{t('createChallenge.personal')}</ThemedText>
              <ThemedText style={{ color: colors.muted, fontSize: 13 }}>{t('createChallenge.personalSub')}</ThemedText>
            </Pressable>

            {loadingGroups ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.md }} />
            ) : (
              groups.map((g) => (
                <Pressable
                  key={g.id}
                  style={[
                    styles.groupOption,
                    { backgroundColor: selectedGroupId === g.id ? colors.primary + '15' : colors.surface, borderColor: selectedGroupId === g.id ? colors.primary : colors.border },
                  ]}
                  onPress={() => setSelectedGroupId(g.id)}
                >
                  <ThemedText style={{ color: colors.onSurface, fontWeight: '600' }}>{g.name}</ThemedText>
                  <ThemedText style={{ color: colors.muted, fontSize: 13 }}>{t('createChallenge.groupSub')}</ThemedText>
                </Pressable>
              ))
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable
              style={[styles.nextButton, { backgroundColor: submitting ? colors.muted : colors.primary }]}
              onPress={submit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <ThemedText style={[styles.nextText, { color: colors.buttonText }]}>{t('createChallenge.submit')}</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
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
  stepTitle: { fontSize: 16, fontWeight: '600' },
  stepCounter: { fontSize: 13 },
  errorBox: { marginHorizontal: Spacing.screenHorizontal, marginTop: Spacing.sm, borderRadius: 8, padding: Spacing.sm },
  errorText: { fontSize: 13 },
  content: { padding: Spacing.screenHorizontal, gap: Spacing.md },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  input: { height: 48, borderRadius: 10, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: 15 },
  textarea: { height: 80, paddingTop: Spacing.sm, textAlignVertical: 'top' },
  groupOption: { borderRadius: 12, borderWidth: 1, padding: Spacing.md, gap: 4 },
  nextButton: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontSize: 16, fontWeight: '600' },
  footer: { padding: Spacing.screenHorizontal, borderTopWidth: 1 },
});
