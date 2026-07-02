# Research: Group-Scoped Rewards System

**Feature**: `specs/003-rewards-system`
**Date**: 2026-06-28

---

## 1. Existing completion status machine

**Decision**: The current status column on `completions` stores a plain `String` (not a database enum). Valid values are `processing | ready | self_reported`.

**Rationale**: Changing from `ready` to the three-value verification pipeline (`pending_verification | verified | rejected`) requires only an Alembic migration that updates string literals; no PostgreSQL enum type needs ALTER-ing. This keeps the migration straightforward.

**Impact**:
- `_compress_async` in `server/app/services/completion.py` currently sets `completion.status = "ready"` after compression. This MUST be changed to `"pending_verification"`.
- `_completion_dict` and `get_photo_url` gate on `status == "ready"` for presigned URL generation. Both must be updated to gate on `status in ("verified",)` or `status in ("verified", "pending_verification")` as appropriate.
- `get_group_feed` and `get_my_history` also hard-code `status == "ready"` for photo URL generation — both need updating.
- Client-side: `CompletionHistoryItem` in `client/lib/api/completions.ts` declares `status: 'processing' | 'ready' | 'self_reported'`. The photo polling logic resolves on `ready`. Both must be updated.

---

## 2. Atomic balance debit pattern

**Decision**: Use a single `UPDATE family_group_points SET balance = balance - :cost WHERE family_id = :fid AND group_id = :gid AND balance >= :cost` with row-count check. No event-sourced ledger.

**Rationale**: PostgreSQL serialises row-level updates; the `WHERE balance >= cost` clause prevents going negative without requiring a separate SELECT. The `asyncpg` driver used by the project returns the row count affected, so the service can detect a failed debit (count = 0) and raise an insufficient-balance error.

**Alternatives considered**: An append-only `point_ledger_entries` table would support full transaction history and GDPR data export but adds write amplification on every approval. Deferred to v2 (OD-003).

---

## 3. Voucher pop concurrency

**Decision**: Use `SELECT … FOR UPDATE SKIP LOCKED` on `voucher_codes` to pop one unredeemed code atomically within the redemption transaction.

**Rationale**: Multiple simultaneous redemptions could race. `SKIP LOCKED` causes each concurrent reader to see only rows no other transaction is locking, ensuring each code is issued at most once. SQLAlchemy 2.x supports `.with_for_update(skip_locked=True)`.

**Alternatives considered**: Application-level locking (Redis SETNX) would work but adds a dependency. PostgreSQL-native locking is already available and sufficient at the expected scale.

---

## 4. Auto-approval background runner

**Decision**: Implement as an `asyncio` task launched in FastAPI's `lifespan` context, polling every hour.

**Rationale**: The project already runs a single FastAPI process with async I/O. Adding an `asyncio.create_task` in lifespan avoids a new process/container for v1 and reuses the existing `AsyncSession` machinery.

**Alternatives considered**: A Kubernetes CronJob or Celery beat would be more robust in a multi-replica deployment but is over-engineered for the current single-server setup. The policy abstraction means this runner can be extracted later.

---

## 5. Policy abstraction placement

**Decision**: `VerificationPolicy` ABC lives in `server/app/services/verification_policy.py`. The `get_policy(group)` factory is called from `verification_service.run_auto_approvals`.

**Rationale**: Keeps the policy contract independent of any specific policy. `LLMVerificationPolicy` can be added by implementing the ABC and updating `get_policy` — no other file changes needed.

**Note**: The `NeverAutoApprovePolicy` must use `policy_type = "manual"` (not `"timed"` as written in the feature plan — this appears to be a copy-paste error in the original plan).

---

## 6. Presigned URL handling for new statuses

**Decision**: Presigned URLs are generated for `pending_verification` and `verified` completions (both have a stored `photo_key`). `rejected` completions also have a photo and should return a URL. `self_reported` completions never have a photo key.

**Rationale**: The admin verification queue needs to display the photo; the family collage needs to display it in all three post-processing states. All three status values imply a compressed photo exists at `final_key`.

---

## 7. Group admin permission check pattern

**Decision**: Reuse the existing `group_admins` table. Add a repository helper `is_group_admin(group_id, user_id) → bool` and call it at the top of every admin-scoped service method (raising `ForbiddenError`). Route handlers inject the current user via the existing `get_current_user` dependency.

**Rationale**: The pattern is already established for other group admin operations. No new auth mechanism needed.

---

## 8. Client collage overlay pattern

**Decision**: New overlays (clock, checkmark, warning badge) are composited with `position: 'absolute'` inside the existing slot `View` in `client/components/collage-grid.tsx`.

**Rationale**: Matches existing collage slot implementation. No third-party overlay library needed.

---

## 9. i18n approach

**Decision**: All new German and English strings are added to `client/lib/i18n/de.ts` and `en.ts` under a new top-level `rewards` key and a `verification` sub-key. Accessed via `useTranslation()` hook as in existing screens.

**Rationale**: Consistent with project convention. The `de.ts` / `en.ts` files are flat objects; new keys won't conflict with existing ones.

---

## 10. Spec-driven workflow gate

**Decision**: `docs/openapi.yaml` must be updated first (new schemas: `RewardsSettings`, `Prize`, `PrizeList`, `VoucherUpload`, `Redemption`, `VerificationQueue`, `VerificationAction`; extended `CompletionStatus` enum). Codegen (`datamodel-codegen`) is run before any route implementation.

**Rationale**: This is a hard project constraint documented in CLAUDE.md. No exceptions.
