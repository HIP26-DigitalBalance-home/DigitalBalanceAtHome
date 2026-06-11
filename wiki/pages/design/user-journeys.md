---
name: design-user-journeys
description: Core user journeys — onboarding (invite vs. cold), completing an activity, group progress, GDPR self-service
type: design
last_updated: 2026-06-11
---

# Design: User Journeys

Source: `docs/planning/ux-brief.md`

---

## Journey 1 — First-Time Onboarding

Two entry paths, both converge at Home after four steps.

### Invite path (expected majority)

Parent receives a link from KITA teacher → taps link → cold-opens app → stored token → sign in → GDPR consent → child profile → auto-joins group → Home showing active challenge collage.

### Cold-download path (minority)

Parent downloads → sign in → GDPR consent → child profile → create / find a group (or skip and wait for an invite).

### Onboarding sequence

| Step | Screen | Key decision |
|---|---|---|
| 1 | Sign in | Google OAuth only; single tap |
| 2 | GDPR consent | 3 separate checkboxes (data storage, photo processing, location — optional); stored before any data collected |
| 3 | Child profile | Nickname, DOB, optional interests; single screen |
| 4a | Join group *(invite path)* | Pre-filled confirmation; one tap |
| 4b | Create/join group *(cold path)* | Enter invite code or create group; can skip |
| — | Home | Active challenge collage; "Today's suggestion" card |

**First-win goal:** get the parent to complete their first activity as fast as possible after joining a group with an active challenge.

### UX risks

- Cold-download parents with no active group see an empty Home → mitigate with a "Create your first collage" CTA and a demo collage
- Deep-link invite flow requires storing the token in AsyncStorage before authentication and processing it after onboarding completes (implemented in M4)

---

## Journey 2 — Completing an Activity (Core Loop)

1. Parent opens app → sees collage + "Today's suggestion"
2. Taps activity → reads description, duration, materials
3. Does the activity offline with their child
4. Returns to app → taps "Mark complete" on the collage slot
5. `CompleteActivityModal` opens: "Choose photo" or "Mark without photo"
6. Photo: `expo-image-picker` → FormData upload → API returns `202` → slot shows spinner
7. Background compression runs → slot resolves to photo (polling every 3 s, max 60 s)
8. Optional: "Share to group feed" toggle (off by default, shown only for group challenges)

---

## Journey 3 — Viewing Group Progress

Parent opens Groups tab → taps group → `GroupDetailScreen` shows member families list.

Group aggregate view: "X of Y activities completed by the group" — **not per-family**.

The `GroupFeedScreen` (accessible from GroupDetailScreen) shows shared completions in chronological order.

---

## Journey 4 — Creating a Personal Collage Challenge

4-step modal flow: title → activity multi-select (selection order = grid position) → date range → group assignment (or leave unassigned for personal/family challenge) → `POST /challenges`.

Group challenges visible to all group members; personal challenges visible only to the creating parent's family.

---

## Journey 5 — End-of-Challenge Celebration

Triggered when:
- Last slot is filled after a completion (checked optimistically client-side)
- `end_date` has passed and all slots are filled (checked on Home mount)

`CelebrationScreen`: full-screen read-only collage, `canvas-confetti` animation, "Save collage" (browser PNG download on web), "Share" (Web Share API).

---

## Journey 6 — GDPR Self-Service

`PrivacyScreen` (reachable from Profile): three sections:
- **My data**: "Request export" → downloads JSON
- **Consent settings**: shows current consent state per type; withdrawal of location consent stops city being sent to suggestions
- **Delete account**: confirmation dialog → `DELETE /users/me` → "deletion scheduled" screen with a "Cancel" button

See → [design/implementation-roadmap.md](implementation-roadmap.md), [stakeholders/parents.md](../stakeholders/parents.md)
