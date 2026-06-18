import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ThemeColors } from '@/constants/themes';

export default function PrivacyEn({ colors }: { colors: ThemeColors }) {
  return (
    <>
      <ThemedText style={[styles.section, { color: colors.muted }]}>
        This app is a research prototype and not intended for production use.
      </ThemedText>
      <ThemedText style={[styles.section, { color: colors.muted }]}>Last updated: June 2026 · Version 1.0</ThemedText>

      <ThemedText style={styles.heading}>Data Controller</ThemedText>
      <ThemedText style={styles.body}>
        DigitalBalance @home — Student project team, TUM Healthcare Innovation Program (Challenge #6, SoSe 2026){'\n'}
        Contact: digital-health-at-home@proton.me
      </ThemedText>

      <ThemedText style={styles.heading}>Data We Process</ThemedText>

      <ThemedText style={styles.tableHeading}>Account</ThemedText>
      <ThemedText style={styles.body}>
        Name, email, Google ID — Purpose: authentication
      </ThemedText>

      <ThemedText style={styles.tableHeading}>Child profiles</ThemedText>
      <ThemedText style={styles.body}>
        First name, date of birth — Purpose: age-appropriate activity suggestions
      </ThemedText>

      <ThemedText style={styles.tableHeading}>Activities & completions</ThemedText>
      <ThemedText style={styles.body}>
        Activity ID, date, status — Purpose: challenge progress tracking
      </ThemedText>

      <ThemedText style={styles.tableHeading}>Photos</ThemedText>
      <ThemedText style={styles.body}>
        Compressed image — Purpose: photo collage; compressed client-side before upload
      </ThemedText>

      <ThemedText style={styles.tableHeading}>Consent log</ThemedText>
      <ThemedText style={styles.body}>
        Type, timestamp, policy version — Purpose: proof of consent under GDPR Art. 7
      </ThemedText>

      <ThemedText style={styles.tableHeading}>Location (optional)</ThemedText>
      <ThemedText style={styles.body}>
        City-level only — Purpose: weather-based activity suggestions
      </ThemedText>

      <ThemedText style={styles.tableHeading}>Session tokens</ThemedText>
      <ThemedText style={styles.body}>
        Access token (15 min), refresh token (7 days) — Purpose: authentication
      </ThemedText>

      <ThemedText style={styles.heading}>Legal Basis</ThemedText>
      <ThemedText style={styles.body}>
        <ThemedText style={styles.bold}>Contract performance (Art. 6(1)(b) GDPR)</ThemedText>
        {' '}— account management, challenge participation{'\n\n'}
        <ThemedText style={styles.bold}>Legal obligation (Art. 6(1)(c) GDPR)</ThemedText>
        {' '}— consent record-keeping{'\n\n'}
        <ThemedText style={styles.bold}>Consent (Art. 6(1)(a) GDPR)</ThemedText>
        {' '}— photo processing, optional location
      </ThemedText>

      <ThemedText style={styles.heading}>Processors</ThemedText>
      <ThemedText style={styles.body}>
        <ThemedText style={styles.bold}>Hetzner Online GmbH</ThemedText>
        {' '}(Gunzenhausen, Germany) — server hosting and object storage (S3-compatible,
        EU-hosted). Privacy policy: hetzner.com/legal/privacy-policy{'\n\n'}
        No third-party analytics, no ad networks, no social media SDKs.
      </ThemedText>

      <ThemedText style={styles.heading}>Retention</ThemedText>
      <ThemedText style={styles.body}>
        {'• '}Account data: until deletion request + 30-day wind-down period{'\n'}
        {'• '}Photos: deleted with the completion (immediately on request){'\n'}
        {'• '}Consent log: 3 years from date (statutory record-keeping obligation){'\n'}
        {'• '}Session tokens: auto-expire (15 min / 7 days); invalidated on logout
      </ThemedText>

      <ThemedText style={styles.heading}>Photo Transfer and Storage</ThemedText>
      <ThemedText style={styles.body}>
        Photos are compressed client-side before upload and transmitted encrypted over HTTPS.
        They are stored in Hetzner Object Storage (Frankfurt, Germany) and accessed exclusively
        via time-limited pre-signed URLs (15-minute expiry). Photos are not publicly indexed.
      </ThemedText>

      <ThemedText style={styles.heading}>No Third-Country Transfers</ThemedText>
      <ThemedText style={styles.body}>
        All data is processed and stored exclusively on EU servers (Germany). No transfers to
        third countries take place.
      </ThemedText>

      <ThemedText style={styles.heading}>Your Rights</ThemedText>
      <ThemedText style={styles.body}>
        Under GDPR you have the following rights, exercisable directly in the app
        (Settings → Privacy):{'\n\n'}
        <ThemedText style={styles.bold}>Access (Art. 15):</ThemedText>
        {' '}data export as JSON{'\n'}
        <ThemedText style={styles.bold}>Rectification (Art. 16):</ThemedText>
        {' '}edit your profile{'\n'}
        <ThemedText style={styles.bold}>Erasure (Art. 17):</ThemedText>
        {' '}delete account (30-day wind-down){'\n'}
        <ThemedText style={styles.bold}>Objection (Art. 21):</ThemedText>
        {' '}withdraw location consent{'\n'}
        <ThemedText style={styles.bold}>Portability (Art. 20):</ThemedText>
        {' '}data export as machine-readable JSON{'\n\n'}
        For requests not handled in-app or to file a complaint:{'\n'}
        digital-health-at-home@proton.me{'\n\n'}
        Complaints may also be submitted to the competent supervisory authority
        (Bayerisches Landesamt für Datenschutzaufsicht, BayLDA).
      </ThemedText>

      <ThemedText style={styles.heading}>Local Storage</ThemedText>
      <ThemedText style={styles.body}>
        The app stores only the following data locally on your device:{'\n\n'}
        {'• '}Authentication tokens (encrypted in device keychain / SecureStore){'\n'}
        {'• '}Settings and preferences (AsyncStorage / localStorage){'\n'}
        {'• '}Cached images (OS temporary cache only){'\n\n'}
        We do not use advertising cookies, fingerprinting, or cross-site tracking.
      </ThemedText>

      <ThemedText style={styles.heading}>Changes to This Policy</ThemedText>
      <ThemedText style={styles.body}>
        For material changes, users will be notified in the app and asked to consent again.
        The version identifier is stored in the consent log.
      </ThemedText>
    </>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 12, marginBottom: Spacing.lg },
  heading: { fontSize: 16, fontWeight: '700', marginTop: Spacing.lg, marginBottom: Spacing.sm },
  tableHeading: { fontSize: 14, fontWeight: '600', marginTop: 10, marginBottom: 2 },
  body: { fontSize: 14, lineHeight: 21 },
  bold: { fontWeight: '700' },
});
