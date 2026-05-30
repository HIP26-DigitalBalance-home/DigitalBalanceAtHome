import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { activitiesApi, challengesApi, groupsApi, type ActivityItem } from '@/lib/api';

type Step = 1 | 2 | 3 | 4;

interface GroupSummary {
  id: string;
  name: string;
}

export default function CreateChallengeScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Title + description
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Activities
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Step 3: Dates
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Step 4: Group
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (step === 2 && activities.length === 0) {
      setLoadingActivities(true);
      activitiesApi.list({}).then((r) => setActivities(r.data)).catch(() => {}).finally(() => setLoadingActivities(false));
    }
    if (step === 4 && groups.length === 0) {
      setLoadingGroups(true);
      groupsApi.getMyGroups().then((r) => setGroups(r.data)).catch(() => {}).finally(() => setLoadingGroups(false));
    }
  }, [step]);

  function toggleActivity(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function validateDates(): string | null {
    if (!startDate || !endDate) return 'Both dates are required.';
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 'Invalid date format.';
    if (e < s) return 'End date must be on or after start date.';
    return null;
  }

  function nextStep() {
    setError(null);
    if (step === 1) {
      if (!title.trim()) { setError('Title is required.'); return; }
      setStep(2);
    } else if (step === 2) {
      if (selectedIds.length === 0) { setError('Select at least one activity.'); return; }
      setStep(3);
    } else if (step === 3) {
      const dateError = validateDates();
      if (dateError) { setError(dateError); return; }
      setStep(4);
    }
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      await challengesApi.create({
        title: title.trim(),
        description: description.trim() || null,
        group_id: selectedGroupId,
        activity_ids: selectedIds,
        start_date: startDate,
        end_date: endDate,
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? 'Failed to create challenge. Please try again.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  }

  const stepTitle = ['', 'Challenge details', 'Choose activities', 'Set dates', 'Assign to group'][step];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => (step === 1 ? router.back() : setStep((s) => (s - 1) as Step))}>
          <ThemedText style={{ color: colors.primary }}>← {step === 1 ? 'Back' : 'Previous'}</ThemedText>
        </Pressable>
        <ThemedText style={styles.stepTitle}>{stepTitle}</ThemedText>
        <ThemedText style={[styles.stepCounter, { color: colors.muted }]}>{step}/4</ThemedText>
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: colors.destructive + '15' }]}>
          <ThemedText style={[styles.errorText, { color: colors.destructive }]}>{error}</ThemedText>
        </View>
      )}

      {step === 1 && (
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText style={[styles.label, { color: colors.muted }]}>CHALLENGE TITLE *</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Summer family adventures"
            placeholderTextColor={colors.muted}
          />
          <ThemedText style={[styles.label, { color: colors.muted }]}>DESCRIPTION (optional)</ThemedText>
          <TextInput
            style={[styles.input, styles.textarea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe this challenge..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
          />
          <Pressable style={[styles.nextButton, { backgroundColor: colors.primary }]} onPress={nextStep}>
            <ThemedText style={[styles.nextText, { color: colors.buttonText }]}>Next →</ThemedText>
          </Pressable>
        </ScrollView>
      )}

      {step === 2 && (
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.hint, { color: colors.muted }]}>
            Tap activities to select them. The order you select sets the collage layout.
            {selectedIds.length > 0 ? ` (${selectedIds.length} selected)` : ''}
          </ThemedText>
          {loadingActivities ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <FlatList
              data={activities}
              keyExtractor={(a) => a.id}
              style={{ flex: 1 }}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => {
                const pos = selectedIds.indexOf(item.id);
                const selected = pos !== -1;
                return (
                  <Pressable
                    style={[
                      styles.activityRow,
                      { backgroundColor: selected ? colors.primary + '15' : colors.surface, borderColor: selected ? colors.primary : colors.border },
                    ]}
                    onPress={() => toggleActivity(item.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.activityTitle, { color: colors.onSurface }]}>{item.title}</ThemedText>
                      <ThemedText style={[styles.activityMeta, { color: colors.muted }]}>⏱ {item.estimated_duration_minutes} min</ThemedText>
                    </View>
                    {selected && (
                      <View style={[styles.positionBadge, { backgroundColor: colors.primary }]}>
                        <ThemedText style={styles.positionText}>{pos + 1}</ThemedText>
                      </View>
                    )}
                  </Pressable>
                );
              }}
            />
          )}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable style={[styles.nextButton, { backgroundColor: colors.primary }]} onPress={nextStep}>
              <ThemedText style={[styles.nextText, { color: colors.buttonText }]}>Next →</ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      {step === 3 && (
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText style={[styles.label, { color: colors.muted }]}>START DATE *</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            {...(Platform.OS === 'web' ? ({ type: 'date' } as any) : {})}
          />
          <ThemedText style={[styles.label, { color: colors.muted }]}>END DATE *</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            {...(Platform.OS === 'web' ? ({ type: 'date' } as any) : {})}
          />
          <Pressable style={[styles.nextButton, { backgroundColor: colors.primary }]} onPress={nextStep}>
            <ThemedText style={[styles.nextText, { color: colors.buttonText }]}>Next →</ThemedText>
          </Pressable>
        </ScrollView>
      )}

      {step === 4 && (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText style={[styles.label, { color: colors.muted }]}>WHO IS THIS CHALLENGE FOR?</ThemedText>

            <Pressable
              style={[
                styles.groupOption,
                { backgroundColor: selectedGroupId === null ? colors.primary + '15' : colors.surface, borderColor: selectedGroupId === null ? colors.primary : colors.border },
              ]}
              onPress={() => setSelectedGroupId(null)}
            >
              <ThemedText style={{ color: colors.onSurface, fontWeight: '600' }}>Personal (just my family)</ThemedText>
              <ThemedText style={{ color: colors.muted, fontSize: 13 }}>Only visible to your family</ThemedText>
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
                  <ThemedText style={{ color: colors.muted, fontSize: 13 }}>Group challenge — all families participate</ThemedText>
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
                <ThemedText style={[styles.nextText, { color: colors.buttonText }]}>Create challenge</ThemedText>
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
  hint: { fontSize: 13, paddingHorizontal: Spacing.screenHorizontal, paddingVertical: Spacing.sm },
  list: { padding: Spacing.md, gap: Spacing.sm },
  activityRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  activityTitle: { fontSize: 14, fontWeight: '500' },
  activityMeta: { fontSize: 12, marginTop: 2 },
  positionBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  positionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  groupOption: { borderRadius: 12, borderWidth: 1, padding: Spacing.md, gap: 4 },
  nextButton: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontSize: 16, fontWeight: '600' },
  footer: { padding: Spacing.screenHorizontal, borderTopWidth: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
