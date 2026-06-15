import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ThemeColors } from '@/constants/themes';

export default function PrivacyDe({ colors }: { colors: ThemeColors }) {
  return (
    <>
      <ThemedText style={[styles.section, { color: colors.muted }]}>Stand: Juni 2026 · Version 1.0</ThemedText>

      <ThemedText style={styles.heading}>Verantwortliche Stelle</ThemedText>
      <ThemedText style={styles.body}>
        Stiftung Kindergesundheit / TUM Healthcare Innovation Program{'\n'}
        Kontakt: digital-health-at-home@proton.me
      </ThemedText>

      <ThemedText style={styles.heading}>Welche Daten wir verarbeiten</ThemedText>

      <ThemedText style={styles.tableHeading}>Konto</ThemedText>
      <ThemedText style={styles.body}>
        Name, E-Mail, Google-ID — Zweck: Authentifizierung
      </ThemedText>

      <ThemedText style={styles.tableHeading}>Kinderprofile</ThemedText>
      <ThemedText style={styles.body}>
        Vorname, Geburtsdatum — Zweck: Altersgerechte Aktivitätsvorschläge
      </ThemedText>

      <ThemedText style={styles.tableHeading}>Aktivitäten & Abschlüsse</ThemedText>
      <ThemedText style={styles.body}>
        Aktivitäts-ID, Datum, Status — Zweck: Challenge-Fortschritt
      </ThemedText>

      <ThemedText style={styles.tableHeading}>Fotos</ThemedText>
      <ThemedText style={styles.body}>
        Komprimiertes Bild — Zweck: Foto-Collage; vor dem Upload clientseitig komprimiert
      </ThemedText>

      <ThemedText style={styles.tableHeading}>Einwilligungsprotokoll</ThemedText>
      <ThemedText style={styles.body}>
        Typ, Zeitstempel, Richtlinienversion — Zweck: Nachweispflicht gemäß DSGVO Art. 7
      </ThemedText>

      <ThemedText style={styles.tableHeading}>Standort (optional)</ThemedText>
      <ThemedText style={styles.body}>
        Stadt-Ebene — Zweck: Wetterbasierte Aktivitätsvorschläge
      </ThemedText>

      <ThemedText style={styles.tableHeading}>Sitzungstoken</ThemedText>
      <ThemedText style={styles.body}>
        Zugriffstoken (15 min), Refresh-Token (7 Tage) — Zweck: Authentifizierung
      </ThemedText>

      <ThemedText style={styles.heading}>Rechtsgrundlage</ThemedText>
      <ThemedText style={styles.body}>
        <ThemedText style={styles.bold}>Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)</ThemedText>
        {' '}— Kontoverwaltung, Challenge-Teilnahme{'\n\n'}
        <ThemedText style={styles.bold}>Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO)</ThemedText>
        {' '}— Einwilligungsnachweis{'\n\n'}
        <ThemedText style={styles.bold}>Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)</ThemedText>
        {' '}— Fotobearbeitung, optionaler Standort
      </ThemedText>

      <ThemedText style={styles.heading}>Auftragsverarbeiter</ThemedText>
      <ThemedText style={styles.body}>
        <ThemedText style={styles.bold}>Hetzner Online GmbH</ThemedText>
        {' '}(Gunzenhausen, Deutschland) — Server-Hosting und Objektspeicher (S3-kompatibel,
        EU-gehostet). Datenschutzerklärung: hetzner.com/legal/privacy-policy{'\n\n'}
        Kein Drittanbieter-Analytics, kein Werbenetzwerk, keine Social-Media-SDKs.
      </ThemedText>

      <ThemedText style={styles.heading}>Speicherdauer</ThemedText>
      <ThemedText style={styles.body}>
        {'• '}Kontodaten: bis zur Löschanfrage + 30 Tage Nachlauffrist{'\n'}
        {'• '}Fotos: werden zusammen mit dem Abschluss gelöscht (sofort bei Anfrage){'\n'}
        {'• '}Einwilligungsprotokoll: 3 Jahre ab Datum (gesetzliche Nachweispflicht){'\n'}
        {'• '}Sitzungstoken: automatischer Ablauf (15 min / 7 Tage); ungültig nach Abmeldung
      </ThemedText>

      <ThemedText style={styles.heading}>Fotoübertragung und -speicherung</ThemedText>
      <ThemedText style={styles.body}>
        Fotos werden vor dem Upload clientseitig komprimiert und verschlüsselt über HTTPS an
        den Server übertragen. Sie werden im Hetzner Object Storage (Frankfurt, Deutschland)
        gespeichert. Der Zugriff erfolgt ausschließlich über zeitlich begrenzte Pre-signed URLs
        (15-Minuten-Ablauf). Fotos werden nicht öffentlich indexiert.
      </ThemedText>

      <ThemedText style={styles.heading}>Keine Datenübermittlung in Drittländer</ThemedText>
      <ThemedText style={styles.body}>
        Alle Daten werden ausschließlich auf EU-Servern (Deutschland) verarbeitet und
        gespeichert. Es findet keine Übermittlung in Drittländer statt.
      </ThemedText>

      <ThemedText style={styles.heading}>Deine Rechte</ThemedText>
      <ThemedText style={styles.body}>
        Gemäß DSGVO hast du folgende Rechte, die du direkt in der App ausüben kannst
        (Einstellungen → Datenschutz):{'\n\n'}
        <ThemedText style={styles.bold}>Auskunft (Art. 15):</ThemedText>
        {' '}Datenexport als JSON{'\n'}
        <ThemedText style={styles.bold}>Berichtigung (Art. 16):</ThemedText>
        {' '}Profil bearbeiten{'\n'}
        <ThemedText style={styles.bold}>Löschung (Art. 17):</ThemedText>
        {' '}Account löschen (30 Tage Nachlauffrist){'\n'}
        <ThemedText style={styles.bold}>Widerspruch (Art. 21):</ThemedText>
        {' '}Einwilligung für Standort widerrufen{'\n'}
        <ThemedText style={styles.bold}>Datenübertragbarkeit (Art. 20):</ThemedText>
        {' '}Datenexport als maschinenlesbares JSON{'\n\n'}
        Für nicht in der App abbildbare Anfragen oder Beschwerden:{'\n'}
        digital-health-at-home@proton.me{'\n\n'}
        Beschwerden können auch bei der zuständigen Datenschutzbehörde eingereicht werden
        (Bayerisches Landesamt für Datenschutzaufsicht, BayLDA).
      </ThemedText>

      <ThemedText style={styles.heading}>Lokale Datenspeicherung</ThemedText>
      <ThemedText style={styles.body}>
        Die App speichert ausschließlich folgende Daten lokal auf deinem Gerät:{'\n\n'}
        {'• '}Authentifizierungstoken (verschlüsselt im Gerätekeychain / SecureStore){'\n'}
        {'• '}Einstellungen und Präferenzen (AsyncStorage / localStorage){'\n'}
        {'• '}Zwischengespeicherte Bilder (nur im temporären Cache des Betriebssystems){'\n\n'}
        Wir verwenden keine Werbe-Cookies, kein Fingerprinting und keine
        Cross-Site-Tracking-Mechanismen.
      </ThemedText>

      <ThemedText style={styles.heading}>Änderungen dieser Datenschutzerklärung</ThemedText>
      <ThemedText style={styles.body}>
        Bei wesentlichen Änderungen werden Nutzer in der App benachrichtigt und müssen erneut
        einwilligen. Die Versionskennung wird im Einwilligungsprotokoll gespeichert.
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
