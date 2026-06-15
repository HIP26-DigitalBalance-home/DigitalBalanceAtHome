import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/lib/app-theme-context';
import { useAuth } from '@/lib/auth';
import { usersApi } from '@/lib/api';

export default function EditProfileScreen() {
  const { colors, radii } = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser, updateCurrentUser } = useAuth();

  const [displayName, setDisplayName] = useState(currentUser?.display_name ?? '');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setMimeType(result.assets[0].mimeType ?? 'image/jpeg');
    }
  }

  async function handleSave() {
    const name = displayName.trim();
    if (!name && !imageUri) {
      setError(t('editProfile.nameOrPhotoRequired'));
      return;
    }
    if (name.length === 0 && currentUser?.display_name) {
      setError(t('editProfile.nameEmpty'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await usersApi.updateMe(
        name !== currentUser?.display_name ? name : undefined,
        imageUri ?? undefined,
        mimeType,
      );
      await updateCurrentUser(res.data);
      router.back();
    } catch {
      setError(t('editProfile.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const avatarUri = imageUri ?? currentUser?.profile_photo_url ?? null;
  const initials = currentUser?.display_name
    ? currentUser.display_name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={{ color: colors.primary, fontSize: 16 }}>← {t('common.back')}</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.title}>{t('editProfile.title')}</ThemedText>
      </View>

      <View style={styles.content}>
        {/* Avatar picker */}
        <Pressable style={styles.avatarContainer} onPress={handlePickImage}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} accessibilityLabel="Profile photo" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
              <ThemedText style={styles.avatarInitials}>{initials}</ThemedText>
            </View>
          )}
          <ThemedText style={[styles.changePhoto, { color: colors.primary }]}>{t('editProfile.changePhoto')}</ThemedText>
        </Pressable>

        {/* Display name */}
        <ThemedText style={[styles.label, { color: colors.muted }]}>{t('editProfile.displayName')}</ThemedText>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('editProfile.displayNamePlaceholder')}
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          maxLength={60}
        />

        {error && (
          <ThemedText style={[styles.errorText, { color: colors.destructive }]}>{error}</ThemedText>
        )}

        <Pressable
          style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
          onPress={handleSave}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.saveButtonText}>{t('common.save')}</ThemedText>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.screenHorizontal,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: { marginBottom: Spacing.xs },
  title: { fontSize: 24 },
  content: { padding: Spacing.screenHorizontal, gap: Spacing.md },
  avatarContainer: { alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.md },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontSize: 32, fontWeight: '700' },
  changePhoto: { fontSize: 15, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  errorText: { fontSize: 14 },
  saveButton: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
