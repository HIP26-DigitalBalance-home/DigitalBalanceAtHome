import { router } from 'expo-router';
import { Formik } from 'formik';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Yup from 'yup';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { markOnboardingCompleted } from '@/hooks/use-onboarding-status';
import i18n from '@/lib/i18n';
import { onboardingApi, groupsApi } from '@/lib/api';
import { pendingInvite } from '@/lib/pending-invite';

const today = new Date().toISOString().split('T')[0];

const schema = Yup.object({
  nickname: Yup.string().required(i18n.t('childForm.nicknameRequired')),
  date_of_birth: Yup.string()
    .matches(/^\d{4}-\d{2}-\d{2}$/, i18n.t('childForm.dobFormat'))
    .test('not-future', i18n.t('childForm.dobFuture'), (v) => !v || v <= today)
    .required(i18n.t('childForm.dobRequired')),
  interests: Yup.string(),
});

export default function ChildScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();

  async function handleSubmit(
    values: { nickname: string; date_of_birth: string; interests: string },
    { setSubmitting, setStatus }: { setSubmitting: (b: boolean) => void; setStatus: (s: string) => void }
  ) {
    try {
      const interests = values.interests
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await onboardingApi.postChild({
        nickname: values.nickname.trim(),
        date_of_birth: values.date_of_birth,
        interests,
      });
      await markOnboardingCompleted();

      // Process any pending invite stored before sign-in
      const groupToken = await pendingInvite.getGroupToken();
      if (groupToken) {
        try {
          const res = await groupsApi.joinGroup(groupToken);
          await pendingInvite.clearGroupToken();
          router.replace(`/group/${res.data.id}` as any);
          return;
        } catch {
          await pendingInvite.clearGroupToken();
        }
      }

      const familyToken = await pendingInvite.getFamilyToken();
      if (familyToken) {
        try {
          await onboardingApi.postFamilyJoin(familyToken);
        } catch { /* best-effort */ }
        await pendingInvite.clearFamilyToken();
      }

      router.replace('/(tabs)');
    } catch {
      setStatus(i18n.t('childForm.saveFailed'));
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Formik
        initialValues={{ nickname: '', date_of_birth: '', interests: '' }}
        validationSchema={schema}
        onSubmit={handleSubmit}>
        {({ handleChange, handleBlur, handleSubmit: submit, values, errors, touched, isSubmitting, status }) => (
          <>
            <ScrollView contentContainerStyle={styles.content}>
              <ThemedText type="title">{t('childForm.title')}</ThemedText>
              <ThemedText style={{ color: colors.muted }}>
                {t('childForm.intro')}
              </ThemedText>

              <View style={styles.field}>
                <ThemedText style={styles.label}>{t('childForm.nickname')}</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: touched.nickname && errors.nickname ? colors.destructive : colors.border, color: colors.text, backgroundColor: colors.surface }]}
                  placeholder={t('childForm.nicknamePlaceholder')}
                  placeholderTextColor={colors.muted}
                  value={values.nickname}
                  onChangeText={handleChange('nickname')}
                  onBlur={handleBlur('nickname')}
                />
                {touched.nickname && errors.nickname && (
                  <ThemedText style={[styles.error, { color: colors.destructive }]}>{errors.nickname}</ThemedText>
                )}
              </View>

              <View style={styles.field}>
                <ThemedText style={styles.label}>{t('childForm.dob')}</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: touched.date_of_birth && errors.date_of_birth ? colors.destructive : colors.border, color: colors.text, backgroundColor: colors.surface }]}
                  placeholder="2019-03-15"
                  placeholderTextColor={colors.muted}
                  value={values.date_of_birth}
                  onChangeText={handleChange('date_of_birth')}
                  onBlur={handleBlur('date_of_birth')}
                  keyboardType="numbers-and-punctuation"
                />
                {touched.date_of_birth && errors.date_of_birth && (
                  <ThemedText style={[styles.error, { color: colors.destructive }]}>{errors.date_of_birth}</ThemedText>
                )}
              </View>

              <View style={styles.field}>
                <ThemedText style={styles.label}>{t('childForm.interests')}</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                  placeholder={t('childForm.interestsPlaceholder')}
                  placeholderTextColor={colors.muted}
                  value={values.interests}
                  onChangeText={handleChange('interests')}
                />
                <ThemedText style={[styles.hint, { color: colors.muted }]}>
                  {t('childForm.interestsHint')}
                </ThemedText>
              </View>

              {status && (
                <ThemedText style={{ color: colors.destructive, fontSize: 14 }}>{status}</ThemedText>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                style={[styles.button, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 }]}
                onPress={() => submit()}
                disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color={colors.buttonText} />
                ) : (
                  <ThemedText style={[styles.buttonText, { color: colors.buttonText }]}>
                    {t('childForm.submit')}
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </>
        )}
      </Formik>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.screenHorizontal, paddingTop: Spacing.xl, gap: Spacing.lg },
  field: { gap: Spacing.xs },
  label: { fontSize: 14, fontWeight: '500' },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  error: { fontSize: 12 },
  hint: { fontSize: 12, fontStyle: 'italic' },
  footer: { padding: Spacing.screenHorizontal, paddingBottom: Spacing.xl },
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
