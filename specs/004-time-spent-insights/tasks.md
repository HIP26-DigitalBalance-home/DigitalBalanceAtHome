# Tasks: Time Spent Insights and Journal Phase-Out

**Input**: Design documents from `specs/004-time-spent-insights/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/time-spent-api.yaml](contracts/time-spent-api.yaml), [quickstart.md](quickstart.md)

**Tests**: Server test tasks are included because the plan and quickstart explicitly require arithmetic, authorization, validation, and journal-preservation coverage. Story tests are listed before implementation and should fail first.

**Organization**: Tasks are grouped by user story so each outcome can be implemented and validated as an incremental slice.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel because it touches different files and has no unmet dependency.
- **[Story]**: Maps to US1–US4 from `spec.md`; setup, foundational, and polish tasks omit the label.
- Every checklist item includes an exact repository path.

---

## Phase 1: Setup — Authoritative Contract and Codegen

**Purpose**: Complete the mandatory contract-first sequence before backend implementation.

**⚠️ GATE**: Do not implement routes, request fields, or response fields until T002 is complete.

- [x] T001 Merge `specs/004-time-spent-insights/contracts/time-spent-api.yaml` into `docs/openapi.yaml`: add the Time Spent tag, `GET /time-spent`, `PUT /time-spent/manual`, all time-spent schemas, a reusable validation-error response, `completed_on` on completion/photo/history schemas, and 1–1,440 constraints plus required self-report duration
- [x] T002 Run the repository-root datamodel-codegen command from `AGENTS.md` to regenerate `server/app/schemas/generated.py`; verify the generated period, insight, manual-time, `completed_on`, and constrained duration models match `docs/openapi.yaml` without hand edits

**Checkpoint**: The authoritative contract and generated schemas are synchronized.

---

## Phase 2: Foundational — Shared Storage and Client Inputs

**Purpose**: Build the schema and reusable client primitives required by multiple stories.

**⚠️ CRITICAL**: Complete this phase before beginning any user-story implementation.

- [x] T003 [P] Create `ManualTimeEntry` with UUID PK, user cascade FK, `(user_id, entry_date)` uniqueness, 1–1,440 minute check, and UTC audit timestamps in `server/app/models/manual_time_entry.py`
- [x] T004 [P] Add required `completed_on: date`, the `(completed_by_user_id, completed_on)` index, and nullable 1–1,440 duration constraint to `server/app/models/completion.py`
- [x] T005 Import `ManualTimeEntry` into model metadata in `server/app/models/__init__.py` after T003
- [x] T006 Write `server/alembic/versions/c9e7a4b2d1f0_add_time_spent.py` after T003–T005: create `manual_time_entries`, add nullable `completed_on`, backfill it from the UTC date of `completed_at`, make it non-null, create the parent/date index, add the nullable completion-duration range check, and implement a journal-safe downgrade
- [x] T007 Update `CompletionRepository.create()` in `server/app/repositories/completion.py` to persist `completed_on`, using a UTC-date fallback only for internal compatibility until all request call sites pass the client-local date
- [x] T008 Update direct demo completion construction in `server/app/services/seed.py` to populate `completed_on` consistently with each seeded `completed_at`
- [ ] T009 Apply the migration against local PostgreSQL and verify its upgrade state using `server/alembic/versions/c9e7a4b2d1f0_add_time_spent.py` and the commands in `specs/004-time-spent-insights/quickstart.md`
- [x] T010 [P] Add client-local date, period navigation, and localized minutes/hours formatting helpers in `client/lib/time-spent-utils.ts` without importing phased-out journal utilities
- [x] T011 [P] Extend the controlled picker in `client/components/duration-picker.tsx` with Custom numeric input, 1–1,440 validation, `120+`→120 behavior, accessible selection labels, and an optional horizontal single-row mode while preserving existing photo-completion usage

**Checkpoint**: New source facts can be stored safely, and both manual and activity flows can reuse the same duration control.

---

## Phase 3: User Story 1 — View Personal Time Spent Trends (Priority: P1) 🎯 MVP

**Goal**: Show the authenticated parent's accurate weekly and monthly time insight at the top of Progress.

**Independent Test**: Seed known activity and manual rows for two parents, request both periods as Parent A, and confirm daily totals, zero days, clipped monthly buckets, rounded weekly average, navigation limits, and Parent B isolation in the Progress chart.

### Tests for User Story 1

- [x] T012 [P] [US1] Add failing unit tests for Monday–Sunday boundaries, current-month clipping, zero filling, reported-duration precedence, estimate fallback, bucket totals, and rounded monthly average in `server/tests/unit/test_time_spent_service.py`
- [x] T013 [P] [US1] Add failing authenticated route tests for weekly/monthly responses, invalid periods, unauthenticated access, and current-parent scoping in `server/tests/integration/test_time_spent_routes.py`

### Implementation for User Story 1

- [x] T014 [US1] Create bounded parent/date aggregation queries for completion contributions and manual values in `server/app/repositories/time_spent.py`, joining activities only for `COALESCE(completion.duration_minutes, activity.estimated_duration_minutes)` and grouping each completion once by `completed_on`
- [x] T015 [US1] Implement weekly/monthly range helpers, zero-filled daily merging, clipped Monday buckets, and nearest-minute average calculation in `server/app/services/time_spent.py` using the repository from T014
- [x] T016 [US1] Create authenticated `GET /time-spent` handling in `server/app/api/time_spent.py` and register its router in `server/app/main.py`; the route must pass only `current_user.id`, `period`, and `anchor_date` to one service call
- [x] T017 [P] [US1] Create typed insight models and `getInsight(period, anchorDate)` in `client/lib/api/time-spent.ts`, then export them from `client/lib/api/index.ts`
- [x] T018 [P] [US1] Add German and English labels for time-spent title, Weekly/Monthly selector, period navigation, average, zero state, and accessible bar descriptions in `client/lib/i18n/de.ts` and `client/lib/i18n/en.ts`
- [x] T019 [US1] Build the themed, accessible weekly/monthly bar visualization with selector, period label, previous/next controls, zero state, and future-navigation guard in `client/components/time-spent-chart.tsx`
- [x] T020 [US1] Render `TimeSpentChart` as the first section in `client/app/progress.tsx`; load it independently from family progress, use a cancellation guard for every async effect, and keep existing goal/streak/all-time sections visible on insight errors
- [ ] T021 [US1] Run `server/tests/unit/test_time_spent_service.py` and the GET cases in `server/tests/integration/test_time_spent_routes.py`, then manually verify Scenario 5 and the Progress portion of Scenario 6 in `specs/004-time-spent-insights/quickstart.md`

**Checkpoint**: US1 is independently usable with seeded/manual database rows and delivers the core read-only insight.

---

## Phase 4: User Story 2 — Add Non-Activity Time from Home (Priority: P1)

**Goal**: Let a parent set or replace today's manual time from a compact home-hero card.

**Depends on**: US1's GET insight contract supplies the card's currently saved value and updates the same daily total.

**Independent Test**: Save a preset and then a custom value as Parent A; confirm one row remains, today's value is replaced, the card and chart update, invalid/failed saves preserve the previous value, and Parent B remains unchanged.

### Tests for User Story 2

- [x] T022 [US2] Add failing manual-upsert service and route tests for create, replacement, concurrent uniqueness behavior, 1–1,440 validation, unauthenticated access, and per-parent isolation in `server/tests/unit/test_time_spent_service.py` and `server/tests/integration/test_time_spent_routes.py`

### Implementation for User Story 2

- [x] T023 [P] [US2] Add an atomic `(user_id, entry_date)` upsert returning the created/updated row in `server/app/repositories/time_spent.py`
- [x] T024 [US2] Add manual-time validation and upsert orchestration to `server/app/services/time_spent.py` without accepting a caller-supplied user ID
- [x] T025 [US2] Implement `PUT /time-spent/manual` in `server/app/api/time_spent.py` using the generated request/response models and the global structured-error handling
- [x] T026 [P] [US2] Add typed `upsertManualTime(entryDate, minutes)` to `client/lib/api/time-spent.ts`
- [x] T027 [P] [US2] Add German and English home-card, Custom input, save confirmation, validation, and retry strings in `client/lib/i18n/de.ts` and `client/lib/i18n/en.ts`
- [x] T028 [US2] Build `client/components/time-spent-card.tsx` with the horizontal `DurationPicker`, explicit save action, today's saved manual value from the weekly insight, optimistic-disabled saving state, cancellation-safe load, and prior-value preservation on failure
- [x] T029 [US2] Replace the rendered `JournalCard` with `TimeSpentCard` in the home hero, refresh local insight state after a successful save, and remove the active journal import from `client/app/(tabs)/index.tsx`
- [ ] T030 [US2] Run the manual PUT cases in `server/tests/unit/test_time_spent_service.py` and `server/tests/integration/test_time_spent_routes.py`, then execute Scenario 2 and the Home portion of Scenario 6 in `specs/004-time-spent-insights/quickstart.md`

**Checkpoint**: Parents can capture and correct non-activity time from Home, and the same value feeds US1.

---

## Phase 5: User Story 3 — Capture Time for Activities Completed Without a Photo (Priority: P1)

**Goal**: Require a valid duration for every self-reported completion and count it once on the parent's original local completion date.

**Independent Test**: Attempt a no-photo completion without duration, then complete it with a 75-minute custom value; confirm the request stores `duration_minutes=75` and `completed_on`, remains self-reported, earns no points, and contributes once to the parent's daily insight through later status/photo operations.

### Tests for User Story 3

- [x] T031 [P] [US3] Add failing request/response tests for required self-report duration/date, photo `completed_on`, range validation, and serialized `completed_on` in `server/tests/integration/test_completion_routes.py`
- [x] T032 [P] [US3] Add failing service tests for self-reported duration persistence, local-date persistence, existing casual-photo duration rules, and unchanged self-reported point exclusion in `server/tests/unit/test_completion_service.py`

### Implementation for User Story 3

- [x] T033 [US3] Extend self-reported/photo completion creation and response/history mapping with `duration_minutes` and `completed_on` in `server/app/services/completion.py` and `server/app/services/challenge.py`, requiring duration for self-reports while leaving photo verification and reward rules unchanged
- [x] T034 [US3] Pass generated `duration_minutes` and `completed_on` fields through JSON self-report creation in `server/app/api/completions.py` and multipart photo creation in `server/app/api/photos.py`
- [x] T035 [P] [US3] Update self-report and photo-upload payloads plus completion/history types with `duration_minutes` and `completed_on` in `client/lib/api/completions.ts` and `client/lib/api/challenges.ts`
- [x] T036 [US3] Update `client/components/complete-activity-modal.tsx` so selecting no-photo reveals the shared picker, blocks submission without valid time, forwards custom minutes, and keeps the existing casual-photo requirement and dedicated-photo behavior
- [x] T037 [P] [US3] Add German and English no-photo duration prompt, required-state, Custom validation, and saved-minute strings in `client/lib/i18n/de.ts` and `client/lib/i18n/en.ts`
- [x] T038 [US3] Update completion callbacks to send client-local `completed_on` and no-photo duration in both `client/app/(tabs)/index.tsx` and `client/app/challenge/[id].tsx`, preserving each screen's current cancellation, polling, celebration, sharing, and local-completion behavior
- [ ] T039 [US3] Run `server/tests/integration/test_completion_routes.py`, `server/tests/unit/test_completion_service.py`, and `server/tests/unit/test_points_service.py`, then execute Scenarios 3 and 4 in `specs/004-time-spent-insights/quickstart.md`

**Checkpoint**: Self-reported activity time is complete, valid, reward-neutral, and visible exactly once in the personal insight.

---

## Phase 6: User Story 4 — Use Simplified History Without Journal UI (Priority: P2)

**Goal**: Present one History list and remove every active journal/mood surface while preserving all dormant journal logic and records.

**Depends on**: US2 replaces the Home journal card; the History simplification itself can be implemented after Foundation in parallel with other client work.

**Independent Test**: Navigate Home, Profile, History, Progress, and the legacy `tab=analyze` deep link in both languages; confirm only completion history remains and the retained journal endpoint still returns pre-existing records.

### Implementation for User Story 4

- [x] T040 [P] [US4] Simplify `client/app/activity-history.tsx` to the paginated completion list only: remove journal imports/state/effects/chart/styles, remove the segment selector, ignore legacy `tab=analyze`, and render the localized History title immediately
- [x] T041 [P] [US4] Relabel the Profile navigation action to History while retaining the internal route compatibility in `client/app/(tabs)/profile.tsx`
- [x] T042 [P] [US4] Replace former Activity/Analyze/journal navigation labels with German `Verlauf` and English `History`, and remove now-unused active-screen mood copy without deleting dormant journal keys needed by retained modules in `client/lib/i18n/de.ts` and `client/lib/i18n/en.ts`
- [x] T043 [P] [US4] Document in `docs/architecture.md` that journal routes, model, repository, service, records, tests, and dormant client modules remain intact while all current frontend entry points are intentionally phased out
- [x] T044 [US4] Audit `client/app/`, `client/components/`, and `client/lib/api/index.ts` for active journal rendering or navigation; retain `client/components/journal-card.tsx`, `client/lib/api/journal.ts`, `server/app/api/journal.py`, and related backend files unchanged and ensure legacy History deep links never expose mood UI
- [ ] T045 [US4] Run `server/tests/integration/test_journal_routes.py` and execute Scenarios 1 and 7 in `specs/004-time-spent-insights/quickstart.md`, comparing journal row counts and values before/after migration

**Checkpoint**: History is single-purpose, the journal is invisible to users, and its dormant capability/data are demonstrably preserved.

---

## Phase 7: Polish and Cross-Cutting Validation

**Purpose**: Verify contract fidelity, privacy, performance, accessibility, and regression safety across all stories.

- [ ] T046 [P] Run `ruff check .`, `ruff format --check .`, and full `pytest` from `server/`; resolve failures only in the feature's modified server files and tests listed in `specs/004-time-spent-insights/plan.md`
- [x] T047 [P] Run `npm run typecheck` and `npm run lint` from `client/`; resolve errors in the modified client files listed in `specs/004-time-spent-insights/plan.md`
- [ ] T048 Run Schemathesis against `docs/openapi.yaml` and the local API, then correct any time-spent or completion-contract mismatch in `docs/openapi.yaml` before regenerating `server/app/schemas/generated.py`
- [ ] T049 Exercise migration upgrade and downgrade on a disposable local database, verifying completion counts, backfilled dates, constraints, manual-entry cascade, and unchanged journal rows against `server/alembic/versions/c9e7a4b2d1f0_add_time_spent.py`
- [ ] T050 Execute all eight end-to-end scenarios, including two-parent isolation, no-data periods, save failure, current-month averaging, legacy deep links, and journal preservation, from `specs/004-time-spent-insights/quickstart.md`
- [ ] T051 Validate the two-second Progress target, one-month bounded response, screen-reader bar labels, large text, German/English layout, and absence of group/family disclosure in `client/components/time-spent-chart.tsx`, `client/components/time-spent-card.tsx`, and `client/app/progress.tsx`

---

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately; T001 → T002 is a hard contract/codegen gate.
- **Foundational (Phase 2)**: Depends on Setup and blocks all story work. T003 and T004 can run together; T005 and T006 follow the models; T007/T008 follow the completion field; T009 verifies storage; T010/T011 are independent shared client work.
- **US1 (Phase 3)**: Depends on Foundation only.
- **US2 (Phase 4)**: Depends on Foundation and US1's GET insight path because the Home card reads today's saved value from that response.
- **US3 (Phase 5)**: Depends on Foundation only and can run in parallel with US1; its final insight validation uses US1 when available.
- **US4 (Phase 6)**: History simplification depends on Foundation only, but its complete Home journal-removal acceptance test depends on US2.
- **Polish (Phase 7)**: Depends on all selected story phases.

### User Story Dependency Graph

```text
Setup → Foundation ─┬─→ US1 ─→ US2 ─┐
                    ├─→ US3 ────────┼─→ Polish
                    └─→ US4 ────────┘

US4 full acceptance also observes US2's Home replacement.
```

### Within Each User Story

- Write the story's tests first and confirm they fail for the expected reason.
- Implement repository/model behavior before service logic.
- Implement service logic before route integration.
- Implement typed client access before screen/component integration.
- Complete the story checkpoint before treating the story as deliverable.

### Parallel Opportunities

- Foundation: T003/T004/T010/T011 touch independent files and can run concurrently.
- After Foundation: US1 server work, US3 completion work, and US4 History work can proceed in parallel.
- US1: T012/T013 tests can run together; T017/T018 client API/translations can run alongside T014–T016 server work.
- US2: T026/T027 can run alongside T023–T025 after T022 establishes expected behavior.
- US3: T031/T032 tests run together; T035/T037 client work can run alongside T033/T034 server work.
- US4: T040–T043 touch separate files and can run together; T044 reconciles them afterward.
- Polish: T046 and T047 can run concurrently; T048–T051 follow the integrated build.

---

## Parallel Examples

### User Story 1

```text
Task T012: Write service arithmetic tests in server/tests/unit/test_time_spent_service.py
Task T013: Write GET route tests in server/tests/integration/test_time_spent_routes.py
Task T017: Create typed client GET API in client/lib/api/time-spent.ts
Task T018: Add insight translations in client/lib/i18n/de.ts and client/lib/i18n/en.ts
```

### User Story 2

```text
Task T023: Add atomic manual upsert in server/app/repositories/time_spent.py
Task T026: Add typed client PUT API in client/lib/api/time-spent.ts
Task T027: Add home-card translations in client/lib/i18n/de.ts and client/lib/i18n/en.ts
```

### User Story 3

```text
Task T031: Write completion route tests in server/tests/integration/test_completion_routes.py
Task T032: Write completion service tests in server/tests/unit/test_completion_service.py
Task T035: Update client completion payloads in client/lib/api/completions.ts
Task T037: Add completion-duration translations in client/lib/i18n/de.ts and client/lib/i18n/en.ts
```

### User Story 4

```text
Task T040: Simplify client/app/activity-history.tsx
Task T041: Relabel client/app/(tabs)/profile.tsx
Task T043: Document the phase-out in docs/architecture.md
```

---

## Implementation Strategy

### MVP First: User Story 1

1. Complete Setup and Foundation.
2. Complete US1 and seed manual/activity rows directly for validation.
3. Stop and verify weekly/monthly arithmetic, privacy, accessibility, and Progress failure isolation.
4. Demo the read-only personal insight if an early checkpoint is needed.

### Product-Complete P1 Slice

1. Add US2 so parents can enter non-activity time from Home.
2. Add US3 so self-reported activity time is complete and accurate.
3. Re-run US1 totals using both live input sources.
4. This US1+US2+US3 slice delivers the complete time-spent feature before the P2 History cleanup.

### Incremental Delivery

1. Setup + Foundation → contract and storage ready.
2. US1 → private read-only insight.
3. US2 → manual input loop.
4. US3 → complete activity-duration coverage.
5. US4 → journal-free frontend and simplified History.
6. Polish → full contract, privacy, performance, accessibility, and migration validation.

## Notes

- `[P]` means different files and no unmet dependencies; tasks modifying the same i18n/API files across phases remain sequential by phase.
- The journal backend and stored data are preservation targets, not cleanup targets.
- `docs/openapi.yaml` always wins over implementation; regenerate schemas after every contract correction.
- Do not add time goals, rewards, reminders, child-specific totals, family aggregates, or past-date editing.
- Commit after each task or coherent task group, and stop at any checkpoint for independent validation.
