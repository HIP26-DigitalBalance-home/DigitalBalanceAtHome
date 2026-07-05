# Implementation Plan: Family Points & Reward Levels (Demo Scope)

**Branch**: `003-rewards-system` | **Date**: 2026-07-04 | **Spec**: [spec.md](spec.md)

---

## Summary

Extends the existing completion pipeline with a human-mediated (later AI-mediated) photo verification step, and layers a **single family-wide point economy** on top: fixed per-tier point awards recorded as an immutable ledger, a current-quarter balance derived at query time (no stored balance, no reset job), and four seeded global reward levels redeemed as milestones rather than a spend-down shop. The `ready` completion status is replaced by `pending_verification → verified | rejected`. Group admins review photos for their group's challenges; personal/family challenges (no group) fall back to a timed auto-approval policy. Families see quarter progress and redeem unlocked levels for a placeholder voucher code.

---

## Technical Context

**Language/Version**: Python 3.12 (server), TypeScript / React Native (client)

**Primary Dependencies**:
- Server: FastAPI ≥ 0.115, SQLAlchemy 2.x async, asyncpg, Alembic, Pydantic v2, Pillow, boto3
- Client: Expo 54, Expo Router, react-i18next, axios (via `lib/api/client.ts`)

**Storage**: PostgreSQL 16 (primary data), Hetzner Object Storage / S3-compatible (photos, unchanged by this feature)

**Testing**: pytest (server), Jest (client)

**Target Platform**: Linux server (Docker Compose), iOS + Android (React Native)

**Performance Goals**:
- Point award: one immutable INSERT into `point_ledger_entries` per completion, guarded by a uniqueness constraint — no read-then-write balance logic
- Quarter balance: single aggregate query (`SUM(points) WHERE family_id = ? AND awarded_at >= quarter_start`); no caching needed at demo scale
- Redemption: single transaction — check unlock (aggregate query) + check quarter/annual uniqueness + INSERT redemption row; no row locking beyond the DB's own unique-constraint enforcement
- Auto-approval sweep (personal challenges only): runs hourly as an asyncio background task in the FastAPI lifespan

**Constraints**:
- Spec-driven development is mandatory: `docs/openapi.yaml` must be updated and codegen run before any route implementation
- No sequential integer PKs; all new entities use UUID (`gen_random_uuid()`)
- All timestamps stored as TIMESTAMPTZ UTC; quarter boundaries computed in UTC for v1 (OD-102)
- Zero child-identifiable data in admin-facing endpoints
- No cross-family balance visibility anywhere; points/levels are fixed system-wide constants, not admin-configurable

**Scale/Scope**:
- Expected: O(100s) of groups, O(1000s) of families, O(10k) completions
- Single-process FastAPI; background asyncio task for auto-approval (no separate worker needed at this scale)

---

## Constitution Check

No active constitution constraints apply (constitution template is unpopulated). All design choices follow project conventions:
- Layered architecture: routes → services → repositories → database
- HTTPException only in routes; domain exceptions (`app/services/exceptions.py`) in services
- Spec-driven API workflow (hard constraint from CLAUDE.md)

---

## Project Structure

### Documentation (this feature)

```text
specs/003-rewards-system/
├── spec.md             ✅ feature specification (Rev 2 — demo scope)
├── plan.md             ✅ this file
├── research.md         ✅ phase 0 output
├── data-model.md        ✅ phase 1 output
├── quickstart.md       ✅ phase 1 output
├── contracts/
│   └── rewards-api.yaml  ✅ phase 1 output
└── tasks.md            ⬜ phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
docs/
└── openapi.yaml             MODIFY — merge contracts/rewards-api.yaml

server/
└── app/
    ├── models/
    │   ├── activity.py      MODIFY — add `effort_tier` column
    │   ├── challenge.py     MODIFY — add `is_featured` column
    │   ├── completion.py    MODIFY — status comment update, add `duration_minutes`; logic in services
    │   ├── rewards.py       NEW — PointLedgerEntry, RewardLevel, Redemption, PhotoVerification
    │   └── __init__.py      MODIFY — import rewards models
    ├── repositories/
    │   └── rewards.py       NEW — all data access for ledger, levels, redemptions, verification audit
    ├── services/
    │   ├── verification_policy.py  NEW — VerificationPolicy ABC + TimedVerificationPolicy
    │   ├── verification.py         NEW — approve(), reject(), run_auto_approvals()
    │   ├── points.py               NEW — tier resolution + point award on verification
    │   ├── rewards.py              NEW — quarter balance, level progress, redemption logic
    │   └── completion.py           MODIFY — status machine change, duration_minutes, update_photo()
    ├── api/
    │   ├── rewards.py       NEW — verification queue routes + rewards/levels routes
    │   └── completions.py   MODIFY — add PATCH /completions/{id}/photo; accept duration_minutes on upload
    ├── schemas/
    │   └── generated.py     REGENERATE via datamodel-codegen (never edit by hand)
    └── main.py              MODIFY — register rewards router + auto-approval lifespan task

    alembic/versions/
    └── <hash>_add_rewards_system.py  NEW — single migration (see data-model.md)

client/
└── lib/
    ├── api/
    │   ├── completions.ts   MODIFY — new statuses, rejection_reason, duration_minutes, reuploadPhoto()
    │   ├── rewards.ts       NEW — verification queue + rewards/levels API calls
    │   └── index.ts         MODIFY — export rewards API
    └── i18n/
        ├── de.ts            MODIFY — new `rewards` and `verification` key groups
        └── en.ts            MODIFY — same

    components/
    ├── collage-grid.tsx     MODIFY — badge overlays for new statuses
    ├── duration-picker.tsx  NEW — dropdown shown on casual-activity photo upload
    └── reupload-modal.tsx   NEW — rejection reason display + re-upload action

    app/group/
    ├── [id].tsx             MODIFY — "Prämien" navigation button
    └── [id]/
        └── admin.tsx        NEW — admin verification queue (single tab; no rewards-settings tab — points/levels are fixed, nothing to configure)

    app/
    └── rewards.tsx          NEW — family-facing quarter balance + 4-level progress + redemption flow (family-scoped, not under app/group/)
```

**Structure Decision**: Single web-service + mobile-app repo (existing monorepo layout). The rewards screen lives at the family/app level (`app/rewards.tsx`), not under `app/group/[id]/`, because the point economy is family-global per the revised spec — a family sees one balance and one set of levels regardless of which group's challenge earned the points. The admin verification queue remains group-scoped (`app/group/[id]/admin.tsx`) because verification authority is still tied to the group owning the challenge.

---

## Implementation Phases

### Phase A — Backend: API contract + models + migration

**Prerequisite gate**: `docs/openapi.yaml` updated and codegen run before any route code.

1. Merge `specs/003-rewards-system/contracts/rewards-api.yaml` into `docs/openapi.yaml`:
   - Extend `CompletionStatus` enum (add `pending_verification`, `verified`, `rejected`; remove `ready`)
   - Add `duration_minutes` (nullable int) to completion upload request and `Completion`/`CompletionHistoryItem` schemas
   - Add all new schemas: `PendingVerificationItem`, `VerificationQueue`, `RejectPayload`, `RewardsBalance`, `RewardLevel`, `RewardLevelProgress`, `RedeemPayload`, `RedemptionResult`
   - Add all new paths (see `contracts/rewards-api.yaml`)

2. Run codegen from repo root:
   ```bash
   datamodel-codegen \
     --input docs/openapi.yaml \
     --input-file-type openapi \
     --output server/app/schemas/generated.py \
     --output-model-type pydantic_v2.BaseModel \
     --use-annotated \
     --field-constraints \
     --target-python-version 3.12
   ```

3. Add `effort_tier` column to `server/app/models/activity.py` (`String`, NOT NULL, values `casual | dedicated`); add `is_featured` column to `server/app/models/challenge.py` (`Boolean`, NOT NULL, default False).

4. Add `duration_minutes` column to `server/app/models/completion.py` (`Integer`, nullable).

5. Create `server/app/models/rewards.py` with 4 ORM models: `PointLedgerEntry`, `RewardLevel`, `Redemption`, `PhotoVerification` (see `data-model.md`).

6. Update `server/app/models/__init__.py` to import the 4 new models.

7. Write single Alembic migration:
   - ALTER TABLE activities ADD COLUMN effort_tier; backfill existing 30 seed rows per OD-101 classification
   - ALTER TABLE challenges ADD COLUMN is_featured
   - ALTER TABLE completions ADD COLUMN duration_minutes; data migration `UPDATE completions SET status = 'verified' WHERE status = 'ready'`
   - CREATE TABLE point_ledger_entries, reward_levels, redemptions, photo_verifications
   - Seed 4 rows into `reward_levels` (50/100/150/250, per spec FR-020)
   - Drop `users.points_balance` is deferred to a later cleanup migration (FR-019 only requires the client stop reading it)

---

### Phase B — Backend: Repositories + service layer

8. Create `server/app/repositories/rewards.py`:
   - `create_ledger_entry(family_id, completion_id, base_points, bonus_points, awarded_at)` — relies on a unique constraint on `completion_id` for idempotency
   - `get_quarter_balance(family_id, quarter_start, quarter_end) -> int` — aggregate query
   - `list_quarter_ledger(family_id, quarter_start, quarter_end)` — for history display (FR-018)
   - `list_reward_levels()` — the 4 seeded rows
   - `count_family_redemptions(family_id, level_id, quarter_key)` / `count_family_redemptions_year(family_id, level_id, year)` (for the Level 4 cap)
   - `create_redemption(family_id, level_id, quarter_key, chosen_option, points_snapshot, voucher_code)`
   - `list_pending_verifications(group_id, limit, offset)` / `create_photo_verification(...)`

9. Create `server/app/services/verification_policy.py`:
   - `VerificationPolicy(ABC)` with `policy_type: str` and `async should_auto_approve(completion, session) -> bool`
   - `TimedVerificationPolicy(hours=24)` — checks `completed_at + hours <= now`; used for personal/family challenges (`group_id is None`), per FR-011a
   - `NeverAutoApprovePolicy` — always False; `policy_type = "manual"`; used for group challenges (admin reviews)
   - `get_policy(challenge) -> VerificationPolicy` factory — branches on `challenge.group_id is None`

10. Create `server/app/services/points.py`:
    - `resolve_tier(activity) -> Literal["casual", "dedicated", "marketplace"]` — marketplace if `cost_indicator == "paid" or is_partner_content`, else `activity.effort_tier`
    - `compute_points(activity, challenge, duration_minutes) -> tuple[int, int]` — returns `(base_points, bonus_points)` per FR-013/FR-014/FR-016 (casual base is 0 if `duration_minutes` is None or < 30)
    - `award_points(session, completion) -> None` — called from `verification.approve()`; resolves tier, computes points, calls `repositories.rewards.create_ledger_entry`

11. Create `server/app/services/verification.py`:
    - `approve(session, admin_user_id, completion_id, group_id)` → sets status `verified`, calls `points.award_points`, creates audit record
    - `reject(session, admin_user_id, completion_id, group_id, reason)` → sets status `rejected`, creates audit record
    - `run_auto_approvals(session)` → queries `pending_verification` completions on challenges with `group_id IS NULL` older than the policy window, calls `approve()` with `reviewer_user_id=None`

12. Create `server/app/services/rewards.py`:
    - `get_balance_and_progress(session, family_id) -> RewardsBalance` — quarter balance + per-level unlocked/redeemed state (FR-021, FR-022)
    - `redeem(session, family_id, level_id, chosen_option=None) -> RedemptionResult` — checks unlock, checks quarter-uniqueness (FR-022), checks Level 4 annual cap (FR-023), checks Level 3 requires `chosen_option` (FR-024), generates placeholder voucher code, creates redemption record — raises `LevelLocked`, `AlreadyRedeemedThisQuarter`, `AnnualCapReached`, or `ChoiceRequired`

13. Modify `server/app/services/completion.py`:
    - `_compress_async`: `completion.status = "ready"` → `"pending_verification"`
    - `_completion_dict`, `get_photo_url`, `get_group_feed`, `get_my_history`: update status guard to `status in ("pending_verification", "verified", "rejected")`
    - `delete_completion`: add `"pending_verification"` and `"verified"` to the photo-delete guard
    - Upload entrypoint: accept and persist `duration_minutes`; reject with a validation error if the activity's resolved tier is `casual` and `duration_minutes` is missing (FR-006)
    - Add `update_photo(session, user_id, completion_id, photo_data, content_type)`:
      - `verified`: update `photo_key` only; status unchanged
      - `rejected`: re-trigger compression pipeline; reset status to `processing`
      - `pending_verification`: re-trigger pipeline
      - `self_reported`: raise domain error

---

### Phase C — Backend: Routes + lifespan wiring

14. Create `server/app/api/rewards.py`:
    - `GET /groups/{group_id}/verification-queue` (paginated), `POST /groups/{group_id}/verification-queue/{completion_id}/approve`, `POST /groups/{group_id}/verification-queue/{completion_id}/reject` — admin-only, checked via `NotGroupAdmin`
    - `GET /rewards/balance` — family-scoped (derived from `current_user`'s family), returns quarter balance + 4-level progress
    - `POST /rewards/levels/{level_id}/redeem` — family-scoped

15. Add `PATCH /completions/{completion_id}/photo` to `server/app/api/completions.py`; update the completion upload route to accept `duration_minutes`.

16. Update `server/app/main.py`:
    - Register rewards router
    - Add auto-approval background asyncio task in `lifespan`:
      ```python
      async def auto_approval_loop():
          while True:
              async with AsyncSession(...) as session:
                  await verification_service.run_auto_approvals(session)
              await asyncio.sleep(3600)
      ```

---

### Phase D — Client: API layer + types

17. Update `client/lib/api/completions.ts`:
    - Replace `'ready'` with `'pending_verification'` in the status union; add `'verified'` and `'rejected'`
    - Add `rejection_reason: string | null` and `duration_minutes: number | null` to `Completion`
    - Add `duration_minutes` param to the upload call; add `reuploadPhoto(completionId, imageUri)` (multipart `PATCH`)
    - Update polling logic: resolve on `status !== 'processing'`

18. Create `client/lib/api/rewards.ts`:
    - `getVerificationQueue(groupId, limit, offset)` / `approvePhoto(groupId, completionId)` / `rejectPhoto(groupId, completionId, reason)`
    - `getRewardsBalance()` / `redeemLevel(levelId, chosenOption?)`

19. Update `client/lib/api/index.ts` to export the `rewards` API.

---

### Phase E — Client: UI components + screens

20. Update `client/components/collage-grid.tsx`:
    - `pending_verification`: clock icon overlay; `verified`: green checkmark; `rejected`: red tint + "!" badge, tappable → `ReuploadModal`

21. Create `client/components/duration-picker.tsx`: dropdown (15/30/45/60/90/120+ min per OD-105) shown on the upload sheet when the activity's tier is casual; required before submit.

22. Create `client/components/reupload-modal.tsx`: displays rejection reason; "Neues Foto hochladen" button → `reuploadPhoto()`; on success, dismiss + refresh.

23. Create `client/app/group/[id]/admin.tsx` (visible only to group admins): single verification-queue view — photo, family name, activity, duration, date; approve / reject (inline reason input).

24. Create `client/app/rewards.tsx` (family-level screen, not group-scoped): quarter balance header, 4-level progress list (locked/unlocked/redeemed-this-quarter state, Level 3 choice picker, Level 4 annual-cap messaging), redeem button per unlocked level, confirmation dialog showing the voucher code.

25. Update `client/app/group/[id].tsx`: add a "Prämien" / "Rewards" navigation entry point to `app/rewards.tsx` (or place it in the main tab bar / profile — confirm during implementation which nav surface fits best, since rewards are no longer group-scoped).

26. Add i18n strings to `client/lib/i18n/de.ts` and `en.ts` under `rewards: { balance, levels, redeem, redeemConfirm, redeemSuccess, voucherCode, locked, unlocked, alreadyRedeemed, annualCapReached, chooseOption, ... }` and `verification: { pending, verified, rejected, approve, reject, reason, reupload, rejectionReason, queue, noQueue, duration, durationRequired, ... }`.

---

## Open Decisions to Resolve Before or During Implementation

| ID | Decision needed | Default if unresolved |
|---|---|---|
| OD-101 | Casual vs. dedicated classification for the 30 seed activities | `estimated_duration_minutes ≥ 45` or structured/planned activities → `dedicated`; rest → `casual` |
| OD-102 | Quarter boundary timezone (UTC vs. Europe/Berlin) | UTC for v1 |
| OD-103 | Whether casual activities should be repeatably earnable (conflicts with `uq_completion`) | Keep existing constraint; earn once per (family, challenge_activity) |
| OD-104 | Who sets `is_featured` on a challenge | Set at challenge creation / via seed data; no dedicated admin UI in v1 |
| OD-105 | Duration dropdown options | 15 / 30 / 45 / 60 / 90 / 120+ minutes |
| OD-106 | Sub-30-minute casual completions: zero-point ledger entry vs. no entry | Zero-point entry (visible in history) |
| OD-107 | Whether Level 4 needs a stored choice like Level 3 | No — single reward description; revisit if business team wants a choice |

---

## Complexity Tracking

No constitution violations. All design choices use established project patterns (layered services/repos, spec-driven API, standard FastAPI lifespan). The redemption flow is intentionally simpler than a spend-down shop: no row-locking beyond the database's own unique-constraint enforcement, since milestones don't require atomic debit.
