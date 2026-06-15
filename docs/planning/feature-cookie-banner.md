# Feature Plan: Cookie Banner & Privacy Policy

## Goal

Show a dismissable data-use notice to first-time users with a link to a complete, technically accurate privacy policy. The banner remembers its dismissed state. The privacy policy covers all GDPR obligations applicable to the app.

---

## Context

This is a React Native / Expo app with a web target (`app/+html.tsx`). It does **not** use HTTP cookies or third-party analytics SDKs. "Cookies" in the GDPR sense applies here as **local storage** (AsyncStorage on mobile; `localStorage` on web) and **API session tokens**. The banner must be technically accurate about this.

A `app/privacy.tsx` screen already exists — it is the GDPR **self-service** screen (data export, consent toggles, account deletion). This feature adds a separate **privacy policy document** screen (`app/privacy-policy.tsx`) and the banner that surfaces it.

---

## What Changes

### 1. CookieBanner Component

**New file:** `client/components/ui/cookie-banner.tsx`

**Behaviour:**
- Reads `@dba_cookie_dismissed` from AsyncStorage on mount
- If already set, renders nothing
- If not set, renders the banner
- "Datenschutzerklärung" (Privacy Policy) link → navigate to `app/privacy-policy` (use `router.push`)
- "Verstanden" (Got it) button → sets `@dba_cookie_dismissed = "1"` in AsyncStorage + hides banner

**Layout:**
- Anchored to the bottom of the screen, above the tab bar
- `position: 'absolute'`, `bottom: 0`, full width
- Elevated with shadow / border-top
- Two-line text + two inline buttons on the second line

**Text (German):**
> Diese App speichert Daten lokal und auf unseren EU-Servern, um dich angemeldet zu halten und Aktivitäten zu synchronisieren. Wir verwenden keine Werbe-Cookies oder Drittanbieter-Tracking.

Inline below: `[Datenschutzerklärung]   [Verstanden]`

**AsyncStorage key:** `@dba_cookie_dismissed`

---

### 2. Banner Placement

**File:** `client/app/_layout.tsx`

Mount `CookieBanner` once at root layout level, outside the navigator stack, so it appears across all tabs. It overlays the current screen and dismisses itself permanently.

```tsx
// Inside the root layout's return:
<Stack>
  ...
</Stack>
<CookieBanner />
```

The banner must render **after** auth state is resolved (i.e., inside the `AuthProvider` subtree) so navigation to `privacy-policy` works. If the root layout already conditionally renders tabs vs onboarding, the banner should only appear on the tabs branch.

---

### 3. Privacy Policy Screen

**New file:** `client/app/privacy-policy.tsx`

A read-only scrollable document screen. Stack screen (no tab bar). Navigated to from the banner and from the Profile tab.

**Navigation**: Add `<Stack.Screen name="privacy-policy" options={{ headerShown: false }} />` in `app/_layout.tsx`.

**Content** — written directly as static text in the component. Sections:

#### Verantwortliche Stelle (Data Controller)
- Stiftung Kindergesundheit / TUM Healthcare Innovation Program
- Contact: digital-health-at-home@proton.me

#### Welche Daten wir verarbeiten (Data Collected)

| Kategorie | Felder | Zweck |
|---|---|---|
| Konto | Name, E-Mail, Google-ID | Authentifizierung |
| Kinderprofile | Vorname, Geburtsdatum | Altersgerechte Aktivitätsvorschläge |
| Aktivitäten & Abschlüsse | Aktivitäts-ID, Datum, Status | Challenge-Fortschritt |
| Fotos | Komprimiertes Bild | Foto-Collage; vor dem Upload clientseitig komprimiert |
| Einwilligungsprotokoll | Typ, Zeitstempel, Richtlinienversion | Nachweispflicht gemäß DSGVO Art. 7 |
| Standort (optional) | Stadt-Ebene | Wetterbasierte Aktivitätsvorschläge |
| Sitzungstoken | Zugriffstoken (15 min), Refresh-Token (7 Tage) | Authentifizierung |

#### Rechtsgrundlage
- Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) — Kontoverwaltung, Challenge-Teilnahme
- Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO) — Einwilligungsnachweis
- Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) — Fotobearbeitung, optionaler Standort

#### Auftragsverarbeiter (Data Processors)
- **Hetzner Online GmbH** (Gunzenhausen, Deutschland) — Server-Hosting und Objektspeicher (S3-kompatibel, EU-gehostet). Datenschutzerklärung: hetzner.com/legal/privacy-policy
- Kein Drittanbieter-Analytics, kein Werbenetzwerk, keine Social-Media-SDKs

#### Speicherdauer (Retention)
- Kontodaten: bis zur Löschanfrage + 30 Tage Nachlauffrist
- Fotos: werden zusammen mit dem Abschluss gelöscht (sofort bei Anfrage)
- Einwilligungsprotokoll: 3 Jahre ab Datum (gesetzliche Nachweispflicht)
- Sitzungstoken: automatischer Ablauf (15 min / 7 Tage); ungültig nach Abmeldung

#### Fotoübertragung und -speicherung
Fotos werden vor dem Upload clientseitig komprimiert und verschlüsselt über HTTPS an den Server übertragen. Sie werden im Hetzner Object Storage (Frankfurt, Deutschland) gespeichert. Der Zugriff erfolgt ausschließlich über zeitlich begrenzte Pre-signed URLs (15-Minuten-Ablauf). Fotos werden nicht öffentlich indexiert.

#### Keine Datenübermittlung in Drittländer
Alle Daten werden ausschließlich auf EU-Servern (Deutschland) verarbeitet und gespeichert. Es findet keine Übermittlung in Drittländer statt.

#### Deine Rechte (User Rights)
Gemäß DSGVO hast du folgende Rechte, die du direkt in der App ausüben kannst (Einstellungen → Datenschutz):
- **Auskunft** (Art. 15): Datenexport als JSON
- **Berichtigung** (Art. 16): Profil bearbeiten
- **Löschung** (Art. 17): Account löschen (30 Tage Nachlauffrist)
- **Widerspruch** (Art. 21): Einwilligung für Standort widerrufen
- **Datenübertragbarkeit** (Art. 20): Datenexport als maschinenlesbares JSON

Für nicht in der App abbildbare Anfragen oder Beschwerden: digital-health-at-home@proton.me

Beschwerden können auch bei der zuständigen Datenschutzbehörde eingereicht werden (Bayerisches Landesamt für Datenschutzaufsicht, BayLDA).

#### Lokale Datenspeicherung
Die App speichert ausschließlich folgende Daten lokal auf deinem Gerät:
- Authentifizierungstoken (verschlüsselt im Gerätekeychain / SecureStore)
- Einstellungen und Präferenzen (AsyncStorage / localStorage)
- Zwischengespeicherte Bilder (nur im temporären Cache des Betriebssystems)

Wir verwenden keine Werbe-Cookies, kein Fingerprinting und keine Cross-Site-Tracking-Mechanismen.

#### Änderungen dieser Datenschutzerklärung
Bei wesentlichen Änderungen werden Nutzer in der App benachrichtigt und müssen erneut einwilligen. Die Versionskennung wird im Einwilligungsprotokoll gespeichert.

---

### 4. Profile Tab Link

**File:** `client/app/(tabs)/profile.tsx`

Add a "Datenschutzerklärung" row in the privacy/legal section of the Profile screen, linking to `app/privacy-policy`. This sits alongside the existing "Datenschutz & Daten" entry.

---

## Files Changed / Created

| Action | Path |
|---|---|
| New | `client/components/ui/cookie-banner.tsx` |
| Modify | `client/app/_layout.tsx` — mount `<CookieBanner />` |
| New | `client/app/privacy-policy.tsx` |
| Modify | `client/app/_layout.tsx` — register `privacy-policy` Stack.Screen |
| Modify | `client/app/(tabs)/profile.tsx` — add Datenschutzerklärung row |

No backend changes required.


### 5. Cookie Banner Illustration

Purpose

Add a humorous visual element to the cookie banner that draws attention to the notice while reinforcing the fact that the app does not use advertising cookies or third-party tracking.

Concept

A disappointed blue cookie-loving monster peeks out from behind the cookie banner after discovering that there are no actual cookies to eat. The illustration plays on the familiar concept of a "cookie banner" while accurately reflecting the app's privacy model.

Behaviour
Decorative only; no interaction
Always shown while the banner is visible
Hidden permanently once the banner is dismissed
Does not affect banner functionality or layout logic
Layout
Positioned on the right side of the banner
Rendered with a transparent background
Partially overlaps the banner boundary, with the head and one hand extending above the top edge
Does not cover banner text or action buttons
Uses pointerEvents="none" so all banner controls remain accessible
Visual

Character:

Friendly blue cookie-loving monster
Sad or confused expression
Holding an empty plate

Speech Bubble (optional):

Keine Cookies?!

Message

The illustration visually communicates the same message as the banner text: despite the presence of a cookie banner, the app does not use advertising cookies, tracking cookies, analytics SDKs, or third-party advertising technologies. Only essential local storage and authentication mechanisms are used. The monster's disappointment serves as a lighthearted metaphor for the absence of cookies

---

## Open Decisions

1. **Banner language**: German only (recommended — primary audience) or English too?
2. **Banner trigger on web vs. mobile**: On web, standard bottom-fixed banner. On mobile, same anchored layout is fine — but consider whether a one-time modal would be less intrusive than a persistent banner until dismissed.
3. **Show banner before or after sign-in?**: Recommendation — after sign-in (inside the tabs branch), since anonymous users don't have data stored yet. This also avoids showing the banner on the sign-in / onboarding screens.
4. **Policy versioning**: The current onboarding consent flow already stores `policy_version`. The banner dismissal is separate (UX notice, not a consent record). They don't need to be linked.
5. **Data controller name**: Confirm the correct legal entity name and address for the privacy policy header before shipping.
