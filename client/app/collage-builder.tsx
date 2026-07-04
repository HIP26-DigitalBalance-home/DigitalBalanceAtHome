import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityPickerModal } from '@/components/activity-picker-modal';
import { InviteFriendsModal } from '@/components/invite-friends-modal';
import { ErrorState } from '@/components/ui/error-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import {
  activitiesApi,
  challengesApi,
  groupsApi,
  type ActivityItem,
  type CollagePreset,
  type Friend,
} from '@/lib/api';
import { pendingActivity } from '@/lib/pending-activity';
import { getGermanErrorMessage } from '@/lib/utils/api-error';
import { showAlert } from '@/lib/utils/alert';

const SLOT_COUNT = 9;
const NUM_COLUMNS = 3;

type Slot = ActivityItem | null;

interface GroupSummary {
  id: string;
  name: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function CollageBuilderScreen() {
  const { colors, radii } = useAppTheme();
  const { t, i18n } = useTranslation();
  const { mode, preset: presetParam } = useLocalSearchParams<{ mode: string; preset?: string }>();

  // Only the custom collage lets the user pick/change activities per slot. Preset
  // and random collages arrive with all nine activities predefined and locked.
  const editable = mode === 'custom';
  // Preset titles are fixed (the preset's own name); custom and random collages
  // let the parent rename the collage via the pencil icon.
  const titleEditable = mode !== 'preset';

  const defaultTitle =
    mode === 'custom'
      ? t('explore.customName')
      : mode === 'random'
        ? t('explore.randomName')
        : presetParam
          ? (JSON.parse(presetParam) as CollagePreset).name
          : t('builder.title');

  const [title, setTitle] = useState(defaultTitle);
  const [editingTitle, setEditingTitle] = useState(false);

  const [slots, setSlots] = useState<Slot[]>(() => Array(SLOT_COUNT).fill(null));
  const [loading, setLoading] = useState(mode !== 'custom');
  const [error, setError] = useState<string | null>(null);
  // editingSlot persists across navigation to create-activity; pickerOpen only
  // controls the modal (closed before navigating away to avoid an overlay).
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Friends invited on creation, privacy, and group feed sharing
  const [inviteVisible, setInviteVisible] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [isPrivate, setIsPrivate] = useState(true);
  const [myGroups, setMyGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width - Spacing.screenHorizontal * 2
  );
  const slotSize = (containerWidth - Spacing.xs * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const resolveSlots = useCallback(async () => {
    setError(null);
    if (mode === 'custom') {
      setSlots(Array(SLOT_COUNT).fill(null));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await activitiesApi.list({});
      const all = res.data;
      if (mode === 'random') {
        setSlots(shuffle(all).slice(0, SLOT_COUNT));
      } else if (mode === 'preset' && presetParam) {
        const preset: CollagePreset = JSON.parse(presetParam);
        const byId = new Map(all.map((a) => [a.id, a]));
        const resolved = preset.activity_ids.slice(0, SLOT_COUNT).map((id) => byId.get(id) ?? null);
        // Preset slots are locked, so a partially-resolved preset is a dead end:
        // the user can neither fill the gaps nor create. Surface an error instead.
        if (resolved.length < SLOT_COUNT || resolved.some((s) => s === null)) {
          setError(t('builder.presetUnavailable'));
          return;
        }
        setSlots(resolved);
      }
    } catch (e) {
      setError(getGermanErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [mode, presetParam, i18n.language]);

  useEffect(() => {
    resolveSlots();
  }, [resolveSlots]);

  useEffect(() => {
    let cancelled = false;
    groupsApi.getMyGroups()
      .then((r) => { if (!cancelled) setMyGroups(r.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Returning from the create-activity screen: fill the slot the user was editing.
  useFocusEffect(
    useCallback(() => {
      const created = pendingActivity.consume();
      if (created && editingSlot !== null) {
        setSlots((prev) => prev.map((s, i) => (i === editingSlot ? created : s)));
        setEditingSlot(null);
      }
    }, [editingSlot])
  );

  function openPicker(index: number) {
    if (!editable) return;
    setEditingSlot(index);
    setPickerOpen(true);
  }

  function handleSelect(activity: ActivityItem) {
    if (editingSlot === null) return;
    setSlots((prev) => prev.map((s, i) => (i === editingSlot ? activity : s)));
    setPickerOpen(false);
    setEditingSlot(null);
  }

  function handleClosePicker() {
    setPickerOpen(false);
    setEditingSlot(null);
  }

  // Close the modal (so it doesn't overlay the pushed screen), keep editingSlot.
  function handleCreateNew() {
    setPickerOpen(false);
    router.push('/create-activity' as any);
  }

  function toggleFriend(friend: Friend) {
    setSelectedFriends((prev) =>
      prev.some((f) => f.user_id === friend.user_id)
        ? prev.filter((f) => f.user_id !== friend.user_id)
        : [...prev, friend]
    );
  }

  function toggleGroup(groupId: string) {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  }

  const filledCount = slots.filter((s) => s !== null).length;
  const allFilled = filledCount === SLOT_COUNT;

  async function handleCreate() {
    if (!allFilled || submitting) return;
    setSubmitting(true);
    try {
      const res = await challengesApi.create({
        title: title.trim() || defaultTitle,
        activity_ids: slots.map((s) => s!.id),
        is_private: isPrivate,
        shared_group_ids: isPrivate ? [] : selectedGroupIds,
      });
      // Invite the selected friends — failures shouldn't block the created challenge
      await Promise.all(
        selectedFriends.map((f) =>
          challengesApi.inviteParticipant(res.data.id, f.user_id).catch(() => {})
        )
      );
      router.replace({ pathname: '/challenges', params: { created: '1' } } as any);
    } catch (e) {
      showAlert(t('common.error'), getGermanErrorMessage(e));
      setSubmitting(false);
    }
  }

  function renderSlot({ item, index }: { item: Slot; index: number }) {
    const filled = item !== null;
    return (
      <Pressable
        onPress={() => openPicker(index)}
        disabled={!editable}
        accessibilityRole={editable ? 'button' : 'text'}
        accessibilityLabel={
          editable
            ? filled
              ? t('builder.slotChange', { title: item!.title })
              : t('builder.slotEmpty')
            : item?.title
        }
        style={[
          styles.slot,
          {
            width: slotSize,
            height: slotSize,
            backgroundColor: colors.surface,
            borderColor: filled ? colors.primary : 'rgb(200, 195, 190)',
            borderWidth: filled ? 1.5 : 1,
          },
        ]}
      >
        {filled ? (
          <ThemedText
            style={[styles.slotTitle, { color: colors.onSurface }]}
            numberOfLines={3}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {item!.title}
          </ThemedText>
        ) : (
          <ThemedText style={[styles.plus, { color: colors.muted }]}>＋</ThemedText>
        )}
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <ThemedText style={{ color: colors.primary }}>← {t('common.back')}</ThemedText>
        </Pressable>
        {editingTitle ? (
          <TextInput
            style={[styles.headerTitleInput, { color: colors.onSurface, borderBottomColor: colors.primary }]}
            value={title}
            onChangeText={setTitle}
            onBlur={() => setEditingTitle(false)}
            onSubmitEditing={() => setEditingTitle(false)}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            maxLength={60}
            accessibilityLabel={t('builder.titleLabel')}
          />
        ) : (
          <View style={styles.headerTitleRow}>
            <ThemedText style={styles.headerTitle} numberOfLines={1}>{title}</ThemedText>
            {titleEditable && (
              <Pressable
                onPress={() => setEditingTitle(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('builder.editTitle')}
              >
                <IconSymbol name="pencil" size={14} color={colors.primary} />
              </Pressable>
            )}
          </View>
        )}
        <ThemedText style={[styles.counter, { color: colors.muted }]}>{filledCount}/{SLOT_COUNT}</ThemedText>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.center}><ErrorState message={error} onRetry={resolveSlots} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText style={[styles.hint, { color: colors.muted }]}>
            {editable ? t('builder.hint') : t('builder.hintLocked')}
          </ThemedText>
          <View style={styles.gridOuter}>
            <View onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}>
              <FlatList
                data={slots}
                numColumns={NUM_COLUMNS}
                scrollEnabled={false}
                keyExtractor={(_, i) => String(i)}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.grid}
                renderItem={renderSlot}
              />
            </View>
          </View>

          {/* Invite friends + collage privacy */}
          <View style={styles.socialRow}>
            <Pressable
              style={[styles.inviteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setInviteVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('challengeDetail.addFriends')}
            >
              <IconSymbol name="person.badge.plus" color={colors.primary} size={26} />
              <ThemedText style={[styles.inviteCardText, { color: colors.primary }]}>
                {t('challengeDetail.addFriends')}
              </ThemedText>
            </Pressable>

            <View style={[styles.privacyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.privacyHeader}>
                <ThemedText style={[styles.privacyTitle, { color: colors.onSurface }]}>
                  {t('challengeDetail.privateTitle')}
                </ThemedText>
                <Switch
                  value={isPrivate}
                  onValueChange={setIsPrivate}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
              <ThemedText style={[styles.privacyDesc, { color: colors.muted }]}>
                {isPrivate ? t('challengeDetail.privateDesc') : t('challengeDetail.publicDesc')}
              </ThemedText>
            </View>
          </View>

          {selectedFriends.length > 0 && (
            <ThemedText style={[styles.participantsText, { color: colors.muted }]}>
              {t('challengeDetail.togetherWith', { names: selectedFriends.map((f) => f.display_name).join(', ') })}
            </ThemedText>
          )}

          {/* When public: pick which group feeds receive the photos */}
          {!isPrivate && (
            <View style={[styles.groupsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.groupsLabel, { color: colors.muted }]}>
                {t('builder.shareToGroups')}
              </ThemedText>
              {myGroups.length === 0 ? (
                <ThemedText style={{ color: colors.muted, fontSize: 13 }}>{t('builder.noGroups')}</ThemedText>
              ) : (
                myGroups.map((g) => {
                  const selected = selectedGroupIds.includes(g.id);
                  return (
                    <Pressable
                      key={g.id}
                      style={[
                        styles.groupOption,
                        {
                          backgroundColor: selected ? colors.primary + '15' : 'transparent',
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => toggleGroup(g.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                    >
                      <ThemedText style={{ color: colors.onSurface, fontWeight: '600', flex: 1 }}>
                        {g.name}
                      </ThemedText>
                      {selected && <ThemedText style={{ color: colors.primary }}>✓</ThemedText>}
                    </Pressable>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Pressable
          style={[styles.continueButton, { backgroundColor: allFilled && !submitting ? colors.primary : colors.muted }]}
          onPress={handleCreate}
          disabled={!allFilled || submitting}
          accessibilityRole="button"
        >
          {submitting ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <ThemedText style={[styles.continueText, { color: colors.buttonText }]}>{t('builder.create')}</ThemedText>
          )}
        </Pressable>
      </View>

      {editable && (
        <ActivityPickerModal
          visible={pickerOpen}
          selectedId={editingSlot !== null ? (slots[editingSlot]?.id ?? undefined) : undefined}
          onSelect={handleSelect}
          onClose={handleClosePicker}
          onCreateNew={handleCreateNew}
        />
      )}

      <InviteFriendsModal
        visible={inviteVisible}
        selectedIds={selectedFriends.map((f) => f.user_id)}
        onToggleSelect={toggleFriend}
        onClose={() => setInviteVisible(false)}
      />
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
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1, justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  headerTitleInput: { flex: 1, fontSize: 16, fontWeight: '600', textAlign: 'center', borderBottomWidth: 1, paddingVertical: 2 },
  counter: { fontSize: 13 },
  scrollContent: { paddingBottom: Spacing.lg },
  hint: { fontSize: 13, paddingHorizontal: Spacing.screenHorizontal, paddingVertical: Spacing.sm },
  gridOuter: { paddingHorizontal: Spacing.screenHorizontal },
  grid: { gap: Spacing.xs },
  row: { gap: Spacing.xs },
  slot: {
    borderRadius: DEFAULT_RADII.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
  },
  slotTitle: { fontSize: 12, textAlign: 'center', lineHeight: 16 },
  plus: { fontSize: 28, fontWeight: '300' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'stretch',
    paddingHorizontal: Spacing.screenHorizontal,
    marginTop: Spacing.md,
  },
  inviteCard: {
    flex: 1,
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  inviteCardText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  privacyCard: {
    flex: 1.6,
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  privacyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  privacyTitle: { fontSize: 16, fontWeight: '700' },
  privacyDesc: { fontSize: 12, lineHeight: 16 },
  participantsText: { fontSize: 13, paddingHorizontal: Spacing.screenHorizontal, marginTop: Spacing.sm },
  groupsBox: {
    marginHorizontal: Spacing.screenHorizontal,
    marginTop: Spacing.md,
    borderRadius: DEFAULT_RADII.card,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  groupsLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  groupOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: DEFAULT_RADII.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  footer: { padding: Spacing.screenHorizontal, borderTopWidth: 1 },
  continueButton: { height: 50, borderRadius: DEFAULT_RADII.button, alignItems: 'center', justifyContent: 'center' },
  continueText: { fontSize: 16, fontWeight: '600' },
});
