# Tasks: Progress Section

**Input**: Design documents from `specs/001-progress-section/`

**Prerequisites**: plan.md ✓ spec.md ✓ research.md ✓ data-model.md ✓ contracts/ ✓ quickstart.md ✓

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story. Each story is independently testable once foundational phase is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on in-progress tasks)
- **[Story]**: Which user story this task belongs to
- Paths use `server/` and `client/` relative to repo root

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Spec contract, generated schemas, DB migration. MUST be complete before any backend or client implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Merge `specs/001-progress-section/contracts/progress-api.yaml` snippets into `docs/openapi.yaml` — add `FamilyProgress`, `WeekStats`, `StreakStats`, `AllTimeStats`, `FamilySettingsUpdate` schemas and `GET /families/{familyId}/progress` + `PATCH /families/{familyId}/settings` paths
- [x] T002 Run codegen to regenerate `server/app/schemas/generated.py` (command in CLAUDE.md)
- [x] T003 Add 6 new columns to `Family` model in `server/app/models/family.py`: `weekly_goal` (Integer, default 2), `streak_weeks` (Integer, default 0), `last_streak_weeks` (Integer, nullable), `longest_streak_weeks` (Integer, default 0), `last_activity_iso_week` (Varchar 10, nullable), `last_frozen_iso_week` (Varchar 10, nullable)
- [x] T004 Create Alembic migration `server/alembic/versions/<hash>_add_progress_fields.py` — `alembic revision --autogenerate -m "add progress fields to families"`
- [x] T005 Apply migration via Docker Compose — `docker compose exec api alembic upgrade head` — verify with `\d families` in psql

**Checkpoint**: `GET /families/{familyId}` still returns 200; new columns exist in DB with correct defaults; `generated.py` contains `FamilyProgress`, `FamilySettingsUpdate`.

---

## Phase 2: User Story 1 — Home Screen Progress Snapshot (Priority: P1) 🎯 MVP

**Goal**: Streak counter and goal ring appear on the home screen with correct values after any completion.

**Independent Test**: Open app → complete one activity → home screen shows ring at 1/2 and streak at 1. Both parents in the family see the same values (quickstart.md Scenario 1 + 3).

### Implementation

- [x] T006 [P] Create `server/app/repositories/progress.py` — two async functions: `get_this_week_stats(family_id, session)` (COUNT completions since Monday 00:00 UTC, split by photo_key IS NOT NULL) and `get_all_time_stats(family_id, session)` (COUNT completions, photos, DISTINCT challenge_ids via challenge_activities join)
- [x] T007 [P] Add `get_by_id_with_lock(family_id, session)` to `server/app/repositories/family.py` — `SELECT … FOR UPDATE` to serialise concurrent streak writes by two parents
- [x] T008 Create `server/app/services/progress.py` — `get_progress(family_id, session)` assembles `FamilyProgress` response from Family columns + progress repo queries; include `iso_week_utils` helpers (`current_iso_week()`, `previous_iso_week(week_str)`) per research.md Decision 2
- [x] T009 Create `server/app/api/progress.py` — `GET /families/{familyId}/progress` route: verify caller is a member of the family, call `progress_service.get_progress()`, return `FamilyProgress` schema
- [x] T010 Register progress router in `server/app/main.py` with `prefix="/families"`
- [x] T011 Modify `server/app/services/completion.py` — after flushing new Completion, call `family_repo.get_by_id_with_lock()` then apply full streak state machine from `data-model.md` (handles consecutive weeks, freeze-void branch, longest streak update); commit within same transaction
- [x] T012 [P] Create `client/lib/api/progress.ts` — `progressApi.getProgress(familyId)` → `GET /families/{familyId}/progress`; type the response as `FamilyProgress` matching the OpenAPI schema
- [x] T013 [P] Export `progressApi` and `FamilyProgress` type from `client/lib/api/index.ts`
- [x] T014 [P] Create `client/components/progress-ring.tsx` — SVG ring using `react-native-svg`; props: `value: number`, `goal: number`, `size?: number`; renders a background track arc and a filled progress arc from 0° to `(value/goal)*360°`; clamps at full when `value >= goal`
- [x] T015 [P] Add all progress-related i18n strings to `client/lib/i18n/de.ts` and `client/lib/i18n/en.ts` — home widget labels (streak, goal ring caption), progress page section titles (This Week, Your Streak, All Time), counter labels (activities, photos, challenges, weeks)
- [x] T016 Modify `client/app/(tabs)/index.tsx` — on `useFocusEffect`, fetch `progressApi.getProgress(familyId)` alongside challenges; render a compact row above the collage section with: `ProgressRing` component (value=this_week.activities, goal=weekly_goal) and streak counter chip (current_weeks + flame icon); show skeleton while loading; hide row if family has no progress data yet (streak=0 and no activity this week)

**Checkpoint**: Home screen shows ring and streak. Completing an activity updates both values. Quickstart Scenarios 1 and 3 pass.

---

## Phase 3: User Story 2 — Full Progress Dashboard (Priority: P2)

**Goal**: A dedicated progress screen with three sections (This Week, Your Streak, All Time) accessible from the profile tab.

**Independent Test**: Navigate to progress screen → verify all three sections render with accurate values matching `GET /families/{familyId}/progress` response (quickstart.md Scenario 2).

### Implementation

- [x] T017 Create `client/app/progress.tsx` — full progress screen with three sections using data from `progressApi.getProgress()`: (1) **This Week** — `ProgressRing` + "N activities" + "N photos"; (2) **Your Streak** — large `current_weeks` counter + "longest: N weeks" alongside + frozen indicator when `frozen_this_week=true`; (3) **All Time** — three stat cards (activities, photos, challenges); use `useFocusEffect` for data fetch
- [x] T018 Add navigation entry point to progress screen in `client/app/(tabs)/profile.tsx` — a tappable row/button that pushes `router.push('/progress')`
- [x] T019 [P] Add progress screen i18n strings to `client/lib/i18n/de.ts` and `client/lib/i18n/en.ts` — any strings not already added in T015 (e.g. "last streak: X weeks", "frozen this week" label)

**Checkpoint**: Profile tab has a "Progress" entry; tapping it opens the progress screen; all three sections show correct values. Quickstart Scenario 2 passes.

---

## Phase 4: User Story 3 — Weekly Goal Setup During Onboarding (Priority: P2)

**Goal**: Family sets their weekly activity target during onboarding. The chosen goal becomes the ring denominator.

**Independent Test**: Complete onboarding → choose goal of 3 → home screen ring shows `0/3`; PATCH goal to 1 → ring shows `1/1` (if one activity done). Quickstart Scenario 4 passes.

### Implementation

- [x] T020 Add `PATCH /families/{familyId}/settings` handler to `server/app/api/progress.py` — parse `FamilySettingsUpdate` body, validate `weekly_goal >= 1`, update `family.weekly_goal`, return 204; verify caller is a family member
- [x] T021 [P] Add `progressApi.updateSettings(familyId, payload)` to `client/lib/api/progress.ts` — `PATCH /families/{familyId}/settings` with `{ weekly_goal: number }` body
- [x] T022 Create `client/app/(onboarding)/goal.tsx` — simple screen with a title, subtitle, and 4 selectable options (1, 2, 3, 4); default selection is 2; on confirm, calls `progressApi.updateSettings(familyId, { weekly_goal: selected })` then navigates to the next onboarding step
- [x] T023 Insert goal screen into onboarding flow in `client/app/(onboarding)/_layout.tsx` — add `goal` after the `child` step and before the group-join step; ensure back navigation works correctly
- [x] T024 [P] Add onboarding goal step i18n strings to `client/lib/i18n/de.ts` and `client/lib/i18n/en.ts` — screen title, subtitle, option labels, confirm button

**Checkpoint**: Onboarding completes without breaking existing steps. Chosen goal is persisted. Home screen ring denominator matches selected goal. Quickstart Scenario 4 passes.

---

## Phase 5: User Story 4 — Automatic Streak Freeze (Priority: P3)

**Goal**: Families with an active streak that go a week without any activity get an automatic freeze on Sunday evening (unless last week was also frozen, in which case the streak resets).

**Independent Test**: Trigger freeze job manually with `last_activity_iso_week = previous week` and `last_frozen_iso_week = NULL` → streak preserved; trigger again with `last_frozen_iso_week = previous week` → streak resets to 0 with `last_weeks` populated. Quickstart Scenarios 5, 6, 7 pass.

### Implementation

- [x] T025 Add `run_freeze_job(session)` to `server/app/services/progress.py` — query all families where `streak_weeks > 0`; for each: compute `current_iso_week` and `previous_iso_week`; apply freeze-or-reset logic from `data-model.md`; bulk-commit; add a `trigger_freeze_job()` dev endpoint or service entry point for manual testing
- [x] T026 Register Sunday 21:00 UTC background asyncio task in `server/app/main.py` lifespan — same pattern as other background jobs in the project; loop wakes weekly; calls `run_freeze_job` within a DB session
- [x] T027 [P] Update `client/app/(tabs)/index.tsx` — when `streak.frozen_this_week = true`, show a small "❄️ frozen" label or distinct chip colour alongside the streak counter
- [x] T028 [P] Update `client/app/progress.tsx` — in the "Your Streak" section, show "last streak: N weeks" beneath the counter when `streak.last_weeks != null`; show freeze indicator when `streak.frozen_this_week = true`
- [x] T029 [P] Add freeze i18n strings to `client/lib/i18n/de.ts` and `client/lib/i18n/en.ts` — "frozen this week", "last streak: {{count}} weeks"

**Checkpoint**: Sunday freeze job runs without error. Freeze state surfaces on home screen and progress page. Quickstart Scenarios 5, 6, 7 pass.

---

## Phase 6: Polish & Cross-Cutting

- [x] T030 Run quickstart.md validation — work through all 7 scenarios end-to-end and confirm expected responses match
- [x] T031 [P] Run `ruff check . && ruff format .` in `server/` — fix any lint issues in new/modified files
- [x] T032 [P] Run `npx tsc --noEmit` in `client/` — confirm no TypeScript errors in new/modified files
- [x] T033 [P] Verify `GET /families/{familyId}` is unaffected (no progress fields leaked into existing family response schema)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Requires Phase 1 complete — BLOCKS home screen widget
- **US2 (Phase 3)**: Requires Phase 1; US1 preferred first (shares `progressApi` client)
- **US3 (Phase 4)**: Requires Phase 1; can run in parallel with US2
- **US4 (Phase 5)**: Requires Phase 1 + US1 (streak update logic in T011 must exist before freeze job makes sense)
- **Polish (Phase 6)**: Requires all desired stories complete

### Within Phase 2 (US1)

```
T006 ──┐
T007 ──┼──► T008 ──► T009 ──► T010
T011 ──┘
T012 ──┐
T013   ├──► T016
T014 ──┘
T015 (i18n, no deps within phase)
```

### Parallel Opportunities Per Phase

**Phase 1**: T003 can start while T001/T002 run sequentially (model change doesn't need generated.py).

**Phase 2 (US1)**: T006, T007, T011, T012, T013, T014, T015 all parallelisable at phase start. T008 unblocks after T006+T007. T016 (home screen) needs T009+T012+T013+T014 done.

**Phase 3 (US2)**: T017, T018, T019 all parallelisable.

**Phase 4 (US3)**: T021, T024 parallelisable from phase start. T022 needs T021. T023 needs T022.

**Phase 5 (US4)**: T027, T028, T029 all parallelisable from phase start. T026 needs T025.

---

## Implementation Strategy

### MVP (US1 only — home screen widget)

1. Complete Phase 1 (Foundational) — ~2 hours
2. Complete Phase 2 (US1) — ~4 hours
3. **Validate**: quickstart.md Scenarios 1 and 3

### Incremental Delivery

1. Phase 1 → Phase 2 (US1) → home screen widget live ✓
2. Phase 3 (US2) → progress page accessible from profile ✓
3. Phase 4 (US3) → onboarding goal step live ✓
4. Phase 5 (US4) → freeze mechanic live ✓
5. Phase 6 — polish

### Parallel Team Strategy (2 developers)

Once Phase 1 is done:
- **Dev A**: Phase 2 backend (T006–T011) then Phase 4 backend (T020)
- **Dev B**: Phase 2 frontend (T012–T016) then Phase 3 frontend (T017–T019)

---

## Notes

- `[P]` tasks touch different files and have no dependency on in-progress tasks in the same phase
- Spec-driven rule: `docs/openapi.yaml` (T001) and codegen (T002) MUST precede all route implementation
- Streak update in T011 handles the freeze-void branch even though the freeze job (T025) isn't built until Phase 5 — the branch simply never fires until then
- `weekly_goal` defaults to `2` in the DB, so US1 is independently testable without US3 being complete
