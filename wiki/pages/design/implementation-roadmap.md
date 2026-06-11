---
name: design-implementation-roadmap
description: 13-milestone build plan (M0–M12), what's done, what's open, and as-built divergences
type: design
last_updated: 2026-06-11
---

# Design: Implementation Roadmap

Source: `docs/implementation-plan.md`

Server-first delivery model: every milestone ships backend + frontend together. Server skeleton registered all routes from day one (returning 501 until implemented).

---

## Status Overview

| Milestone | Title | Status |
|---|---|---|
| M0 | Server Skeleton | Complete |
| M1 | Foundation (client tabs, theme, API client) | Complete |
| M2 | Authentication (Google OAuth, JWT) | Complete |
| M3 | Onboarding, GDPR Consent, Child Profile | Complete |
| M4 | Groups | Complete |
| M5 | Activity Pool and Suggestions | Complete |
| M6 | Challenges and Collage View | ✅ Complete |
| M7 | Activity Completion and Photo Upload | ✅ Complete |
| M8 | End-of-Challenge Celebration and Export | ✅ Complete |
| M9 | Group Feed and Social Sharing | ✅ Complete |
| **M10** | **Profile and Personal History** | **Open** |
| **M11** | **GDPR Self-Service** | **Open** |
| **M12** | **Polish, Accessibility, and Error Handling** | **Open** |

---

## Open Milestones

### M10 — Profile and Personal History

**Backend:** `GET /users/me`, `PATCH /users/me` (display name + avatar upload), `GET /completions/me` (paginated history)

**Frontend:** `ProfileScreen` (display name, avatar, points, child profile list), `EditProfileScreen`, `ActivityHistoryScreen` (paginated), `EditChildProfileScreen`

### M11 — GDPR Self-Service

**Backend:** `GET /users/me/export` (JSON data dump), `DELETE /users/me` (sets `deletion_pending_at`), `POST /users/me/cancel-deletion`

**Frontend:** `PrivacyScreen` with three sections — data export, consent management, account deletion flow

### M12 — Polish, Accessibility, and Error Handling

Empty states, error states with retry, offline banner, loading skeletons, tap target audit (≥44×44 px), WCAG 2.1 AA contrast check, `accessibilityLabel` on all images, pre-signed URL re-fetch on 403, consent re-prompt on `consent_version_mismatch`.

---

## Key As-Built Divergences

### Platform

**Target is web**, not native iOS. Expo Go for development. `expo-camera` and `react-native-confetti-cannon` require a development build on native.

### Auth (M2)

- Two OAuth flows: `ResponseType.IdToken` on web; authorization code + PKCE on native
- `expo-secure-store` unavailable in Expo Go SDK 54 → falls back to `AsyncStorage` for development

### Onboarding (M3)

- `@spezivibe/onboarding` not available → `FeatureCard`, `PaginationDots`, `ConsentCheckbox` built inline in `client/components/onboarding/`
- `useOnboardingStatus` uses `AsyncStorage` key `@dba_onboarding_v1` (client-side only — does not sync on reinstall)

### Groups (M4)

- Family roles removed entirely — all family members are equal (no admin role within families)
- Unauthenticated invite flow: RouteGuard stores token in `AsyncStorage` before auth; processed after onboarding
- `GroupMemberFamily` schema enriched with `parents: list[FamilyParentInGroup]` to avoid N+1 queries

### Photo Upload (M7)

- Web FormData: must use `fetch(blobUri) → Blob → form.append(blob, filename)` (not the RN `{uri,type,name}` shorthand)
- Pre-signed URLs embedded directly in challenge/completion responses (no separate client call needed)
- S3 guard: server returns 503 (not 500) when S3 credentials unconfigured

### Celebration (M8)

- `canvas-confetti` (web, dynamic import) replaces `react-native-confetti-cannon`
- `html2canvas` replaces `react-native-view-shot` for PNG export
- No `expo-media-library` — "Save" is a browser PNG download

### Feed (M9)

- `shared_to_feed` included in initial `POST /completions` payload — no PATCH endpoint added
- `GroupFeedScreen` at `/group-feed/[id]` (avoids Expo Router conflict with existing `app/group/[id].tsx`)

---

## Non-Milestone Track

**Server deployment** (EU VM + Caddy TLS): required before first real-user test. Not in the milestone plan — track separately.

See → [overview.md](../overview.md), [design/architecture.md](architecture.md)
