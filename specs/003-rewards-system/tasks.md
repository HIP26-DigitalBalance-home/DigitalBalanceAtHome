# Tasks: Group-Scoped Rewards System

**Input**: Design documents from `specs/003-rewards-system/`

**Prerequisites**: [plan.md](plan.md) · [spec.md](spec.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/rewards-api.yaml](contracts/rewards-api.yaml) · [quickstart.md](quickstart.md)

**Format**: `[ID] [P?] [Story?] Description with file path`
- **[P]**: Parallelisable — different files, no unmet dependencies
- **[Story]**: User story label (US1–US5); omitted for setup/foundational/polish tasks

---

## Phase 1: Setup — API Contract & Codegen

**Purpose**: Satisfy the mandatory spec-driven workflow gate. No backend or client code may be written until T002 is complete.

**⚠️ GATE**: `docs/openapi.yaml` must be updated and codegen must have run before any route or schema implementation.

- [ ] T001 Merge `specs/003-rewards-system/contracts/rewards-api.yaml` into `docs/openapi.yaml`: extend `CompletionStatus` enum (add `pending_verification`, `verified`, `rejected`; remove `ready`); add all new schemas (`RewardsSettings`, `ActivityPointOverride`, `FamilyBalance`, `Prize`, `PrizeCreate`, `PrizePatch`, `VoucherUpload`, `VoucherStock`, `RedemptionResult`, `PendingVerificationItem`, `VerificationQueue`, `RejectPayload`); add all 14 new paths
- [ ] T002 Run codegen from repo root (`datamodel-codegen --input docs/openapi.yaml ...`) to regenerate `server/app/schemas/generated.py`; verify `CompletionStatus` enum, `RewardsSettings`, and `RedemptionResult` are present

**Checkpoint**: Codegen complete — all phases can now proceed

---

## Phase 2: Foundational — ORM Models & Migration

**Purpose**: Database schema and Python models that ALL user stories depend on. Must complete before any service or repository code.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Add 3 new columns to `Group` model in `server/app/models/group.py`: `rewards_enabled: Mapped[bool]` (NOT NULL, default False), `auto_approve_days: Mapped[int | None]` (nullable), `default_activity_points: Mapped[int]` (NOT NULL, default 10)
- [ ] T004 [P] Create `server/app/models/rewards.py` with 6 ORM models: `GroupActivityPoints`, `FamilyGroupPoints`, `Prize`, `VoucherCode`, `Redemption`, `PhotoVerification` — see `data-model.md` for full column specs; all PKs use `UUID(as_uuid=True)` + `default=uuid.uuid4`; all timestamps use `DateTime(timezone=True)`
- [ ] T005 Update `server/app/models/__init__.py` to import all 6 new models from `rewards.py`
- [ ] T006 Write single Alembic migration `server/alembic/versions/<hash>_add_rewards_system.py`: ALTER TABLE groups (3 columns); CREATE TABLE group_activity_points, family_group_points, prizes, voucher_codes, redemptions, photo_verifications; data migration `UPDATE completions SET status = 'verified' WHERE status = 'ready'`; run `alembic upgrade head` to verify

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: US5 — Family Sees Completion Status in Collage (Priority: P1) 🎯

**Goal**: The completion status machine is live. Families see photo verification state in the collage; can re-upload rejected photos.

**Independent Test**: Upload a photo → poll and get `pending_verification` (not `ready`); collage shows clock badge. Admin rejects → collage shows red/warning badge with rejection reason on tap. Family re-uploads → status resets to `pending_verification`. Re-upload on a `verified` completion keeps status unchanged.

### Implementation

- [ ] T007 [US5] Update all `status == "ready"` guards in `server/app/services/completion.py`: `_completion_dict` (photo URL gated on `status in ("pending_verification", "verified", "rejected")`), `get_photo_url` (gate on `status == "verified"`), `get_group_feed`, `get_my_history` (photo URL on `status in ("pending_verification", "verified", "rejected")`); update `_compress_async` to set `completion.status = "pending_verification"` instead of `"ready"`; add `"pending_verification"` and `"verified"` to the photo-delete guard in `delete_completion`
- [ ] T008 [US5] Add `update_photo(session, user_id, completion_id, photo_data, content_type)` to `server/app/services/completion.py`: if `verified` — update `photo_key` only, leave status unchanged; if `rejected` — re-trigger compression pipeline, reset status to `processing`; if `pending_verification` — re-trigger pipeline; if `self_reported` — raise domain error
- [ ] T009 [US5] Add `PATCH /completions/{completion_id}/photo` route to `server/app/api/completions.py`: multipart form upload; call `completion_service.update_photo()`; return `{ completion_id, status }`
- [ ] T010 [P] [US5] Update `client/lib/api/completions.ts`: replace `'ready'` with `'pending_verification'` in `CompletionHistoryItem.status` union; add `'verified'` and `'rejected'`; add `rejection_reason: string | null` to `Completion` type; update polling resolve condition from `status === 'ready'` to `status !== 'processing'`
- [ ] T011 [US5] Add `reuploadPhoto(completionId: string, imageUri: string)` to `client/lib/api/completions.ts`: multipart `PATCH /completions/{id}/photo` using same pattern as existing `photosApi.upload`
- [ ] T012 [P] [US5] Update `client/components/collage-grid.tsx`: add status badge overlays rendered with `position: 'absolute'` inside the slot `View` — clock icon for `pending_verification`, green checkmark for `verified`, red/warning "!" badge for `rejected`; `rejected` slot is tappable and opens `ReuploadModal`
- [ ] T013 [P] [US5] Create `client/components/reupload-modal.tsx`: receives `completionId` and `rejectionReason`; displays the rejection reason string; "Neues Foto hochladen" button triggers `reuploadPhoto()`; on success: dismiss and call refresh callback
- [ ] T014 [P] [US5] Add verification status i18n strings to `client/lib/i18n/de.ts` and `en.ts` under a new `verification` key: `pending`, `verified`, `rejected`, `rejectionReason`, `reupload`, `reuploadButton`

**Checkpoint**: Status machine live end-to-end. Collage reflects all new states. Re-upload flows work.

---

## Phase 4: US1 — Admin Enables and Configures Rewards (Priority: P1)

**Goal**: Group admins can enable rewards, set default point values, and override per-activity points.

**Independent Test**: Authenticate as group admin → enable rewards with `default_activity_points = 10` and `auto_approve_days = 7` → `GET /groups/{id}/rewards/settings` returns updated values → set activity override of 25 → `GET /groups/{id}/rewards/activity-points` includes override → admin panel Tab 2 reflects settings and persists changes.

### Implementation

- [ ] T015 [P] [US1] Create `server/app/repositories/rewards.py` with rewards-settings methods: `get_rewards_settings(group_id)`, `update_rewards_settings(group_id, *, rewards_enabled, auto_approve_days, default_activity_points)`, `get_activity_points(group_id) → list`, `upsert_activity_point(group_id, challenge_activity_id, points)`; use `AsyncSession`; raise `GroupNotFound` if group missing
- [ ] T016 [US1] Create `server/app/services/rewards.py` with rewards-settings service functions: `get_settings(session, admin_user_id, group_id)`, `update_settings(session, admin_user_id, group_id, payload)`, `get_activity_points(session, admin_user_id, group_id)`, `update_activity_point(session, admin_user_id, group_id, challenge_activity_id, points)`; each verifies caller is group admin via `group_admins` table (raise `ForbiddenError` if not)
- [ ] T017 [US1] Create `server/app/api/rewards.py` with settings routes: `GET /rewards/settings`, `PATCH /rewards/settings`, `GET /rewards/activity-points`, `PATCH /rewards/activity-points/{challenge_activity_id}`; all require `current_user` dependency; import schemas from `generated.py`
- [ ] T018 [US1] Register rewards router in `server/app/main.py` with `prefix="/groups/{group_id}"` (or flat prefix per plan — confirm with openapi.yaml path structure); verify `GET /groups/{id}/rewards/settings` resolves correctly
- [ ] T019 [P] [US1] Create `client/lib/api/rewards.ts` with settings calls: `getRewardsSettings(groupId)`, `updateRewardsSettings(groupId, payload)`, `getActivityPoints(groupId)`, `updateActivityPoints(groupId, activityId, payload)`
- [ ] T020 [US1] Update `client/lib/api/index.ts` to export `rewards` from `./rewards`
- [ ] T021 [US1] Create `client/app/group/[id]/admin.tsx` with Tab 2 (Rewards Settings): `rewards_enabled` toggle, `default_activity_points` numeric input, `auto_approve_days` numeric input (empty = never), save button with optimistic update; per-activity points table (editable inline); visible only when `is_admin: true`

**Checkpoint**: Admin can configure rewards end-to-end. Settings persist and are returned correctly by the API.

---

## Phase 5: US2 — Admin Reviews and Verifies Photos (Priority: P1)

**Goal**: Group admins see a verification queue, can approve photos (crediting family points) or reject them with a reason. Auto-approval sweeps pending completions after the configured threshold.

**Independent Test**: Submit a photo as family member → admin `GET /groups/{id}/admin/verifications` returns it with family name, activity, photo URL → admin approves → family balance is credited in `family_group_points` → `photo_verifications` audit row created → collage slot shows green checkmark. Admin rejects → rejection reason stored → family sees red badge. Auto-approval sweep approves photos older than threshold.

### Implementation

- [ ] T022 [P] [US2] Create `server/app/services/verification_policy.py`: `VerificationPolicy(ABC)` with `policy_type: str` and `async should_auto_approve(completion, session) → bool`; `TimedVerificationPolicy(days)` checks `now - completion.completed_at >= timedelta(days=days)`; `NeverAutoApprovePolicy` always returns False with `policy_type = "manual"`; `get_policy(group) → VerificationPolicy` factory
- [ ] T023 [P] [US2] Add verification repository methods to `server/app/repositories/rewards.py`: `list_pending_verifications(group_id, limit, offset) → list[PendingVerificationItem]` (joins completions → challenge_activities → families; returns family name, activity title, presigned photo URL, submitted_at; no child names); `create_photo_verification(completion_id, reviewer_user_id, action, rejection_reason, policy_type)`; `credit_balance(session, family_id, group_id, points)` (upsert on conflict with `balance = balance + points`); `get_applicable_points(group_id, challenge_activity_id) → int` (override or default)
- [ ] T024 [US2] Create `server/app/services/verification.py`: `approve(session, admin_user_id, completion_id, group_id)` — verify admin, check status is `pending_verification`, credit balance, set `completion.status = "verified"`, create audit record; `reject(session, admin_user_id, completion_id, group_id, reason)` — verify admin, set `completion.status = "rejected"`, create audit record; `run_auto_approvals(session)` — query all `pending_verification` completions, apply `get_policy(group)`, call `approve()` with `reviewer_user_id=None` for eligible completions
- [ ] T025 [US2] Add verification routes to `server/app/api/rewards.py`: `GET /admin/verifications` (paginated), `POST /admin/verifications/{completion_id}/approve`, `POST /admin/verifications/{completion_id}/reject` (body: `{ reason }`); all check admin role at service layer
- [ ] T026 [US2] Add auto-approval background asyncio task to FastAPI lifespan in `server/app/main.py`: `asyncio.create_task(auto_approval_loop())` where the loop calls `verification_service.run_auto_approvals(session)` then sleeps 3600 seconds
- [ ] T027 [P] [US2] Add verification API calls to `client/lib/api/rewards.ts`: `getVerificationQueue(groupId, limit?, offset?)`, `approvePhoto(groupId, completionId)`, `rejectPhoto(groupId, completionId, reason)`
- [ ] T028 [US2] Add Tab 1 (Verification Queue) to `client/app/group/[id]/admin.tsx`: paginated list of `PendingVerificationItem`; each row shows photo, family name, activity title, submission date; "Approve" button and "Reject" button (reject opens inline reason text input); on action, remove item from queue and show success feedback

**Checkpoint**: Full verification cycle works: photo → pending → admin approves/rejects → balance credited / rejection reason visible.

---

## Phase 6: US4 — Admin Manages Prize Catalog (Priority: P2)

**Goal**: Group admins create prizes, upload voucher code batches, and view remaining stock per prize.

**Independent Test**: Admin creates a prize → `GET /groups/{id}/prizes` (admin view) includes it → admin uploads 3 codes → `GET vouchers/remaining` returns 3 → admin marks prize unavailable → family-facing `GET /groups/{id}/prizes` does not include it → admin still sees it.

### Implementation

- [ ] T029 [P] [US4] Add prize and voucher repository methods to `server/app/repositories/rewards.py`: `list_prizes(group_id, admin=False)` (admin=False filters `available=true` and non-expired); `create_prize(group_id, **fields) → Prize`; `update_prize(prize_id, **fields) → Prize`; `insert_voucher_codes(prize_id, codes: list[str]) → int` (bulk insert, return count); `get_voucher_stock(prize_id) → int` (count unredeemed)
- [ ] T030 [US4] Add prize and voucher service methods to `server/app/services/rewards.py`: `list_prizes(session, user_id, group_id)` (admin sees all; member sees available only — check membership); `create_prize(session, admin_user_id, group_id, payload)`; `update_prize(session, admin_user_id, group_id, prize_id, payload)`; `upload_voucher_codes(session, admin_user_id, group_id, prize_id, codes: list[str])`; `get_voucher_stock(session, admin_user_id, group_id, prize_id) → int`
- [ ] T031 [US4] Add prize and voucher routes to `server/app/api/rewards.py`: `GET /prizes`, `POST /prizes`, `PATCH /prizes/{prize_id}`, `POST /prizes/{prize_id}/vouchers`, `GET /prizes/{prize_id}/vouchers/remaining`
- [ ] T032 [P] [US4] Add prize and voucher API calls to `client/lib/api/rewards.ts`: `listPrizes(groupId)`, `createPrize(groupId, payload)`, `updatePrize(groupId, prizeId, payload)`, `uploadVoucherCodes(groupId, prizeId, codes)`, `getVoucherStock(groupId, prizeId)`
- [ ] T033 [US4] Add Tab 3 (Prize Management) to `client/app/group/[id]/admin.tsx`: list of all prizes with remaining stock count; "Add Prize" form (title, description, point_cost, category, expiry, available toggle); per-prize "Upload Codes" action (textarea, newline-separated); stock count display per prize
- [ ] T034 [P] [US4] Add prize management i18n strings to `client/lib/i18n/de.ts` and `en.ts` under `rewards.prizes`: `create`, `edit`, `uploadCodes`, `codesPlaceholder`, `stockCount`, `noStock`, `category.*` variants, `expires`, `available`, `unavailable`

**Checkpoint**: Admin can manage the full prize catalog and upload voucher inventory. Family-facing catalog correctly filters.

---

## Phase 7: US3 — Family Views Balance and Redeems a Prize (Priority: P2)

**Goal**: Families see their running point balance within a group and can redeem prizes atomically — balance debited, voucher code returned in a single transaction.

**Independent Test**: Family has `balance = 10`; prize costs 5 with 2 voucher codes; family redeems → `voucher_code` returned, `balance` becomes 5, stock drops to 1; second redemption by same family → `balance = 0`, stock = 0; third attempt → 402 Insufficient Points. Concurrent redemption of last code by two families → exactly one succeeds, other gets 409.

### Implementation

- [ ] T035 [P] [US3] Add balance and redemption repository methods to `server/app/repositories/rewards.py`: `get_balance(family_id, group_id) → int`; `debit_balance_atomic(session, family_id, group_id, cost) → bool` (single UPDATE with WHERE balance >= cost, returns True if row updated); `pop_voucher(session, prize_id) → VoucherCode | None` (SELECT FOR UPDATE SKIP LOCKED, mark `redeemed_at` and `redeemed_by_family_id`); `create_redemption(session, family_id, group_id, prize_id, voucher_code_id, points_spent)`
- [ ] T036 [US3] Add balance and redemption service methods to `server/app/services/rewards.py`: `get_family_balance(session, user_id, group_id) → FamilyBalance`; `redeem_prize(session, user_id, group_id, prize_id) → RedemptionResult` — all within one transaction: verify membership, load prize, check available/not expired, debit balance (raise `InsufficientPoints` if atomic debit returns False), pop voucher (raise `OutOfStock` if None), create redemption record, return voucher code
- [ ] T037 [US3] Add balance and redemption routes to `server/app/api/rewards.py`: `GET /rewards/balance` (return `FamilyBalance`), `POST /prizes/{prize_id}/redeem` (return `RedemptionResult`; map `InsufficientPoints` → 402, `OutOfStock` → 409)
- [ ] T038 [P] [US3] Add balance and redemption API calls to `client/lib/api/rewards.ts`: `getMyBalance(groupId)`, `redeemPrize(groupId, prizeId)`
- [ ] T039 [US3] Create `client/app/group/[id]/prizes.tsx`: show family balance at top; list available prizes with point cost, description, and `balance/cost` progress bar; "Einlösen" button (disabled if `balance < cost` or out of stock); confirmation dialog → on confirm call `redeemPrize()` → show returned `voucher_code` prominently with copy button
- [ ] T040 [US3] Update `client/app/group/[id].tsx`: add points balance chip (shown only when `rewards_enabled` for group); add "Prämien" navigation button linking to `prizes.tsx`; add "Admin" navigation button (shown only when `is_admin: true`) linking to `admin.tsx`
- [ ] T041 [P] [US3] Add balance and redemption i18n strings to `client/lib/i18n/de.ts` and `en.ts` under `rewards`: `balance`, `yourPoints`, `redeem`, `redeemConfirm`, `redeemSuccess`, `voucherCode`, `copyCode`, `insufficientPoints`, `outOfStock`, `prizes`, `noPrizes`, `pointsCost`, `progress`

**Checkpoint**: Full rewards economy works end-to-end: earn via verification → view balance → browse catalog → redeem → receive voucher code.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Integration validation, GDPR audit, and contract verification across all stories.

- [ ] T042 GDPR audit: verify CASCADE delete on `redemptions`, `photo_verifications` when a `family` is deleted; verify `reviewer_user_id` SET NULL in `photo_verifications` when a `user` is deleted; confirm no child names appear in any verification queue SQL query
- [ ] T043 [P] Run schemathesis contract tests against all new endpoints: `schemathesis run ../docs/openapi.yaml --base-url http://localhost:8000` and confirm no 5xx or schema violations on new paths
- [ ] T044 Run `quickstart.md` validation scenarios 1–9 with Docker Compose stack running; confirm all expected status codes, balance values, stock counts, and audit records match; pay special attention to Scenario 7 (concurrent redemption) and Scenario 8 (auto-approval sweep)
- [ ] T045 [P] Add `InsufficientPoints`, `OutOfStock`, `VerificationConflict` domain exceptions to `server/app/services/exceptions.py`; verify all new service methods raise domain exceptions (never `HTTPException`)
- [ ] T046 [P] Run `ruff check server/` and `ruff format server/`; run `npx tsc --noEmit` in `client/`; fix any type or lint errors introduced across new files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on T001/T002 — codegen must be complete ⚠️
- **Phase 3 (US5)**: Depends on Phase 2 — models and migration must exist
- **Phase 4 (US1)**: Depends on Phase 2 — can run in parallel with Phase 3
- **Phase 5 (US2)**: Depends on Phase 4 (rewards repo and service files must exist); depends on Phase 3 (status machine must be live)
- **Phase 6 (US4)**: Depends on Phase 2; can run in parallel with Phase 3/4
- **Phase 7 (US3)**: Depends on Phase 5 (balance credit already wired for approvals) and Phase 6 (prizes must exist to redeem)
- **Phase 8 (Polish)**: Depends on all story phases complete

### User Story Dependencies

```
Phase 1 → Phase 2 → Phase 3 (US5) ─┐
                  └─ Phase 4 (US1) ─┤─ Phase 5 (US2) ─┐
                  └─ Phase 6 (US4) ─┘                  ├─ Phase 7 (US3) → Phase 8
                                                         └─────────────────┘
```

### Within Each Phase

- Tasks marked [P] within the same phase can run concurrently (different files, no shared state)
- Repository methods → service methods → route handlers (sequential within each story)
- Server side of each story must be done before the matching client API calls make sense to test

---

## Parallel Opportunities

### Phase 2 (Foundational)
```
T003 (group.py columns) ← sequential, depends on T002
T004 (rewards.py models) [P] ← can run while T003 runs (different file)
T005 (models __init__)  ← depends on T004
T006 (migration)        ← depends on T003, T004, T005
```

### Phase 3 (US5)
```
Parallel: T010 (completions.ts types), T012 (collage-grid.tsx), T013 (reupload-modal.tsx), T014 (i18n)
Sequential: T007 → T008 → T009 (server, all touch completion.py/completions.py)
T011 (reuploadPhoto) ← depends on T010
```

### Phase 5 (US2)
```
Parallel: T022 (verification_policy.py), T023 (repo methods), T027 (client API)
Sequential: T024 (verification.py) ← depends on T022 + T023
Sequential: T025 (routes) ← depends on T024
Sequential: T026 (lifespan task) ← depends on T024
Sequential: T028 (admin.tsx Tab 1) ← depends on T027
```

---

## Implementation Strategy

### MVP (Phases 1–3 only)

Complete the status machine change with client-side collage overlays. This is independently shippable and required before any reward-earning logic can work.

1. Phase 1: API contract + codegen
2. Phase 2: Models + migration
3. Phase 3 (US5): Status machine + collage badges + re-upload
4. **STOP and VALIDATE**: Quickstart scenarios 2, 3, 4, 5

### Full Feature

5. Phase 4 (US1): Admin configuration
6. Phase 5 (US2): Verification queue + approval/rejection + auto-approval
   - Quickstart scenarios 1, 3, 4, 8
7. Phase 6 (US4): Prize catalog + voucher management
8. Phase 7 (US3): Balance + redemption
   - Quickstart scenarios 6, 7, 9
9. Phase 8: Polish + GDPR + contract tests

### Parallel Team Strategy (2 developers)

- **Dev A**: Phases 1 → 2 → 3 (US5) → 5 (US2) — status machine + verification
- **Dev B**: Phase 4 (US1) → 6 (US4) → 7 (US3) — configuration + prizes + redemption
- Both converge at Phase 8

---

## Notes

- `[P]` tasks touch different files and have no unmet in-phase dependencies — safe to run concurrently
- `server/app/repositories/rewards.py` and `server/app/services/rewards.py` grow across phases — each phase appends new methods to the existing file
- `client/app/group/[id]/admin.tsx` grows across phases (Tab 2 in US1, Tab 1 in US2, Tab 3 in US4)
- `client/lib/api/rewards.ts` grows across phases (settings in US1, verification in US2, prizes in US4, balance in US3)
- Always run `alembic upgrade head` after T006 before any service code that queries new tables
- The openapi.yaml codegen is a hard gate — tasks T003+ must not implement routes or schema imports before T002 is done
