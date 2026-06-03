# UX Planning Brief — DigitalBalance @home
**Version:** 0.1 | **Status:** Draft | **Date:** 2026-05-28

---

## User Segments

### Primary — Parent
Adult with one or more children aged ~5–10. The primary and only authenticated user type in the prototype. Key constraints:
- Cognitively loaded; the app must reduce planning overhead, not add to it
- Must never feel judged, shamed, or ranked against other families
- Varying digital literacy; onboarding must be minimal and self-explanatory
- German-speaking (prototype only)

### Secondary — Child
Indirect beneficiary. No app access, no account, no login credentials. Represented only through the parent's child profile.

### Group Role — Teacher / KITA Staff
May act as group admin: creates a group, distributes an invite link to parents, and manages the challenge for their class. No distinct account type in the prototype — a group admin is a parent account with admin rights over a specific group.

### Back-office — Foundation Admin
Manages the activity pool and challenge templates. Interacts via direct API calls in the prototype (no admin UI). Not a UX surface to design for now.

---

## Core Journeys

### 1. First-time onboarding
New parent arrives either cold (downloaded the app) or via an invite link from their KITA/group. Both paths converge at the home screen after four steps: sign in → consent → child profile → group.

### 2. Completing an activity
The recurring, value-generating loop. Parent sees a suggested activity, does it with their child offline, returns to the app, takes or uploads a photo, and watches a collage slot fill.

### 3. Viewing group progress
Parent opens the shared collage to see how the group's challenge is progressing in aggregate. No per-family breakdown is shown.

### 4. Creating a personal collage challenge
A parent can create their own collage (outside a group-assigned challenge) by selecting activities from the activity pool. This covers self-organised use cases — a family group, a neighbourhood, or a parent who wants to run their own challenge independently. The creation flow: pick a title → browse and select activities → set a start/end date → invite others or keep it personal.

### 5. Optionally sharing to the group feed
After completing an activity, the parent can choose to share the photo and caption with the group. Default is private. This journey is opt-in per completion.

### 6. GDPR self-service
Parent exports their data or requests account deletion. Must be reachable without friction from profile/settings.

---

## Onboarding

### Entry points
- **Invite link** (expected majority): parent taps a link shared by their KITA or a group member, is taken directly to sign-in, and is pre-joined to the group after account creation.
- **Cold download** (minority): parent signs in, creates a child profile, then creates or searches for a group, or waits for an invite link to be shared with them.

### Onboarding sequence (both paths)

| Step | What happens | Design principle |
|------|--------------|-----------------|
| 1. Sign in | Google OAuth only (prototype). One tap. | Minimise friction; no password to create |
| 2. GDPR consent | Granular consent screen: data storage, photo processing, optional location/weather use. Stored with timestamp. | Required before any data is collected; plain language, no dark patterns |
| 3. Child profile | Name or nickname, date of birth, optional interests. Single screen. | Ask only what's needed now; interests can be added later |
| 4a. Join group *(invite path)* | Pre-filled group join confirmation — one tap to confirm. | Near-zero friction for the expected majority |
| 4b. Join or create group *(cold path)* | Option to enter an invite code or create a new group. | Clear CTA; if no group yet, let them proceed anyway and join later |
| 5. Home screen | Redirect to home showing the active challenge collage (or an empty state if no challenge is running yet). | First impression establishes the core loop immediately |

### First win
The goal of onboarding is to get the parent to complete their first activity as fast as possible. A prompt suggesting an easy, weather-appropriate first activity should be visible on the home screen immediately after joining a group with an active challenge.

### What to challenge
- Do not ask for location access during onboarding — defer to the moment the parent first requests weather-based suggestions, and explain why.
- Do not request notification permissions during onboarding (notifications deferred to MVP).
- Do not show the full activity pool before the parent has a group — it creates decision paralysis with no context.

---

## Day-to-Day Workflow

### What brings the parent back
- The collage filling up is the primary pull — seeing progress and wanting to add to it.
- In MVP: push notifications for activity suggestions and challenge reminders.
- In prototype: no notifications; relies on intrinsic motivation and group social pressure.

### Home screen (mid-challenge)
The home screen shows the **current challenge collage** as the dominant element — the photo grid fills as activities are completed. Below or alongside it: one featured activity suggestion for today (age-appropriate, season/weather-matched).

The collage serves as both a progress indicator and a memory artifact — empty slots are visually distinct but not highlighted negatively (no red, no counters of "X activities behind").

### Completing an activity
1. Parent opens the app and sees the collage + today's suggestion
2. Taps an activity to view details (description, estimated duration, materials)
3. Does the activity offline with their child
4. Returns to the app, taps "Mark complete"
5. Camera opens → photo taken or selected from library
6. Optional caption added
7. Photo is uploaded; a 202 response returns immediately; the collage slot shows a loading state while compression runs in the background, then resolves to the photo
8. Optional: share to group feed (off by default)

### Activity order
Activities within a collage challenge are **free-choice** — there is no required sequence. Parents pick whichever activity fits the moment. The collage grid has no implied order; any slot can be filled at any time during the challenge.

### Skipping and falling behind
- No penalty, no counter, no language that implies failure
- Empty collage slots are visible but framed as "available to fill" rather than "missed"
- If a challenge ends with incomplete slots, those slots simply remain empty in the exported collage — the completed slots are celebrated, not the gap

### End-of-challenge moment
When the last activity in a challenge is completed (or when the challenge period ends), the app shows the **completed collage in full**, plays a **confetti animation**, and presents an **export button** to save the collage as a PNG. This is the primary emotional payoff of the challenge loop and should be treated as a first-class screen — not a toast or a banner.

### Progress and history
- **Personal collage**: a parent's collage shows their own photos filling their own slots. This is the primary view on the home screen. Each parent fills an identical set of activities but with their own photos.
- **Group view**: shows an aggregate across all group members (e.g., "8 of 12 activities completed by the group", meaning 8 activities have been completed by at least one member). No per-family breakdown or ranking.
- **Personal history**: parent can see their own completed activities and photos across all challenges, reachable from their profile.

---

## Engagement Strategy

### Core mechanic
The collage filling is the primary engagement mechanic — intrinsic, visual, and positive. No points leaderboard, no streak counters, no "you haven't opened the app in X days" messages.

### Points (prototype placeholder)
Points are awarded per completion and accumulate in the parent's account. In the prototype, there is no redemption UI — the balance is visible but not actionable. This avoids building engagement around a mechanic that isn't real yet.

### Completion badge
Finishing a full challenge collage awards a visible badge on the parent's profile. This is a milestone marker, not a competitive signal.

### What to avoid
- No comparative metrics (leaderboards, "X families ahead of you")
- No shame language ("you haven't done anything this week")
- No notification overload (defer all push notifications to MVP; design them as opt-out per type when they arrive)
- No dark patterns in the opt-in social sharing flow — the default must genuinely be private

---

## Accessibility and Inclusion

| Area | Decision |
|------|----------|
| Language | German only for prototype; internationalisation deferred |
| Tap targets | Minimum 44×44 px (NFR-042, P1) |
| Visual contrast | WCAG 2.1 Level AA (NFR-040, P3 — target from day one; verify before prototype user testing) |
| Alt text | All images in app UI have descriptive alt text (NFR-041, P2) |
| Cognitive load | Activity suggestions are pre-filtered and presented one at a time; browsing the full pool is secondary |
| Socioeconomic sensitivity | No activity costs money by default; no UI element exposes how many activities a family has done relative to others |
| Photo privacy | Child photos are never visible outside the parent's explicitly chosen group; no public URLs |

---

## Admin UX

Admins use the same view as all other parents — there is no separate admin screen. When a parent has admin rights in a group, admin controls (e.g., remove member, edit challenge, generate invite link) appear in-context within that group's screens. A parent who is admin in multiple groups (family group, neighbourhood group, KITA class) sees admin controls in each group independently. This ensures a seamless, unified experience regardless of role.

---

## Unresolved UX Risks

| # | Risk | Mitigation |
|---|------|------------|
| 1 | Cold-download parents with no active group have an empty home screen — risk of abandonment before they experience the core loop | Show a clear "Create your first collage" CTA and an example/demo collage to communicate value immediately |
| 2 | Weather-based suggestion when no city is set or weather API is unavailable | Fall back to a random age-appropriate, free-cost activity; no error shown to user |
| 3 | Photo compression delay (async) may leave the collage slot in a loading state longer than expected on slow connections | Cap visible loading state at a few seconds; show a placeholder photo immediately on upload so the slot feels filled right away |
