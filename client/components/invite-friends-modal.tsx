import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AnimatedModal } from '@/components/ui/animated-modal';
import { Spacing } from '@/constants/theme';
import { DEFAULT_RADII } from '@/constants/themes';
import { useAppTheme } from '@/lib/app-theme-context';
import { challengesApi, friendsApi, type Friend } from '@/lib/api';
import { getGermanErrorMessage } from '@/lib/utils/api-error';
import { showAlert } from '@/lib/utils/alert';

interface Props {
  visible: boolean;
  /** When set, inviting posts to the API immediately (existing challenge). */
  challengeId?: string;
  /** Selection mode (challenge not created yet): toggle friends locally instead of posting. */
  selectedIds?: string[];
  onToggleSelect?: (friend: Friend) => void;
  onClose: () => void;
  /** Called after a friend was successfully invited (challengeId mode only). */
  onInvited?: (displayName: string) => void;
}

function initialsOf(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export function InviteFriendsModal({ visible, challengeId, selectedIds, onToggleSelect, onClose, onInvited }: Props) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const selectionMode = challengeId == null;
  const [friends, setFriends] = useState<Friend[]>([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    setQuery('');
    Promise.all([
      friendsApi.list(),
      challengeId ? challengesApi.getParticipants(challengeId) : Promise.resolve(null),
    ])
      .then(([friendsRes, participantsRes]) => {
        if (cancelled) return;
        setFriends(friendsRes.data);
        if (participantsRes) setInvitedIds(new Set(participantsRes.data.map((p) => p.user_id)));
      })
      .catch((e) => { if (!cancelled) showAlert(t('common.error'), getGermanErrorMessage(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, challengeId, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.display_name.toLowerCase().includes(q));
  }, [friends, query]);

  function handleInvite(friend: Friend) {
    if (selectionMode) {
      onToggleSelect?.(friend);
      return;
    }
    setInvitingId(friend.user_id);
    challengesApi
      .inviteParticipant(challengeId!, friend.user_id)
      .then(() => {
        setInvitedIds((prev) => new Set(prev).add(friend.user_id));
        onInvited?.(friend.display_name);
      })
      .catch((e) => {
        showAlert(t('common.error'), getGermanErrorMessage(e));
      })
      .finally(() => setInvitingId(null));
  }

  return (
    <AnimatedModal
      visible={visible}
      variant="dialog"
      onRequestClose={onClose}
      onBackdropPress={onClose}
      contentContainerStyle={styles.container}
    >
      <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.titleRow}>
            <ThemedText style={[styles.title, { color: colors.onSurface }]}>{t('inviteFriends.title')}</ThemedText>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={t('common.cancel')}>
              <ThemedText style={{ color: colors.muted, fontSize: 20 }}>✕</ThemedText>
            </Pressable>
          </View>
          <ThemedText style={[styles.subtitle, { color: colors.muted }]}>{t('inviteFriends.subtitle')}</ThemedText>

          <TextInput
            style={[styles.searchInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
            placeholder={t('inviteFriends.searchPlaceholder')}
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.lg }} />
          ) : friends.length === 0 ? (
            <ThemedText style={[styles.emptyText, { color: colors.muted }]}>{t('inviteFriends.empty')}</ThemedText>
          ) : filtered.length === 0 ? (
            <ThemedText style={[styles.emptyText, { color: colors.muted }]}>{t('inviteFriends.noResults')}</ThemedText>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(f) => f.user_id}
              style={styles.list}
              renderItem={({ item }) => {
                const invited = selectionMode
                  ? (selectedIds ?? []).includes(item.user_id)
                  : invitedIds.has(item.user_id);
                return (
                  <View style={[styles.friendRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
                      <ThemedText style={[styles.avatarText, { color: colors.primary }]}>
                        {initialsOf(item.display_name)}
                      </ThemedText>
                    </View>
                    <View style={styles.friendInfo}>
                      <ThemedText style={styles.friendName} numberOfLines={1}>{item.display_name}</ThemedText>
                      <ThemedText style={[styles.friendGroups, { color: colors.muted }]} numberOfLines={1}>
                        {item.shared_group_names.join(' · ')}
                      </ThemedText>
                    </View>
                    {invited ? (
                      // In selection mode the label stays tappable so the choice can be undone
                      <Pressable onPress={() => handleInvite(item)} disabled={!selectionMode}>
                        <ThemedText style={[styles.invitedLabel, { color: colors.accent }]}>
                          ✓ {t('inviteFriends.invited')}
                        </ThemedText>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={[styles.inviteButton, { backgroundColor: colors.primary, opacity: invitingId ? 0.6 : 1 }]}
                        onPress={() => handleInvite(item)}
                        disabled={invitingId !== null}
                      >
                        {invitingId === item.user_id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <ThemedText style={styles.inviteButtonText}>{t('inviteFriends.invite')}</ThemedText>
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              }}
            />
          )}
      </View>
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
  // Backdrop dim + press handling live in AnimatedModal; this only positions
  // the dialog card.
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.screenHorizontal,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13 },
  searchInput: {
    height: 44,
    borderWidth: 1.5,
    borderRadius: DEFAULT_RADII.input,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
  },
  list: { flexGrow: 0 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: Spacing.lg },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700' },
  friendInfo: { flex: 1, gap: 1 },
  friendName: { fontSize: 15, fontWeight: '600' },
  friendGroups: { fontSize: 12 },
  invitedLabel: { fontSize: 13, fontWeight: '600' },
  inviteButton: {
    height: 34,
    paddingHorizontal: Spacing.md,
    borderRadius: DEFAULT_RADII.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
