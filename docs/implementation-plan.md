# Implementation Plan: DigitalBalance @home

> Updated to reflect a server-first delivery model. Every milestone ships both backend routes and frontend screens together. The server skeleton (Milestone 0) registers all routes from day one — unimplemented ones return `501 Not Implemented` until their milestone arrives. The frontend always calls real endpoints; no mocks, no local stubs.

---

## Context

| Field | Value |
|---|---|
| App | DigitalBalance @home — family activity challenge app using positive reinforcement to build offline parent-child time |
| Client | React Native (Expo) — `/Users/Igo/digital-balance-at-home` |
| Server | FastAPI + PostgreSQL 16 — new repo, suggested path `/Users/Igo/digital-balance-at-home-api` |
| Photo storage | Hetzner Object Storage (S3-compatible, EU-hosted) |
| Auth | Google OAuth 2.0 / OIDC |
| Deployment (prototype) | Docker Compose, single EU server, Caddy |
| Study context | No |

---

## Planning Inputs

**UX brief** (`docs/planning/ux-brief.md`) — Two onboarding paths (invite vs. cold), GDPR consent gate, child profile setup, core collage completion loop, activity suggestions (age + season + weather + interests), group aggregate view, opt-in feed sharing, end-of-challenge celebration with confetti and PNG export, personal challenge creation.

**Data model brief** (`docs/planning/data-model-brief.md`) — 10 entities: User, ChildProfile, Group, GroupMembership, Invite, Activity, Challenge, ChallengeActivity, Completion, ConsentRecord. Each parent fills their own collage independently; collage is derived at query time; personal challenges allow `null group_id`; suggestions use age + season + weather + interests.

**Compliance brief** (`docs/planning/compliance-brief.md`) — GDPR is the primary obligation. Granular consent at onboarding. Hetzner confirmed as EU-hosted photo storage. 5 pre-launch legal/process TODOs outstanding (D2–D5, D7).

---

## Feature List

| # | Feature | Source | Priority | Packages / Custom |
|---|---|---|---|---|
| 1 | Navigation shell (tab bar + stack) | Architecture | Must | `@react-navigation/native`, bottom-tabs, native-stack |
| 2 | App theme system (colors, typography, spacing) | UX brief | Must | Custom theme tokens |
| 3 | API client with auth header injection | Architecture | Must | `axios`, custom interceptors |
| 4 | Google OAuth 2.0 sign-in | Architecture / UX | Must | `expo-auth-session`, custom OIDC service |
| 5 | JWT token storage + silent refresh | Architecture | Must | `expo-secure-store`, custom auth context |
| 6 | Welcome + feature highlight screens | UX brief | Must | `@spezivibe/onboarding` (`FeatureCard`, `PaginationDots`) |
| 7 | Granular GDPR consent (3 checkboxes) | Compliance | Must | `@spezivibe/onboarding` (`ConsentCheckbox`) |
| 8 | Child profile creation (nickname, DOB, interests) | UX / data model | Must | Custom UI + API |
| 9 | Onboarding gate (skip if completed) | UX brief | Must | `@spezivibe/onboarding` (`useOnboardingStatus`) |
| 10 | Group creation | UX brief | Must | Custom UI + backend |
| 11 | Join group via invite link / code | UX brief | Must | Custom UI + deep link handling |
| 12 | Group detail view (members, active challenge) | UX brief | Must | Custom UI + backend |
| 13 | In-context admin controls (invite, remove member) | UX brief | Must | Custom UI + backend |
| 14 | Activity list with filter chips | UX brief | Must | Custom UI + backend |
| 15 | Activity detail screen | UX brief | Must | Custom UI |
| 16 | Activity suggestion engine (age + season + weather + interests) | UX / data model | Must | Custom backend service, weather API |
| 17 | "Today's suggestion" card on home screen | UX brief | Must | Custom UI |
| 18 | Challenge creation (title, activities, dates, group) | UX brief | Must | Custom UI + backend |
| 19 | Collage grid view (filled + empty slots) | UX brief | Must | Custom UI component |
| 20 | Group aggregate view (X/N families completed) | UX brief | Must | Custom UI + backend |
| 21 | Challenge list (upcoming / active / completed) | UX brief | Must | Custom UI + backend |
| 22 | Photo capture (camera + gallery picker) | UX brief | Must | `expo-camera`, `expo-image-picker` |
| 23 | Photo upload with 202 + loading placeholder | Architecture | Must | Custom upload service |
| 24 | Async compression polling (processing → ready) | Architecture | Must | Custom polling hook |
| 25 | Caption input on completion | UX brief | Should | Custom UI |
| 26 | Self-reported completion (no photo) | SRS FR-044 | Should | Custom UI |
| 27 | Opt-in group feed sharing toggle | UX brief | Should | Custom UI + backend |
| 28 | End-of-challenge celebration screen | UX brief | Must | `react-native-confetti-cannon` |
| 29 | Collage PNG export + share sheet | UX brief | Should | `react-native-view-shot`, `expo-sharing` |
| 30 | Group feed screen (shared completions) | UX brief | Should | Custom UI + backend |
| 31 | Profile screen (display name, photo, points) | SRS FR-006 | Should | `@spezivibe/account` adapted for custom API |
| 32 | Personal activity history | UX brief | Should | Custom UI + backend |
| 33 | GDPR data export | Compliance | Must | Custom UI + backend |
| 34 | Account deletion flow (30-day window) | Compliance | Must | Custom UI + backend |
| 35 | Consent management + withdrawal | Compliance | Must | Custom UI + backend |
| 36 | Empty states, error states, offline banner | UX brief | Must | Custom UI |
| 37 | Accessibility audit (tap targets, contrast, alt text) | Compliance | Must | Manual review |

---

## Milestones

---

### Milestone 0: Server Skeleton

**Goal:** A running FastAPI server with every route registered, returning `501 Not Implemented` for all business endpoints and `200 OK` for the health check — runnable locally via Docker Compose from this point forward.

**Depends on:** Nothing

#### Backend tasks
1. Create the FastAPI project at `digital-balance-at-home-api/` following the layered structure: `app/api/`, `app/core/`, `app/dependencies/`, `app/models/`, `app/schemas/`, `app/repositories/`, `app/services/`
2. Create `app/main.py`: FastAPI app factory, CORS middleware (allow all origins in development), structured logging with `structlog`, lifespan hook for DB connection pool
3. Register all routers with their full path prefixes — each router file contains only route stubs returning `HTTPException(501)`:
   - `app/api/health.py` → `GET /healthz` (returns `{"status": "ok"}`)
   - `app/api/auth.py` → `POST /auth/google/callback`, `POST /auth/refresh`, `DELETE /auth/logout`
   - `app/api/users.py` → `GET /users/me`, `PATCH /users/me`, `DELETE /users/me`, `POST /users/me/cancel-deletion`, `GET /users/me/export`
   - `app/api/children.py` → `POST /children`, `GET /children`, `PATCH /children/{id}`, `DELETE /children/{id}`
   - `app/api/consents.py` → `POST /consents`, `GET /consents`
   - `app/api/families.py` → `POST /families`, `GET /families/me`, `GET /families/{id}`, `POST /families/{id}/invites`, `POST /families/join`, `PATCH /families/{id}/members/{user_id}`, `DELETE /families/{id}/members/{user_id}`
   - `app/api/groups.py` → `POST /groups`, `GET /groups/me`, `GET /groups/{id}`, `POST /groups/{id}/invites`, `POST /groups/join`, `DELETE /groups/{id}/members/{family_id}`, `POST /groups/{id}/admins`, `DELETE /groups/{id}/admins/{user_id}`
   - `app/api/activities.py` → `GET /activities`, `GET /activities/suggestions`
   - `app/api/challenges.py` → `POST /challenges`, `GET /challenges/active`, `GET /challenges/me`, `GET /challenges/{id}`
   - `app/api/photos.py` → `POST /photos`, `GET /photos/{completion_id}/url`
   - `app/api/completions.py` → `POST /completions`, `GET /completions/{id}`, `GET /completions/me`
4. Create `docker-compose.yml`: `api` service (FastAPI via uvicorn, port 8000) and `db` service (PostgreSQL 16, port 5432); named volume for postgres data
5. Create `requirements.txt`: `fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `pydantic-settings`, `structlog`, `python-jose[cryptography]`, `httpx`, `boto3`
6. Create `app/core/config.py`: `pydantic-settings` `Settings` class reading from environment; include `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `S3_ENDPOINT_URL`, `S3_BUCKET_NAME`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
7. Create `.env.example` with all required variables; create `.env` for local development (never commit)
8. Confirm `docker compose up` starts cleanly; `GET /healthz` returns 200; any other route returns 501

**Verify:**
- `docker compose up` starts without errors
- `curl http://localhost:8000/healthz` → `{"status": "ok"}`
- `curl -X POST http://localhost:8000/auth/google/callback` → 501
- All routes are listed in `http://localhost:8000/docs` (FastAPI auto-generated OpenAPI)

---

### Milestone 1: Foundation

**Goal:** A running React Native app with the correct tab structure, DigitalBalance colour palette, and an API client wired to the local server — ready for every subsequent screen to be built on top of.

**Depends on:** Milestone 0

#### Backend tasks
1. No new routes. Confirm `GET /healthz` is reachable from the simulator/device (check CORS and network config)

#### Frontend tasks
1. In `constants/theme.ts`: replace Stanford Cardinal with the DigitalBalance palette (warm, family-friendly tones — not clinical); define semantic colour tokens: `primary`, `surface`, `onSurface`, `accent`, `destructive`, `muted`
2. Replace the three template tabs with the four app tabs: **Home** (collage), **Activities**, **Groups**, **Profile** — update `app/(tabs)/_layout.tsx` with correct icons and labels; delete `contacts.tsx` and `explore.tsx`; add stub screens for each tab
3. Create `lib/api/client.ts`: `axios` instance with `baseURL` from environment config (`EXPO_PUBLIC_API_URL`, defaulting to `http://localhost:8000`); request interceptor injecting `Authorization: Bearer <token>`; 401 response interceptor calling `refreshTokens()` then retrying (stub the auth hook for now)
4. Create `lib/api/index.ts`: barrel export for all future API modules
5. Set up environment config: `EXPO_PUBLIC_API_URL` in `.env` and `.env.example`; load via `expo-constants`
6. Add a visible indicator on the Home stub screen confirming the server is reachable: call `GET /healthz` on mount and show "Server connected" / "Server unreachable"

**Verify:**
- App launches showing four tabs: Home, Activities, Groups, Profile
- Each tab shows a labelled stub screen
- Home screen shows "Server connected" when the Docker Compose stack is running
- Colour palette matches the DigitalBalance theme (no Stanford red)

---

### Milestone 2: Authentication

**Goal:** A parent can sign in with Google; the server verifies the ID token, creates or upserts the user, and issues JWT tokens; the app stores them and injects them into every subsequent request.

**Depends on:** Milestone 1

#### Backend tasks
1. Implement `GET /healthz` with DB connectivity check (query `SELECT 1`)
2. Set up SQLAlchemy async engine in `app/core/database.py`; create `app/models/base.py` with `TimestampMixin` (UUID PK, `created_at`, `updated_at`)
3. Create `app/models/user.py`: `User` model (`id`, `google_sub`, `email`, `display_name`, `profile_photo_key`, `points_balance`, `deletion_pending_at`)
4. Create `app/schemas/auth.py` and `app/schemas/user.py`; create `app/repositories/user.py` with `upsert_by_google_sub`
5. Implement `app/services/auth.py`: verify Google ID token against Google's public keys (`https://www.googleapis.com/oauth2/v3/certs`); upsert User; issue signed JWT access token (15 min) and refresh token (7 days)
6. Implement `POST /auth/google/callback` → returns `{access_token, refresh_token, user}`
7. Implement `POST /auth/refresh` → validates refresh token, issues new pair (rotation)
8. Implement `DELETE /auth/logout` → 204 (tokens are stateless; client discards them)
9. Rate-limit `/auth/*` endpoints: 10 requests per IP per minute (use a simple in-process sliding window for prototype)
10. Run first Alembic migration: `alembic revision --autogenerate -m "add users table"` → `alembic upgrade head`

#### Frontend tasks
1. Install `expo-auth-session`, `expo-crypto`, `expo-secure-store`; configure Google OAuth client IDs in `app.config.js`
2. Create `lib/auth/google-auth.ts`: opens Google consent screen via `expo-auth-session`; exchanges the authorization code with `POST /auth/google/callback`
3. Create `lib/auth/token-store.ts`: read/write access and refresh tokens via `expo-secure-store`
4. Create `lib/auth/auth-context.tsx`: `AuthProvider` exposing `isAuthenticated`, `currentUser`, `login()`, `logout()`, `refreshTokens()`; wrap app root
5. Wire the 401 interceptor in `lib/api/client.ts` to call `refreshTokens()` and retry; on refresh failure, call `logout()` and redirect to sign-in
6. Build `SignInScreen`: single "Sign in with Google" button; on success, redirect to Home tab
7. Add route guard in `app/_layout.tsx`: redirect unauthenticated users to `SignInScreen` using `<Redirect />`

**Verify:**
- "Sign in with Google" opens the Google consent screen
- After consent, the app returns to Home as an authenticated user
- Killing and relaunching restores the session from secure storage
- A forced token expiry triggers silent refresh and retries the original request
- Sign-out clears tokens and returns to `SignInScreen`

---

### Milestone 3: Onboarding, GDPR Consent, and Child Profile

**Goal:** First-time users complete a welcome flow, give granular GDPR consent (stored in the DB), and create at least one child profile before reaching the home screen.

**Depends on:** Milestone 2

#### Backend tasks
1. Create `app/models/consent.py` (`ConsentRecord`), `app/models/family.py` (`Family`, `FamilyMembership`, `FamilyInvite`), `app/models/child_profile.py` (`ChildProfile`); Alembic migration
2. Create repositories and schemas for all new models
3. Implement `POST /consents`: create ConsentRecord; require valid JWT; 201
4. Implement `GET /consents`: return the user's most recent consent record
5. Implement `POST /families`: create Family; add creator as `admin` FamilyMembership; 201 with `{family, membership}`
6. Implement `GET /families/me`: return all families the authenticated user belongs to, with their role and member list
7. Implement `POST /families/{id}/invites`: create FamilyInvite token (7-day expiry); require `admin` role; return `{invite_url}`
8. Implement `POST /families/join`: validate token; add the authenticated user as `member` of the family; 200
9. Implement `PATCH /families/{id}/members/{user_id}`: update role; require `admin`; block demotion of last admin
10. Implement `DELETE /families/{id}/members/{user_id}`: remove FamilyMembership; require `admin`; block removal of last admin
11. Implement `POST /children`: create ChildProfile under the authenticated user's family (`family_id` derived server-side from the user's FamilyMembership); require the user to have a family — 400 if not; 201
12. Implement `GET /children`: return all ChildProfiles for the user's family
13. Implement `PATCH /children/{id}`: update nickname, date_of_birth, interests; validate family membership
14. Implement `DELETE /children/{id}`: hard delete; validate family membership

#### Frontend tasks
1. Add `useOnboardingStatus()` gate in `app/_layout.tsx`: if not complete, redirect to the onboarding flow
2. Build welcome screens (2–3 screens) using `@spezivibe/onboarding` `FeatureCard` + `PaginationDots`
3. Build GDPR consent screen using `ConsentCheckbox` (data storage [required], photo processing [required], location/weather [optional]); `POST /consents` on submission
4. Build **family setup screen**: "Create your family" — optional family name input; `POST /families`; this step sits between consent and child profile creation
5. Build child profile creation form: nickname, date of birth, interests chip input with safety hint; `POST /children` (backend derives `family_id` from the authenticated user's family)
6. Call `markOnboardingCompleted()` after the child profile is saved; redirect to Home tab
7. Handle two deep-link entry paths through onboarding: **group invite** (preserve group token; join group after child profile saved — M4 logic) and **family invite** (bypass family creation step; join the inviting family instead)

**Verify:**
- Fresh install shows welcome → consent → family setup → child profile in sequence
- Required consent checkboxes cannot be skipped
- ConsentRecord and Family are created in the DB
- Returning user skips onboarding and lands on Home
- Child profile is retrievable via `GET /children` and is linked to the family (not the individual user)
- Profile tab shows family members (names only — no admin roles) with "Invite to family" and "Leave family" buttons
- Any member can generate an invite link; a member can leave the family; no one can remove another member

---

### Milestone 4: Groups

**Goal:** A parent can create a group, generate an invite link, and share it; another parent taps the link and joins the group.

**Depends on:** Milestone 3

#### Backend tasks
1. Create `app/models/group.py` (`Group`, `GroupMembership`, `GroupAdmin`, `GroupInvite`); Alembic migration
2. Create repositories and schemas
3. Implement `POST /groups`: create Group; add creator's family as the first GroupMembership; add creator as the first GroupAdmin; 201
4. Implement `GET /groups/me`: return all groups where the authenticated user's family has a GroupMembership; include whether the user personally holds GroupAdmin rights
5. Implement `GET /groups/{id}`: return group detail (name, member families with display names); validate that the requesting user's family is a member
6. Implement `POST /groups/{id}/invites`: create single-use GroupInvite token (7-day expiry); require GroupAdmin; return `{invite_url}`
7. Implement `POST /groups/join`: validate token; require the authenticated user to have a family — 400 if not; create GroupMembership for the user's family; mark token as used; 200 with group summary
8. Implement `DELETE /groups/{id}/members/{family_id}`: remove GroupMembership and any GroupAdmin rows for parents of that family; require GroupAdmin; block if it would leave the group with no admins
9. Implement `POST /groups/{id}/admins`: grant GroupAdmin to a user; require GroupAdmin; user must be a member of a family in the group
10. Implement `DELETE /groups/{id}/admins/{user_id}`: revoke GroupAdmin; require GroupAdmin; block if it would leave the group with no admins

#### Frontend tasks
1. Build `GroupsTab`: list of the user's groups (`GET /groups/me`); empty state with "Create a group" and "Join via code" CTAs
2. Build `CreateGroupScreen`: name input → `POST /groups` → navigate to `GroupDetailScreen`
3. Build `GroupDetailScreen`: member **families** list (not individual parents); in-context admin controls section visible only to GroupAdmins
4. Admin controls: "Generate invite link" → `POST /groups/{id}/invites` → copy (`expo-clipboard`) + share sheet (`expo-sharing`); "Remove family" with confirmation dialog; "Grant/revoke admin" for individual parents in the group
5. Build `JoinGroupScreen`: invite code input → `POST /groups/join` → navigate to group on success; surface "expired", "no family set up", "already member" errors
6. Configure two deep link token types in `app.config.js`: `digitalbalance://join-group?token=X` and `digitalbalance://join-family?token=X`; route each to the correct join screen on cold open

**Verify:**
- Admin can create a group; their family appears in the member list
- Invite link adds the redeeming parent's **family** as a member (not just the individual parent)
- A parent without a family cannot join a group (clear error message)
- Non-admin parents do not see admin controls
- Removing a family removes all their GroupAdmin rows too
- Expired and already-used tokens return clear error messages

---

### Milestone 5: Activity Pool and Suggestions

**Goal:** A curated activity pool is seeded in the DB; parents can browse and filter activities; a single weather-appropriate suggestion appears on the home screen.

**Depends on:** Milestone 1 (API client), Milestone 3 (child profile for age/interests)

#### Backend tasks
1. Create `app/models/activity.py` (`Activity`); Alembic migration
2. Create repository and schemas; seed the DB with 20–30 activities covering a range of age groups, seasons, weather suitability, and cost indicators (free and low_cost only — no paid activities in the seed data)
3. Implement `GET /activities`: return the full pool; support query params `age`, `season`, `weather`, `cost`; exclude paid activities from default results (service-layer rule)
4. Implement `GET /activities/suggestions`: accept `child_id` (derives age + interests), optional `city`; apply filter rules; if no city or weather API unavailable, select a random age-appropriate free activity; return a single activity

#### Frontend tasks
1. Build `ActivitiesTab`: scrollable activity list from `GET /activities`; filter chips for age, season, weather, cost; `Activity` detail screen (title, description, duration, cost badge, season/weather tags)
2. Build `SuggestionService` in `lib/api/suggestions.ts`: calls `GET /activities/suggestions` with the first child's age and optional city; handles fallback gracefully
3. Add "Today's suggestion" card to the Home stub screen: activity title, duration, "Let's do it" CTA navigating to `ActivityDetailScreen`
4. Add city preference setting reachable from Profile tab (stub): text input for city name stored locally and sent with suggestion requests; only shown if `location_consent = true` from the ConsentRecord

**Verify:**
- Activity list loads with 20+ activities
- Filter chips narrow results correctly; no paid activity appears
- Suggestion card on Home shows an age-appropriate activity
- Removing the city setting causes the suggestion to fall back to a random activity

---

### Milestone 6: Challenges and Collage View ✅

**Goal:** A parent can create a challenge (group or personal), see their own collage on the Home screen, and see the group's aggregate completion count.

**Depends on:** Milestone 4 (groups), Milestone 5 (activity pool)

#### Backend tasks
1. Create `app/models/challenge.py` (`Challenge`, `ChallengeActivity`) and `app/models/completion.py` (`Completion`, table only — endpoints in M7); Alembic migration
2. Create repositories and schemas; regenerate `generated.py` from OpenAPI spec
3. Implement `POST /challenges`: create Challenge with associated ChallengeActivity rows; `group_id` nullable; require group membership if specified; 201
4. Implement `GET /challenges/active`: return **all** currently active challenges (start_date ≤ today ≤ end_date) as `list[ChallengeWithProgress]`; includes family completions and per-slot group counts
5. Implement `GET /challenges/me`: return all challenges the family participates in; filterable by `status=upcoming|active|completed`
6. Implement `GET /challenges/{id}`: full detail with completions and group aggregate
7. Implement `DELETE /challenges/{id}`: only the creating family can delete; cascades to ChallengeActivity rows

#### Frontend tasks
1. Build `CreateChallengeFlow` (4-step modal): title → activity multi-select (selection order = grid_position) → date range (web native date picker via `type="date"`) → group assignment → `POST /challenges`
2. Build `CollageGrid` component: slot sizing derived from container `onLayout` (not hardcoded window width); slots show empty placeholder, ✓ for self-reported, spinner for processing, photo for ready; tapping empty slot opens `CompleteActivityModal`, tapping a photo opens `PhotoViewerModal`
3. Replace Home stub: all active challenges rendered as scrollable collage cards; today's suggestion picked from unfulfilled slots of active challenges (falls back to `GET /activities/suggestions` only when all slots complete)
4. Build `ChallengeListScreen` reachable from Home header: upcoming / active / completed with status chips
5. Build `ChallengeDetailScreen`: collage grid + group progress table + group link (navigates to `GroupDetailScreen`) + delete button
6. Add `GroupProgressView` section inside `GroupDetailScreen`: active group challenges listed with link to detail

**Verify:**
- Creating a challenge with 6 activities shows a 6-slot collage grid on Home
- Multiple active challenges each render their own card, stacked and scrollable
- Group progress view shows correct aggregate counts
- Delete challenge navigates back; slot goes empty immediately

---

### Milestone 7: Activity Completion and Photo Upload ✅

**Goal:** A parent marks an activity complete with a photo; the collage slot transitions from empty → loading → photo without blocking the UI.

**Depends on:** Milestone 6

#### Backend tasks
1. `Completion` model and table already created in M6; no new migration
2. Configure `boto3` S3 client in `app/core/storage.py` pointing at Hetzner Object Storage (endpoint URL must include `https://` scheme)
3. Implement `POST /photos`: validate MIME type (JPEG/PNG) and file size (≤ 10 MB); upload raw to `raw/{family_id}/{uuid}.jpg`; create Completion with `status="processing"`; enqueue `compress_photo` via FastAPI `BackgroundTasks`; return `202 {completion_id}`
4. Background compression: `asyncio.run()` in thread (avoids psycopg2 dependency) → Pillow resize to 1200 px, JPEG 85% → upload to `photos/{family_id}/{uuid}.jpg` → delete raw → update Completion to `status="ready"`
5. Pre-signed URLs (15-min TTL) are generated inline in `_completion_dict` whenever `status="ready"` — embedded in challenge and completion responses, no separate client round-trip needed
6. Implement `POST /completions`: self-reported completion; 201
7. Implement `GET /completions/{id}`: status polling; includes `photo_url` when ready
8. Implement `DELETE /completions/{id}`: removes DB row and S3 photo; family-scoped

#### Frontend tasks
1. `expo-image-picker` (no `expo-camera`); no development build required for web target
2. On web, FormData photo append: `fetch(blobUri)` → `Blob` → `form.append('image', blob, 'photo.jpg')` (React Native's `{uri,type,name}` shorthand is native-only and silently breaks on web)
3. `CompleteActivityModal`: RN `Modal` overlay with "Choose photo" and "Mark without photo"; tapping outside closes
4. `useCompletionStatus` hook: polls `GET /completions/{id}` every 3 s; reads `photo_url` directly from the response; stops after 60 s
5. `localCompletions` state in parent screens: optimistic updates; `status='deleted'` sentinel restores slot to empty without re-fetch
6. `PhotoViewerModal`: contained card (not full-screen) on `rgba(0,0,0,0.5)` backdrop; 4:3 photo area; ✕ overlaid; Download (fetch blob → anchor click) and Delete (`DELETE /completions/{id}`) buttons; outlined style
7. No caption input screen for prototype (caption field nullable, omitted from UI)

**Verify:**
- Tapping empty slot opens modal; "Mark without photo" shows ✓ immediately
- Photo upload shows spinner immediately (202); after background compression slot shows the photo
- Tapping a filled photo slot opens `PhotoViewerModal`; download works; delete restores slot to empty
- Server returns 503 (not 500) when S3 credentials are not configured

---

### Milestone 8: End-of-Challenge Celebration and Export

**Goal:** When a parent fills their last collage slot, they see a full-screen celebration with confetti and can export the collage as a PNG.

**Depends on:** Milestone 7

#### Backend tasks
No new routes. The challenge completion state is already derivable from `GET /challenges/{id}` (all ChallengeActivity slots have a Completion with `status = "ready"` or `"self_reported"`). No server-side event needed.

#### Frontend tasks
1. After each successful completion, check locally whether all slots for the active challenge are now filled; if yes, navigate to `CelebrationScreen`
2. Also trigger `CelebrationScreen` when `end_date` has passed on the next app foreground (check in `HomeScreen` mount)
3. Build `CelebrationScreen`: full-screen `CollageGridComponent` (read-only); confetti on mount (`react-native-confetti-cannon`); "Save to camera roll" button; "Share" button
4. "Save to camera roll": capture the `CollageGridComponent` ref as PNG (`react-native-view-shot`) → save to camera roll (`expo-media-library`, request permission); show success toast
5. "Share": pass the captured PNG to `expo-sharing` native share sheet

**Verify:**
- Completing the last activity navigates to `CelebrationScreen` automatically
- Confetti plays on arrival
- PNG is saved to camera roll
- Reopening a completed challenge shows the collage in read-only mode

---

### Milestone 9: Group Feed and Social Sharing

**Goal:** A parent can optionally share a completion to the group feed; group members can browse shared completions.

**Depends on:** Milestone 7

#### Backend tasks
1. Add `shared_to_feed` boolean (default false) to Completion (migration)
2. Implement `POST /completions` update path: allow `PATCH /completions/{id}` to toggle `shared_to_feed` after the fact — or include it in the initial `POST /completions` payload (either is fine; pick one and document it)
3. Add `GET /groups/{id}/feed`: return Completions within the group where `shared_to_feed = true`, ordered by `completed_at` desc; include activity title, user display name, photo pre-signed URL (if `status = "ready"`), caption; validate group membership before returning

#### Frontend tasks
1. Add "Share to group" toggle to `CompleteActivitySheet` (visible only when challenge belongs to a group); default off; include `shared_to_feed` in the completion payload
2. Build `GroupFeedScreen` accessible from `GroupDetailScreen`: chronological list of shared completions; each card shows photo (or checkmark icon), caption, activity name, member display name; photos loaded via pre-signed URLs
3. No reactions in the prototype (P3 in SRS)

**Verify:**
- A completion with `shared_to_feed: true` appears in the group feed
- A completion with `shared_to_feed: false` does not appear
- Photos in the feed load from pre-signed URLs; a member cannot access another group's feed

---

### Milestone 10: Profile and Personal History

**Goal:** A parent can view and edit their profile, see their points balance, and browse their completion history across all challenges.

**Depends on:** Milestone 3 (child profile), Milestone 7 (completions)

#### Backend tasks
1. Implement `GET /users/me`: return authenticated user (email, display_name, profile_photo_key, points_balance)
2. Implement `PATCH /users/me`: update display_name; accept profile photo upload (same S3 pattern as activity photos, different prefix `avatars/`); return updated user
3. Implement `GET /completions/me`: return all completions for the authenticated user across all challenges, paginated; include activity title, challenge title, `completed_at`, photo pre-signed URL

#### Frontend tasks
1. Build `ProfileScreen`: display name, avatar (pre-signed URL), points balance (label only — no redemption UI), child profile list with "Edit" links
2. Build `EditProfileScreen`: update display name (`PATCH /users/me`); upload profile photo (same `PhotoUploadService`)
3. Build `ActivityHistoryScreen`: paginated list from `GET /completions/me`; each row shows activity, challenge, date, thumbnail
4. Build `EditChildProfileScreen`: update nickname, DOB, interests (`PATCH /children/{id}`)

**Verify:**
- Editing display name persists after app restart
- Profile photo uploads and displays from pre-signed URL
- Activity history shows completions across challenges with correct metadata

---

### Milestone 11: GDPR Self-Service

**Goal:** A parent can export all their data, request account deletion, and manage consent — all from within the app.

**Depends on:** Milestone 10

#### Backend tasks
1. Implement `GET /users/me/export`: collect all the user's data (user record, child profiles, consents, group memberships, completions with metadata); package as JSON; include a list of photo keys (not the photos themselves — client fetches them separately); return as downloadable JSON response
2. Implement `DELETE /users/me`: set `deletion_pending_at = now()`; return 202 with message about the 30-day window; do not delete data yet
3. Implement `POST /users/me/cancel-deletion`: clear `deletion_pending_at`; return 200

#### Frontend tasks
1. Build `PrivacyScreen` (reachable from Profile): sections "My data", "Consent settings", "Delete account"
2. Data export: "Request export" → `GET /users/me/export` → save JSON to device (`expo-file-system`); show progress and "Download complete" confirmation
3. Consent management: show current consent state per type; withdrawal of location consent removes the city from suggestion requests; required consents display a message that withdrawal requires account deletion
4. Account deletion flow: confirmation dialog → `DELETE /users/me` → show "scheduled for deletion" screen with "Cancel" button → `POST /users/me/cancel-deletion` on cancel
5. On confirmed deletion intent, clear local tokens and navigate to `SignInScreen`

**Verify:**
- Export downloads a JSON file containing the user's data
- Deletion request sets `deletion_pending_at` in the DB
- Cancel deletion within the window restores normal access
- Withdrawing location consent stops the city from being sent to suggestions

---

### Milestone 12: Polish, Accessibility, and Error Handling

**Goal:** Every screen has correct empty states, error recovery, and meets WCAG 2.1 AA and the GDPR UX bar — the app is prototype-ready.

**Depends on:** All prior milestones

#### Backend tasks
1. Return structured error responses throughout: `{"detail": "<message>", "code": "<error_code>"}` for all 4xx responses; confirm this is consistent across all implemented routes
2. Add request correlation IDs to all log lines (`X-Request-ID` header, generated per request)

#### Frontend tasks
1. Empty states: no groups, no active challenge, no activities matching filters, empty group feed, no history
2. Error states: retry buttons on all data-fetching screens; plain-language German error messages for common API errors (401, 403, 404, 429, 500, network timeout)
3. Offline detection: show a persistent banner when the device has no network; disable mutating actions
4. Loading skeletons: replace `ActivityIndicator` spinners with skeleton screens on collage and list views
5. Tap target audit: every interactive element ≥ 44×44 px
6. WCAG 2.1 AA contrast check on all text/background combinations in the theme
7. `accessibilityLabel` on all images (collage photos, thumbnails, avatars)
8. Pre-signed URL expiry: re-fetch `GET /photos/{id}/url` transparently on 403 before showing an error
9. Consent re-prompt: detect `consent_version_mismatch` error from the server; re-present the consent screen

**Verify:**
- Every screen has a defined empty, loading, and error state
- App degrades gracefully with no network
- All interactive elements meet the 44 px tap target requirement
- All images have `accessibilityLabel` values

---

## Data Model Integration

| Entity | Milestone introduced | Notes |
|---|---|---|
| User | M2 — auth | Google sub, JWT issuance |
| ConsentRecord | M3 — onboarding | Append-only; per-user; consent gate in onboarding flow |
| Family | M3 — onboarding | Created during onboarding before child profiles |
| FamilyMembership | M3 — onboarding | Creator gets `admin` role; second parent joins via FamilyInvite |
| FamilyInvite | M3 — onboarding | Same mechanics as GroupInvite; allows second parent to join family |
| ChildProfile | M3 — onboarding | `family_id` FK (not `user_id`); age derived at query time |
| Group | M4 | Created by a parent; creating parent's family is the first GroupMembership |
| GroupMembership | M4 | `family_id` FK — families join groups, not individual parents |
| GroupAdmin | M4 | Separate from GroupMembership; individual parents hold group admin rights |
| GroupInvite | M4 | Redeeming parent's family is added as GroupMembership |
| Activity | M5 | Seeded; paid activities filtered at service layer |
| Challenge | M6 | `group_id` nullable (personal = creating parent's family); state derived at query time |
| ChallengeActivity | M6 | `grid_position` is layout-only |
| Completion | M7 | `family_id` FK; `completed_by_user_id` tracks which parent; unique on `(family_id, challenge_activity_id)` |

---

## Compliance Integration

| Control | Milestone | Approach |
|---|---|---|
| Granular GDPR consent (3 types, versioned) | M3 | `ConsentCheckbox` + `POST /consents`; append-only backend |
| Consent re-prompt on policy version change | M12 | `consent_version_mismatch` error from server; re-present consent screen |
| Photo access via pre-signed URLs (15-min TTL) | M7, M9, M10 | `GET /photos/{id}/url`; re-fetch on 403 |
| Children's data never in group-visible responses | M6, M9 | Enforce in service layer; never include ChildProfile in group API responses |
| Right to erasure (30-day SLA) | M11 | `DELETE /users/me` → `deletion_pending_at`; async deletion job |
| Data portability | M11 | `GET /users/me/export` → JSON download |
| Secure token storage | M2 | `expo-secure-store`; never `AsyncStorage` for tokens |
| TLS everywhere | M0 | API base URL must be `https://` in staging/production; HTTP allowed in local Docker only |
| Rate limiting on auth (handle 429) | M2 | In-process sliding window on server; client shows "Too many attempts" |
| Admin action logging | M4 | Log actor + action + timestamp in server structured logs |
| Location consent gate | M5 | City sent to suggestions only if `location_consent = true` |
| Interests field safety hint | M3 | In-app helper text in child profile form |
| Consent withdrawal mechanics (D4 — TBD) | M11 | Placeholder until D4 is resolved with foundation |

---

## As-Built Divergences

Changes from the original plan that were made during implementation. Future milestones should be read in light of these.

### Platform
- **Target is web**, not native iOS. Expo Go is used for development. `expo-camera` (M7) and `react-native-confetti-cannon` (M8) require a development build when native is needed.

### M2 — Authentication
- **Google OAuth uses two flows**: `ResponseType.IdToken` on web (client sends `id_token` to server for verification via Google tokeninfo API); authorization code + PKCE on native (server exchanges with Google using client secret). The spec originally assumed only the code flow.
- **Token storage fallback**: `expo-secure-store` not available in Expo Go SDK 54; falls back to `AsyncStorage` transparently for development.

### M3 — Onboarding
- **`@spezivibe/onboarding` was not available** in the generated project. `FeatureCard`, `PaginationDots`, `ConsentCheckbox` were built inline in `client/components/onboarding/`.
- **`useOnboardingStatus`**: implemented with `AsyncStorage` key `@dba_onboarding_v1` (not the Spezi package hook). Status is client-side only — does not sync across device reinstalls.
- **Family invite flow through onboarding**: if a `FamilyInvite` token is stored before sign-in, the family screen shows "Accept invite" instead of "Create my family".

### M4 — Groups
- **`GroupMemberFamily` schema enriched**: replaced `admin_user_ids: list[UUID]` with `parents: list[FamilyParentInGroup]` containing `{user_id, display_name, is_group_admin}`. The server batch-fetches Family names and User display names to avoid N+1 queries.
- **Family invite URL corrected**: uses `CLIENT_BASE_URL/join-family?token=` (not `API_BASE_URL/families/join?token=` as originally written).
- **Unauthenticated invite flow** (not in original plan): when an unauthenticated user opens `/join-group?token=X` or `/join-family?token=X`, the RouteGuard stores the token in AsyncStorage. After onboarding completes, `child.tsx` processes the pending token and navigates to the target group.
- **Groups tab auto-refresh**: uses `useFocusEffect` instead of a one-time `useEffect` so the list refreshes whenever navigating back to the tab.
- **Family role removed**: `FamilyMembership.role` (admin/member) was removed entirely. All family members are equal — any member can invite others, anyone can leave, no one can remove another member. The `FamilyRole` enum and `PATCH /families/{id}/members/{user_id}` endpoint no longer exist.
- **Profile tab**: implemented ahead of M10 with a minimal "My Family" section and "Invite to family" button (full profile management remains M10).
- **Group detail admin detection**: `is_admin` flag from server is supplemented client-side by checking if the current user appears as `is_group_admin` in any family's parents list. Own family is identified by `parents[].user_id === currentUser.id`; remove button is hidden for own family.

### M6 — Challenges and Collage View
- **`GET /challenges/active` returns a list**: original spec returned a single `ChallengeWithProgress` (404 when none). Changed to `list[ChallengeWithProgress]` (empty list when none) to support multiple simultaneous active challenges.
- **Multiple collages on Home**: all active challenges rendered as stacked, scrollable cards — not just one.
- **Suggestion derived from collage**: Today's suggestion card picks a random unfulfilled slot activity from active challenges; falls back to `GET /activities/suggestions` only when all slots are complete or no active challenges exist.
- **`CollageGrid` container-responsive sizing**: slot width computed from `onLayout` (actual container width) rather than `Dimensions.get('window').width` minus a hardcoded offset — fixes layout on narrow screens when the grid is inside a padded card.
- **`DELETE /challenges/{id}` added** (not in original plan): only the creating family can delete; cascades to ChallengeActivity rows.
- **Challenge detail extras** (not in original plan): group link (navigates to GroupDetailScreen) and delete button below group progress section.
- **`Completion` model created in M6**: table built alongside Challenge so join queries work immediately; completion endpoints remain 501 until M7.

### M7 — Activity Completion and Photo Upload
- **No `expo-camera`, no development build**: web target uses `expo-image-picker` only. Browser handles camera access via the file input `capture` attribute.
- **Web FormData fix**: on web, `expo-image-picker` returns a `blob:` URI. The React Native `{uri, type, name}` shorthand is native-only; on web it appends `"[object Object]"` as text. Fixed by `fetch(blobUri)` → `Blob` → standard `form.append(blob, filename)`.
- **Pre-signed URLs embedded in responses**: `_completion_dict` generates a pre-signed URL inline whenever `status="ready"` (pure HMAC, no I/O). URLs appear in `GET /challenges/active`, `GET /challenges/{id}`, and `GET /completions/{id}` — no separate `GET /photos/{id}/url` call needed by the client.
- **Background compression uses `asyncio.run()`**: avoids adding `psycopg2` to requirements; each BackgroundTask thread gets its own event loop.
- **`CompleteActivityModal` is an overlay modal**, not a bottom sheet — `@gorhom/bottom-sheet` is native-only.
- **No caption screen**: caption is nullable in the schema; UI omitted for prototype simplicity.
- **`PhotoViewerModal` added** (not in original plan): tapping a filled photo slot opens a contained card modal with full-size photo, Download (fetch blob → anchor click on web), and Delete (`DELETE /completions/{id}`) buttons. Outlined button style (border colour, transparent fill).
- **`DELETE /completions/{id}` added** (not in original plan): removes DB row and S3 photo; slot reverts to empty immediately via `localCompletions` `'deleted'` sentinel.
- **S3 guard**: server returns 503 with a descriptive message when `S3_ENDPOINT_URL` or `S3_BUCKET_NAME` is empty (previously crashed with ValueError 500). Endpoint URL must include `https://` scheme.

---

## Open Questions

- **Weather API provider** (compliance D4 still TBD): `SuggestionService` on the backend should abstract the weather call behind a thin interface so the provider can be swapped. In Milestone 5, implement with a hardcoded season fallback first; add the real weather API call once the provider is confirmed.
- **Deep link domain**: use custom URL scheme (`digitalbalance://`) for the prototype; migrate to universal links for MVP (requires a verified domain with a `.well-known` file).
- **Development build**: required from Milestone 8 for `react-native-confetti-cannon`. Set this up before starting M8. M7 photo upload works without a dev build on web.
- **Compliance TODOs D2–D5, D7**: non-code tasks for the foundation. They do not block implementation but must be resolved before any real user data is collected.
- **Server deployment**: prototype runs locally via Docker Compose during development. Before the first real user test, the server needs to be deployed to a EU-hosted VM with Caddy for TLS. This is not a milestone in this plan but should be tracked separately.
