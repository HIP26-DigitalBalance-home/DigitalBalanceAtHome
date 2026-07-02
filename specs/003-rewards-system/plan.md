# Implementation Plan: Group-Scoped Rewards System

**Branch**: `003-rewards-system` | **Date**: 2026-06-28 | **Spec**: [spec.md](spec.md)

---

## Summary

Extends the existing completion pipeline with a human-mediated photo verification step, introduces a group-scoped point economy, and adds a prize catalog with atomic voucher-code redemption. The `ready` status is replaced by `pending_verification → verified | rejected`. Group admins configure point values, review photos, and manage prizes; families earn points on verified completions and redeem them for prizes. Each group is a fully isolated economy.

---

## Technical Context

**Language/Version**: Python 3.12 (server), TypeScript / React Native (client)

**Primary Dependencies**:
- Server: FastAPI ≥ 0.115, SQLAlchemy 2.x async, asyncpg, Alembic, Pydantic v2, Pillow, boto3
- Client: Expo 54, Expo Router, react-i18next, axios (via `lib/api/client.ts`)

**Storage**: PostgreSQL 16 (primary data), Hetzner Object Storage / S3-compatible (photos)

**Testing**: pytest (server), Jest (client)

**Target Platform**: Linux server (Docker Compose), iOS + Android (React Native)

**Performance Goals**:
- Balance credit/debit: single atomic SQL statement; no additional round-trips
- Voucher pop: `SELECT FOR UPDATE SKIP LOCKED` within the redemption transaction
- Auto-approval sweep: runs every hour as an asyncio background task in the FastAPI lifespan

**Constraints**:
- Spec-driven development is mandatory: `docs/openapi.yaml` must be updated and codegen run before any route implementation
- No sequential integer PKs; all new entities use UUID (`gen_random_uuid()`)
- All timestamps stored as TIMESTAMPTZ UTC
- Zero child-identifiable data in admin-facing endpoints
- No cross-family balance visibility anywhere

**Scale/Scope**:
- Expected: O(100s) of groups, O(1000s) of families, O(10k) completions
- Single-process FastAPI; background asyncio task for auto-approval (no separate worker needed at this scale)

---

## Constitution Check

No active constitution constraints apply (constitution template is unpopulated). All design choices follow project conventions:
- Layered architecture: routes → services → repositories → database
- HTTPException only in routes; domain exceptions in services
- Spec-driven API workflow (hard constraint from CLAUDE.md)

---

## Project Structure

### Documentation (this feature)

```text
specs/003-rewards-system/
├── spec.md             ✅ feature specification
├── plan.md             ✅ this file
├── research.md         ✅ phase 0 output
├── data-model.md       ✅ phase 1 output
├── quickstart.md       ✅ phase 1 output
├── contracts/
│   └── rewards-api.yaml  ✅ phase 1 output
├── checklists/
│   └── requirements.md   ✅ spec quality checklist
└── tasks.md            ⬜ phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
docs/
└── openapi.yaml             MODIFY — merge contracts/rewards-api.yaml

server/
└── app/
    ├── models/
    │   ├── group.py         MODIFY — 3 new columns on Group
    │   ├── completion.py    MODIFY — status comment update; logic changes in services
    │   ├── rewards.py       NEW — GroupActivityPoints, FamilyGroupPoints, Prize,
    │   │                          VoucherCode, Redemption, PhotoVerification
    │   └── __init__.py      MODIFY — import rewards models
    ├── repositories/
    │   └── rewards.py       NEW — all data access for rewards entities
    ├── services/
    │   ├── verification_policy.py  NEW — VerificationPolicy ABC + TimedVerificationPolicy
    │   ├── verification.py         NEW — approve(), reject(), run_auto_approvals()
    │   ├── rewards.py              NEW — settings, catalog, redemption logic
    │   └── completion.py           MODIFY — status machine change + update_photo()
    ├── api/
    │   ├── rewards.py       NEW — all new route handlers
    │   └── completions.py   MODIFY — add PATCH /completions/{id}/photo
    ├── schemas/
    │   └── generated.py     REGENERATE via datamodel-codegen (never edit by hand)
    └── main.py              MODIFY — register rewards router + auto-approval lifespan task

    alembic/versions/
    └── <hash>_add_rewards_system.py  NEW — single migration

client/
└── lib/
    ├── api/
    │   ├── completions.ts   MODIFY — new statuses, rejection_reason field, reuploadPhoto()
    │   ├── rewards.ts       NEW — all rewards/prizes/verification API calls
    │   └── index.ts         MODIFY — export rewards API
    └── i18n/
        ├── de.ts            MODIFY — new `rewards` and `verification` key groups
        └── en.ts            MODIFY — same

    components/
    ├── collage-grid.tsx     MODIFY — badge overlays for new statuses
    └── reupload-modal.tsx   NEW — rejection reason display + re-upload action

    app/group/
    ├── [id].tsx             MODIFY — balance chip + prizes navigation button
    ├── [id]/
    │   ├── admin.tsx        NEW — admin panel (verification queue, settings, prize management)
    │   └── prizes.tsx       NEW — family-facing prize catalog + redemption flow
```

---

## Implementation Phases

### Phase A — Backend: API contract + models + migration

**Prerequisite gate**: `docs/openapi.yaml` updated and codegen run before any route code.

1. Merge `specs/003-rewards-system/contracts/rewards-api.yaml` into `docs/openapi.yaml`:
   - Extend `CompletionStatus` enum (add `pending_verification`, `verified`, `rejected`; remove `ready`)
   - Add all new schemas: `RewardsSettings`, `ActivityPointOverride`, `FamilyBalance`, `Prize`, `PrizeCreate`, `PrizePatch`, `VoucherUpload`, `VoucherStock`, `RedemptionResult`, `PendingVerificationItem`, `VerificationQueue`, `RejectPayload`, `RejectionInfo`
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

3. Add 3 new columns to `server/app/models/group.py` (`rewards_enabled`, `auto_approve_days`, `default_activity_points`)

4. Create `server/app/models/rewards.py` with 6 ORM models (see `data-model.md`)

5. Update `server/app/models/__init__.py` to import rewards models

6. Write single Alembic migration:
   - ALTER TABLE groups (3 columns)
   - CREATE TABLE group_activity_points, family_group_points, prizes, voucher_codes, redemptions, photo_verifications
   - Data migration: `UPDATE completions SET status = 'verified' WHERE status = 'ready'`

---

### Phase B — Backend: Repositories + service layer

7. Create `server/app/repositories/rewards.py`:
   - `get_rewards_settings(group_id)` / `update_rewards_settings(...)`
   - `get_activity_points(group_id)` / `upsert_activity_point(group_id, challenge_activity_id, points)`
   - `get_balance(family_id, group_id)` / `credit_balance(family_id, group_id, points)` / `debit_balance_atomic(family_id, group_id, cost) → bool`
   - `list_prizes(group_id, admin=False)` / `create_prize(...)` / `update_prize(...)`
   - `insert_voucher_codes(prize_id, codes)` / `get_voucher_stock(prize_id)` / `pop_voucher(prize_id) → VoucherCode | None`
   - `create_redemption(...)` / `list_pending_verifications(group_id, limit, offset)` / `create_photo_verification(...)`

8. Create `server/app/services/verification_policy.py`:
   - `VerificationPolicy(ABC)` with `policy_type: str` and `async should_auto_approve(completion, session) → bool`
   - `TimedVerificationPolicy(days)` — checks `completed_at + days <= now`
   - `NeverAutoApprovePolicy` — always returns False; `policy_type = "manual"`
   - `get_policy(group) → VerificationPolicy` factory

9. Create `server/app/services/verification.py`:
   - `approve(session, admin_user_id, completion_id, group_id)` → credits balance, creates audit record, sets status `verified`
   - `reject(session, admin_user_id, completion_id, group_id, reason)` → sets status `rejected`, creates audit record
   - `run_auto_approvals(session)` → queries `pending_verification` completions older than threshold, calls approve() with `reviewer_user_id=None`

10. Create `server/app/services/rewards.py`:
    - Settings CRUD, activity point override CRUD
    - Balance read
    - Prize CRUD, voucher upload/stock
    - `redeem(session, user_id, group_id, prize_id)` — wraps atomic balance debit + voucher pop + redemption record in a single transaction; raises `InsufficientPoints` or `OutOfStock`

11. Modify `server/app/services/completion.py`:
    - `_compress_async`: change `completion.status = "ready"` → `"pending_verification"`
    - `_completion_dict`: update URL generation to gate on `status in ("pending_verification", "verified", "rejected")`
    - `get_photo_url`, `get_group_feed`, `get_my_history`: same status guard update
    - `delete_completion`: add `"pending_verification"` and `"verified"` to photo-delete guard
    - Add `update_photo(session, user_id, completion_id, photo_data, content_type)`:
      - If `verified`: update `photo_key` only; do not change status
      - If `rejected`: re-trigger compression pipeline; reset status to `processing`
      - If `pending_verification`: re-trigger pipeline
      - If `self_reported`: raise error (cannot re-upload)

---

### Phase C — Backend: Routes + lifespan wiring

12. Create `server/app/api/rewards.py` with all route handlers, importing from `services/rewards.py` and `services/verification.py`. All admin routes check `is_group_admin` at service layer.

13. Add `PATCH /completions/{completion_id}/photo` to `server/app/api/completions.py`.

14. Update `server/app/main.py`:
    - Register rewards router with `prefix="/groups"`
    - Register completions patch route
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

15. Update `client/lib/api/completions.ts`:
    - Replace `'ready'` with `'pending_verification'` in `CompletionHistoryItem.status` union
    - Add `'verified'` and `'rejected'` to the union
    - Add `rejection_reason: string | null` to `Completion`
    - Add `reuploadPhoto(completionId: string, imageUri: string)` using multipart POST to `PATCH /completions/{id}/photo`
    - Update polling logic: resolve on `status !== 'processing'` (currently resolves on `status === 'ready'`)

16. Create `client/lib/api/rewards.ts`:
    - `getRewardsSettings(groupId)` / `updateRewardsSettings(groupId, payload)`
    - `getActivityPoints(groupId)` / `updateActivityPoints(groupId, activityId, points)`
    - `getMyBalance(groupId)`
    - `listPrizes(groupId)` / `createPrize(groupId, payload)` / `updatePrize(groupId, prizeId, payload)`
    - `uploadVoucherCodes(groupId, prizeId, codes)` / `getVoucherStock(groupId, prizeId)`
    - `redeemPrize(groupId, prizeId)`
    - `getVerificationQueue(groupId, limit, offset)` / `approvePhoto(groupId, completionId)` / `rejectPhoto(groupId, completionId, reason)`

17. Update `client/lib/api/index.ts` to export `rewards` API

---

### Phase E — Client: UI components + screens

18. Update `client/components/collage-grid.tsx`:
    - `pending_verification`: photo + clock icon overlay (bottom-right, semi-transparent)
    - `verified`: photo + green checkmark badge (bottom-right)
    - `rejected`: photo with red tint + "!" badge; tapping opens `ReuploadModal`

19. Create `client/components/reupload-modal.tsx`:
    - Receives `completionId` and `rejectionReason`
    - Displays rejection reason string
    - "Neues Foto hochladen" button triggers `reuploadPhoto()`
    - On success: dismiss modal and refresh collage

20. Create `client/app/group/[id]/admin.tsx` (visible only to group admins):
    - **Tab 1 — Verification queue**: paginated list of `PendingVerificationItem`; each shows photo, family name, activity, date; approve button + reject button (opens reason input inline)
    - **Tab 2 — Rewards settings**: toggle `rewards_enabled`, `default_activity_points` input, `auto_approve_days` input, save button; per-activity point overrides table (editable)
    - **Tab 3 — Prize management**: list all prizes with stock count; add prize form; per-prize voucher upload (textarea of codes, newline-separated)

21. Create `client/app/group/[id]/prizes.tsx` (member-facing):
    - Shows family's current balance at top
    - Lists available prizes with point cost and progress bar (balance / cost)
    - Redeem button (disabled if balance < cost or out of stock)
    - Confirmation dialog → shows voucher code on success

22. Update `client/app/group/[id].tsx`:
    - Add balance chip (shows current group balance if rewards enabled)
    - Add "Prämien" / "Prizes" navigation button linking to `prizes.tsx`
    - Add admin panel button (visible only when `is_admin: true`) linking to `admin.tsx`

23. Add i18n strings to `client/lib/i18n/de.ts` and `en.ts` under:
    ```
    rewards: {
      balance, points, redeem, redeemConfirm, redeemSuccess, voucherCode,
      insufficientPoints, outOfStock, prizes, noPrizes, ...
    }
    verification: {
      pending, verified, rejected, approve, reject, reason, reupload,
      rejectionReason, queue, noQueue, ...
    }
    ```

---

## Open Decisions to Resolve Before or During Implementation

| ID | Decision needed | Default if unresolved |
|---|---|---|
| OD-001 | Voucher upload UX: textarea vs. CSV file | Textarea (newline-separated) |
| OD-002 | Admin notification of pending queue | No notification (badge count in v2) |
| OD-003 | Points history / ledger | Running balance only (no ledger in v1) |
| OD-004 | Voucher delivery via email | In-app only |
| OD-005 | Cross-group prize discovery | Not implemented in v1 |
| OD-006 | First partner | Pixum collage printing (discount codes) |

---

## Complexity Tracking

No constitution violations. All design choices use established project patterns (layered services/repos, spec-driven API, standard FastAPI lifespan).
