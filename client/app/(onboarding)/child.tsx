import { router } from 'expo-router';
import { Formik } from 'formik';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Yup from 'yup';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { markOnboardingCompleted } from '@/hooks/use-onboarding-status';
import { onboardingApi } from '@/lib/api';

const today = new Date().toISOString().split('T')[0];

const schema = Yup.object({
  nickname: Yup.string().required('Nickname is required'),
  date_of_birth: Yup.string()
    .matches(/^\d{4}-\d{2}-\d{2}$/, 'Use format YYYY-MM-DD')
    .test('not-future', 'Date cannot be in the future', (v) => !v || v <= today)
    .required('Date of birth is required'),
  interests: Yup.string(),
});

export default function ChildScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];

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
      router.replace('/(tabs)');
    } catch {
      setStatus('Failed to save. Please try again.');
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
              <ThemedText type="title">Add your child</ThemedText>
              <ThemedText style={{ color: colors.muted }}>
                You can add more children later from your profile.
              </ThemedText>

              <View style={styles.field}>
                <ThemedText style={styles.label}>Nickname *</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: touched.nickname && errors.nickname ? colors.destructive : colors.border, color: colors.text, backgroundColor: colors.surface }]}
                  placeholder="e.g. Lena"
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
                <ThemedText style={styles.label}>Date of birth * (YYYY-MM-DD)</ThemedText>
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
                <ThemedText style={styles.label}>Interests (optional, comma-separated)</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                  placeholder="e.g. drawing, music, football"
                  placeholderTextColor={colors.muted}
                  value={values.interests}
                  onChangeText={handleChange('interests')}
                />
                <ThemedText style={[styles.hint, { color: colors.muted }]}>
                  Please do not enter medical conditions or sensitive health information here.
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
                    Add child and continue
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
