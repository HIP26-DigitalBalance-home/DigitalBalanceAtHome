# Tasks: Family Points & Reward Levels (Demo Scope)

**Input**: Design documents from `specs/003-rewards-system/`

**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/rewards-api.yaml](contracts/rewards-api.yaml) · [quickstart.md](quickstart.md)

**Tests**: Not explicitly requested in the feature spec; no test-writing tasks are included below. `pytest`/manual quickstart validation appears in the Polish phase per CLAUDE.md's testing conventions.

**Format**: `[ID] [P?] [Story?] Description with file path`
- **[P]**: Parallelisable — different files, no unmet dependencies
- **[Story]**: User story label (US1–US4); omitted for setup/foundational/polish tasks

**Note on phase order vs. spec order**: Stories are implemented as US1 → **US3 → US2** → US4, not the spec's US1/US2/US3/US4 listing order. Reason: US2's `approve()` action must synchronously award points, so it depends on US3's tier-resolution and ledger service (mirrors `plan.md` Phase B, where `points.py` is built at step 10, before `verification.py` at step 11). All three are P1 in the spec; only the build sequence changes, not priority.

---

## Phase 1: Setup — API Contract & Codegen

**Purpose**: Satisfy the mandatory spec-driven workflow gate. No backend or client code may be written until T002 is complete.

**⚠️ GATE**: `docs/openapi.yaml` must be updated and codegen must have run before any route or schema implementation.

- [X] T001 Merge `specs/003-rewards-system/contracts/rewards-api.yaml` into `docs/openapi.yaml`: extend the `CompletionStatus` enum (add `pending_verification`, `verified`, `rejected`; remove `ready`); add `duration_minutes` and `rejection_reason` to the completion upload request and `Completion`/`CompletionHistoryItem` schemas; add new schemas (`PendingVerificationItem`, `VerificationQueue`, `RejectPayload`, `RewardLevel`, `RewardLevelProgress`, `RewardsBalance`, `RedeemPayload`, `RedemptionResult`); add all 5 new/modified paths
- [X] T002 Run codegen from repo root (`datamodel-codegen --input docs/openapi.yaml ...` per CLAUDE.md) to regenerate `server/app/schemas/generated.py`; verify the updated `CompletionStatus` enum, `RewardsBalance`, and `RedemptionResult` are present

**Checkpoint**: Codegen complete — all phases can now proceed

---

## Phase 2: Foundational — Schema, Models & Migration

**Purpose**: Database schema and ORM models that ALL user stories depend on. Must complete before any service or repository code.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Add `effort_tier: Mapped[str]` (NOT NULL; values `casual | dedicated`) to `server/app/models/activity.py`
- [X] T004 [P] Add `is_featured: Mapped[bool]` (NOT NULL, default False) to `server/app/models/challenge.py`
- [X] T005 [P] Add `duration_minutes: Mapped[int | None]` (nullable) to `server/app/models/completion.py`; update the `status` column comment to `processing | pending_verification | verified | rejected | self_reported`
- [X] T006 [P] Create `server/app/models/rewards.py` with 4 ORM models: `PointLedgerEntry` (unique on `completion_id`), `RewardLevel`, `Redemption` (unique on `family_id, reward_level_id, quarter_key`), `PhotoVerification` — see `data-model.md` for full column specs; all PKs use `UUID(as_uuid=True)` + `default=uuid.uuid4`; all timestamps use `DateTime(timezone=True)`
- [X] T007 Update `server/app/models/__init__.py` to import all 4 new models from `rewards.py` (depends on T006)
- [X] T008 Write single Alembic migration `server/alembic/versions/<hash>_add_rewards_system.py` (depends on T003–T007): `ALTER TABLE activities ADD COLUMN effort_tier`; data-migration backfill of `effort_tier = 'dedicated'` for the seed activities identified in OD-101 (title match, same pattern as `relink_collage_presets.py`), else `'casual'`; `ALTER TABLE challenges ADD COLUMN is_featured`; `ALTER TABLE completions ADD COLUMN duration_minutes`; data migration `UPDATE completions SET status = 'verified' WHERE status = 'ready'`; `CREATE TABLE point_ledger_entries, reward_levels, redemptions, photo_verifications`; seed the 4 `reward_levels` rows (50/100/150/250 per `data-model.md`)
- [X] T009 Run `alembic upgrade head` to verify the migration applies cleanly against a local Docker Compose Postgres

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: US1 — Family Sees Completion Verification Status in Collage (Priority: P1) 🎯 MVP

**Goal**: The completion status machine is live end-to-end. Families see photo verification state in the collage and can re-upload rejected photos.

**Independent Test**: Upload a photo → poll and get `pending_verification` (not `ready`); collage shows clock badge. (Full manual verification of the reject/re-upload cycle also requires the admin actions built in Phase 5 — the status machine and UI here are what makes those actions visible.) Re-upload on a `verified` completion keeps status unchanged.

### Implementation

- [X] T010 [US1] Update status guards in `server/app/services/completion.py`: `_completion_dict` (photo URL gated on `status in ("pending_verification", "verified", "rejected")`), `get_photo_url`, `get_group_feed`, `get_my_history` (same guard)
- [X] T011 [US1] Update `_compress_async` in `server/app/services/completion.py` to set `completion.status = "pending_verification"` (was `"ready"`)
- [X] T012 [US1] Update `delete_completion` in `server/app/services/completion.py`: add `"pending_verification"` and `"verified"` to the photo-delete guard
- [X] T013 [US1] Add `update_photo(session, user_id, completion_id, photo_data, content_type)` to `server/app/services/completion.py`: `verified` → update `photo_key` only, status unchanged; `rejected` → re-trigger compression pipeline, reset status to `processing`; `pending_verification` → re-trigger pipeline; `self_reported` → raise a new `CannotReuploadSelfReported` domain error in `server/app/services/exceptions.py`
- [X] T014 [US1] Add `PATCH /completions/{completion_id}/photo` route to `server/app/api/completions.py`: multipart form upload; calls `completion_service.update_photo()`; returns `{ completion_id, status }`
- [X] T015 [P] [US1] Update `client/lib/api/completions.ts`: replace `'ready'` with `'pending_verification'` in the status union; add `'verified'` and `'rejected'`; add `rejection_reason: string | null` to `Completion`; add `reuploadPhoto(completionId: string, imageUri: string)` (multipart `PATCH`); update polling resolve condition from `status === 'ready'` to `status !== 'processing'`
- [X] T016 [P] [US1] Update `client/components/collage-grid.tsx`: clock icon overlay for `pending_verification`, green checkmark for `verified`, red tint + "!" badge for `rejected` (tappable → opens `ReuploadModal`)
- [X] T017 [P] [US1] Create `client/components/reupload-modal.tsx`: receives `completionId` and `rejectionReason`; displays the reason; "Neues Foto hochladen" button triggers `reuploadPhoto()`; on success, dismiss + refresh callback
- [X] T018 [P] [US1] Add verification-status i18n strings (`pending`, `verified`, `rejected`, `rejectionReason`, `reupload`, `reuploadButton`) to `client/lib/i18n/de.ts` and `en.ts`

**Checkpoint**: Status machine live. Collage reflects all new states. Re-upload flows work (full loop testable once Phase 5's admin actions exist).

---

## Phase 4: US3 — Family Earns Points by Fixed Activity Tiers (Priority: P1)

**Goal**: Tier resolution, the 30-minute casual gate, and the point ledger exist and are ready to be invoked by verification.

**Independent Test**: Directly invoke `points.award_points()` (or a temporary script) against one completion of each tier — casual ≥ 30 min, casual < 30 min, dedicated, marketplace, and one inside a featured challenge — and confirm the ledger shows 3 / 0 / 6 / 15 / base+5 points respectively, with exactly one ledger row per completion.

### Implementation

- [X] T019 [P] [US3] Create `server/app/repositories/rewards.py` with ledger methods: `create_ledger_entry(session, family_id, completion_id, base_points, bonus_points, awarded_at)` (relies on the unique constraint on `completion_id` for idempotency), `get_quarter_balance(session, family_id, quarter_start, quarter_end) -> int`, `list_quarter_ledger(session, family_id, quarter_start, quarter_end)`
- [X] T020 [US3] Create `server/app/services/points.py` (depends on T019): `resolve_tier(activity) -> Literal["casual", "dedicated", "marketplace"]` (marketplace if `cost_indicator == "paid" or is_partner_content`, else `activity.effort_tier`); `compute_points(activity, challenge, duration_minutes) -> tuple[int, int]` (base, bonus — casual base is 0 if `duration_minutes` is `None` or `< 30`; dedicated = 6; marketplace = 15; bonus = 5 if `challenge.is_featured` else 0); `award_points(session, completion) -> None` (resolves tier, computes points, calls `create_ledger_entry`)
- [X] T021 [US3] Update the completion upload entrypoint in `server/app/services/completion.py` to accept and persist `duration_minutes`; validate (via `resolve_tier`) that it is present when the activity's tier is `casual`, raising a new `DurationRequired` domain error in `server/app/services/exceptions.py` otherwise
- [X] T022 [US3] Update the completion upload route in `server/app/api/completions.py` to accept `duration_minutes` from the request and pass it through to the service
- [X] T023 [P] [US3] Update `client/lib/api/completions.ts`: add `duration_minutes` to the upload call signature and to the `Completion`/`CompletionHistoryItem` types
- [X] T024 [P] [US3] Create `client/components/duration-picker.tsx`: dropdown with options 15 / 30 / 45 / 60 / 90 / 120+ minutes (OD-105)
- [X] T025 [US3] Wire `DurationPicker` into the existing photo-upload flow: show it (and require a selection before submit) when the activity being completed resolves to the casual tier

**Checkpoint**: Tier resolution, the 30-minute gate, and the ledger exist and are unit-verifiable. Nothing awards points automatically yet — that wiring happens in Phase 5.

---

## Phase 5: US2 — Admin Reviews and Verifies Completion Photos (Priority: P1)

**Goal**: Group admins can review pending photos and approve (awarding points via US3's `points.award_points`) or reject (with a reason) them. Personal/family challenges auto-approve on a timed policy.

**Depends on**: Phase 4 (`points.award_points`) for the approve action to award points.

**Independent Test**: Submit a photo completion as a family in a group challenge, log in as the group admin, approve or reject it via the queue, and verify the family's ledger changes (or doesn't, on reject) accordingly. Separately, submit a completion in a personal challenge and confirm it auto-approves after the timed window.

### Implementation

- [X] T026 [P] [US2] Add verification-audit methods to `server/app/repositories/rewards.py`: `list_pending_verifications(session, group_id, limit, offset)`, `create_photo_verification(session, completion_id, reviewer_user_id, action, rejection_reason, policy_type, reviewed_at)`
- [X] T027 [P] [US2] Create `server/app/services/verification_policy.py`: `VerificationPolicy(ABC)` with `policy_type: str` and `async should_auto_approve(completion, challenge, session) -> bool`; `TimedVerificationPolicy(hours=24)` (checks `completed_at + hours <= now`); `NeverAutoApprovePolicy` (always `False`, `policy_type = "manual"`); `get_policy(challenge) -> VerificationPolicy` factory branching on `challenge.group_id is None`
- [X] T028 [US2] Create `server/app/services/verification.py` (depends on T020, T026, T027): `approve(session, admin_user_id, completion_id, group_id)` — sets status `verified`, calls `points.award_points`, creates an audit record via `create_photo_verification`; `reject(session, admin_user_id, completion_id, group_id, reason)` — sets status `rejected`, requires a non-empty reason, creates an audit record; `run_auto_approvals(session)` — queries `pending_verification` completions on challenges with `group_id IS NULL` past their policy's window, calls `approve()` with `reviewer_user_id=None`
- [X] T029 [US2] Create `server/app/api/rewards.py` with verification routes: `GET /groups/{group_id}/verification-queue` (paginated), `POST /groups/{group_id}/verification-queue/{completion_id}/approve`, `POST /groups/{group_id}/verification-queue/{completion_id}/reject`; all admin-checked via the existing `NotGroupAdmin` exception pattern
- [X] T030 [US2] Update `server/app/main.py`: register the rewards router; add an hourly auto-approval asyncio background task in the lifespan (`run_auto_approvals`, matching the existing lifespan-task pattern)
- [X] T031 [P] [US2] Create `client/lib/api/rewards.ts` with `getVerificationQueue(groupId, limit, offset)`, `approvePhoto(groupId, completionId)`, `rejectPhoto(groupId, completionId, reason)`
- [X] T032 [US2] Update `client/lib/api/index.ts` to export the `rewards` API
- [X] T033 [US2] Create `client/app/group/[id]/admin.tsx` (visible only when `is_admin: true`): verification queue — photo, family name (no child names), activity title, reported duration, submission date; approve button; reject button opening an inline reason input
- [X] T034 [P] [US2] Add verification-queue i18n strings (`queue`, `noQueue`, `approve`, `reject`, `reason`, `duration`) to `client/lib/i18n/de.ts` and `en.ts`

**Checkpoint**: US1 + US3 + US2 together form the complete verify-and-earn loop — collage badges now reflect real admin actions, and approved completions actually credit the family's ledger.

---

## Phase 6: US4 — Family Views Quarter Balance, Level Progress, and Redeems Rewards (Priority: P2)

**Goal**: Families see their current-quarter balance and progress toward the 4 seeded reward levels, and can redeem an unlocked level for a placeholder voucher code without debiting the balance.

**Independent Test**: Earn ≥ 50 points in the current quarter (via Phases 4–5), open the rewards screen, confirm Level 1 shows unlocked and Levels 2–4 show progress, redeem Level 1, and confirm a voucher code is displayed, a redemption record exists, and the balance is unchanged. Confirm a second redemption of the same level in the same quarter is blocked, and (separately) that a 4th Level 4 redemption within a calendar year is blocked.

### Implementation

- [X] T035 [US4] Add level/redemption methods to `server/app/repositories/rewards.py`: `list_reward_levels(session)`, `count_family_redemptions_quarter(session, family_id, reward_level_id, quarter_key) -> int`, `count_family_redemptions_year(session, family_id, reward_level_id, year) -> int`, `create_redemption(session, family_id, reward_level_id, quarter_key, chosen_option, points_at_redemption, voucher_code, redeemed_at)`
- [X] T036 [US4] Add domain exceptions to `server/app/services/exceptions.py`: `LevelLocked`, `AlreadyRedeemedThisQuarter`, `AnnualCapReached`, `ChoiceRequired`
- [X] T037 [US4] Create `server/app/services/rewards.py` (depends on T035, T036): `get_balance_and_progress(session, family_id) -> RewardsBalance` (quarter balance via `get_quarter_balance` + per-level `locked | unlocked | redeemed_this_quarter` state); `redeem(session, family_id, reward_level_id, chosen_option=None) -> RedemptionResult` (checks unlock, checks quarter uniqueness via `count_family_redemptions_quarter`, checks the Level 4 annual cap via `count_family_redemptions_year`, requires `chosen_option` when the level has `choice_options`, generates a placeholder `BOND-XXXXXX` voucher code, creates the redemption record)
- [X] T038 [US4] Add rewards routes to `server/app/api/rewards.py`: `GET /rewards/balance` (family-scoped via `current_user`, not group-scoped), `POST /rewards/levels/{level_id}/redeem`
- [X] T039 [P] [US4] Add `getRewardsBalance()` and `redeemLevel(levelId, chosenOption?)` to `client/lib/api/rewards.ts`
- [X] T040 [US4] Create `client/app/rewards.tsx` (family-level screen, not group-scoped): quarter balance header, 4-level progress list, Level 3 choice picker, Level 4 annual-cap messaging, redeem button per unlocked level, confirmation dialog showing the voucher code
- [X] T041 [US4] Add a "Prämien" / "Rewards" navigation entry point to `client/app/rewards.tsx` — placement TBD during implementation (main tab bar, profile, or group screen; rewards are family-global, not group-scoped, per the revised spec)
- [X] T042 [US4] Update `client/app/(tabs)/profile.tsx` and `client/lib/auth/auth-context.tsx` to stop reading `points_balance` (FR-019): repoint the profile's points display to `getRewardsBalance()` or remove it in favor of the new rewards screen
- [X] T043 [P] [US4] Add rewards i18n strings (`balance`, `levels`, `redeem`, `redeemConfirm`, `redeemSuccess`, `voucherCode`, `locked`, `unlocked`, `alreadyRedeemed`, `annualCapReached`, `chooseOption`) to `client/lib/i18n/de.ts` and `en.ts`

**Checkpoint**: All 4 user stories complete — the full demo loop (upload → verify → earn → redeem) works end-to-end.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T044 [P] Run all 6 scenarios in `specs/003-rewards-system/quickstart.md` end-to-end against a local Docker Compose stack
- [X] T045 [P] Update `server/scripts/seed_dev.py` to set `effort_tier` on demo activities and flag at least one seeded challenge `is_featured = true`, so the demo has a visible bonus-point path
- [X] T046 `ruff check .` and `ruff format .` clean on all new/modified server files
- [X] T047 [P] Add pytest coverage for: tier resolution (`resolve_tier`/`compute_points`), the 30-minute gate, ledger idempotency (duplicate `create_ledger_entry` on the same `completion_id`), quarter-boundary math, the Level 3 choice requirement, and the Level 4 annual cap

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — blocks everything (codegen gate)
- **Foundational (Phase 2)**: Depends on Setup — blocks all user stories
- **US1 (Phase 3)**: Depends on Foundational only
- **US3 (Phase 4)**: Depends on Foundational only (independent of US1)
- **US2 (Phase 5)**: Depends on Foundational **and** US3 (T028 calls `points.award_points` from T020)
- **US4 (Phase 6)**: Depends on Foundational and US3 (reads the ledger); does not require US2 to be code-complete, but needs verified completions to exist for meaningful manual testing
- **Polish (Phase 7)**: Depends on all four stories

### Parallel Opportunities

- All Foundational model tasks T003–T006 are `[P]` (different files)
- Within US1: T015–T018 (client) are `[P]` and can run alongside T010–T014 (server) once both start from the same Foundational base
- Within US3: T023–T024 (client) are `[P]` alongside T019–T022 (server)
- Within US2: T026–T027 (server) are `[P]`; T031 and T034 are `[P]`
- Within US4: T039 and T043 are `[P]`
- US1 and US3 phases have no dependency on each other and could be built in parallel by two developers once Phase 2 is done; US2 must wait for US3's T020

---

## Parallel Example: Phase 2 (Foundational)

```bash
Task: "Add effort_tier to server/app/models/activity.py"
Task: "Add is_featured to server/app/models/challenge.py"
Task: "Add duration_minutes to server/app/models/completion.py"
Task: "Create server/app/models/rewards.py with 4 ORM models"
```

---

## Implementation Strategy

### MVP First (3-day demo budget)

1. Phase 1 (Setup) + Phase 2 (Foundational) — day 1 morning
2. Phase 3 (US1) + Phase 4 (US3) in parallel if two people are available, else sequentially — day 1 afternoon through day 2 morning
3. Phase 5 (US2) — day 2 afternoon. **Checkpoint**: the full verify-and-earn loop works; this alone is a legitimate demo even without Phase 6.
4. Phase 6 (US4) — day 3. This is the demo's centerpiece (the reward ladder), so don't skip it if time allows.
5. Phase 7 (Polish) — remaining day-3 time; prioritize T044 (quickstart validation) over T047 (test coverage) if time is short.

### Incremental Delivery

- After Phase 5: photo verification + point earning is demoable (points visible only via API/DB, no rewards screen yet).
- After Phase 6: the full loop, including the rewards screen and redemption, is demoable — this is the target end state.
