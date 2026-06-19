# Feature Plan: Group-Scoped Rewards System

## Goal

Give group admins a self-contained rewards economy: they configure point values per activity, load voucher-backed prizes, and manually verify that uploaded photos represent genuine family activity. Families earn points within each group they belong to and redeem them for prizes from that group's catalog.

The system is designed around three values:
- **Non-competitive** — points and balances are private to each family; no leaderboards, no rankings
- **Admin-mediated trust** — photos are verified by a human before points are awarded; a pluggable auto-approval policy handles unreviewed photos after a configurable delay
- **Group isolation** — each group is an independent economy; a family in two groups has two separate balances

---

## Key Design Decisions

| Decision | Chosen approach | Rationale |
|---|---|---|
| Who owns points | Family within a group (not global) | Groups are independent; a Kindergarten and a Sportverein shouldn't share an economy |
| Self-reported completions | Fill the collage; never earn points | Points require a verified photo — self-reporting can't be trusted for monetary reward |
| Photo verification | Admin reviews each photo; approves or rejects with a reason | Prevents gaming; rejection reason visible to family (no notification — family checks status in app) |
| Verified status | Sticky terminal state | Once a photo is approved, re-uploading updates the photo for aesthetic purposes but keeps the approval and the points already awarded |
| Rejected status | Family can re-upload; resets to pending_verification | Allows correction without creating a new completion record |
| Auto-approval | Pluggable policy abstraction; ships with timed (7-day default) | The abstraction allows swapping in an LLM-based policy later without restructuring the pipeline |
| Partner / prize model | Voucher pool (admin uploads codes in bulk) | No real-time API to partners needed at launch; codes are self-contained and PII-free |
| Prize catalog scope | Per-group, managed by group admin | Each group signs its own partner deals |

---

## Completion Status Machine (Breaking Change)

The existing `ready` status is **replaced** by a verification pipeline:

```
processing           photo being compressed (unchanged)
    ↓
pending_verification  photo ready; awaiting admin review
    ├── admin approves → verified   (points awarded immediately)
    └── admin rejects  → rejected   (rejection reason stored; family can re-upload)

self_reported        no photo; fills collage slot; never earns points (unchanged)
```

Re-upload behaviour:
- From `rejected`: new photo resets status to `pending_verification` (triggers review again)
- From `verified`: new photo updates `photo_key` (collage aesthetic) but status stays `verified` — no re-review, no point change

Client polling currently resolves when `status == "ready"`. This must be updated to resolve on `pending_verification | verified | rejected` (i.e., anything that is no longer `processing`).

---

## Data Model

### Extend `groups` table

```
rewards_enabled:          Boolean  NOT NULL DEFAULT false
auto_approve_days:        Integer  NULLABLE (null = never; 7 is the default when enabled)
default_activity_points:  Integer  NOT NULL DEFAULT 10
```

### New tables

**`group_activity_points`** — per-activity point override within a group:
```
id                    UUID PK
group_id              UUID FK → groups(id) CASCADE
challenge_activity_id UUID FK → challenge_activities(id) CASCADE
points                Integer NOT NULL
UNIQUE (group_id, challenge_activity_id)
```
When not overridden, the group's `default_activity_points` applies.

**`family_group_points`** — family's running balance within a group:
```
id          UUID PK
family_id   UUID FK → families(id) CASCADE
group_id    UUID FK → groups(id) CASCADE
balance     Integer NOT NULL DEFAULT 0
UNIQUE (family_id, group_id)
```
Credit and debit must be atomic (`UPDATE … WHERE balance >= cost`). No event-sourced ledger at launch — simple counter is sufficient.

**`prizes`** — group admin's prize catalog:
```
id              UUID PK
group_id        UUID FK → groups(id) CASCADE
title           Text NOT NULL
title_en        Text NULLABLE
description     Text NULLABLE
description_en  Text NULLABLE
point_cost      Integer NOT NULL
category        Varchar  (collage_printing | experience | activity_voucher | goods)
available       Boolean NOT NULL DEFAULT true
expires_at      TIMESTAMPTZ NULLABLE
created_at / updated_at
```

**`voucher_codes`** — pool of redemption codes per prize:
```
id                    UUID PK
prize_id              UUID FK → prizes(id) CASCADE
code                  Text NOT NULL
redeemed_at           TIMESTAMPTZ NULLABLE
redeemed_by_family_id UUID FK → families(id) SET NULL NULLABLE
created_at
```
Redemption pops one unused code atomically via `SELECT FOR UPDATE SKIP LOCKED`.

**`redemptions`** — audit record per redemption event:
```
id                UUID PK
family_id         UUID FK → families(id) CASCADE
group_id          UUID FK → groups(id) CASCADE
prize_id          UUID FK → prizes(id) CASCADE
voucher_code_id   UUID FK → voucher_codes(id) CASCADE
points_spent      Integer NOT NULL  (snapshot of cost at redemption time)
redeemed_at       TIMESTAMPTZ NOT NULL
created_at
```

**`photo_verifications`** — audit log for every verification decision:
```
id                UUID PK
completion_id     UUID FK → completions(id) CASCADE
reviewer_user_id  UUID FK → users(id) SET NULL NULLABLE  (null = auto-approved)
action            Varchar  (approved | rejected | auto_approved)
rejection_reason  Text NULLABLE
policy_type       Varchar NOT NULL DEFAULT 'manual'  (manual | timed | llm)
reviewed_at       TIMESTAMPTZ NOT NULL
created_at
```

`policy_type` is the extensibility hook. The `rejection_reason` is read from this table (not stored on `completions`) so the audit trail is complete and the completion model stays clean.

---

## Auto-Approval Abstraction

A policy interface lives in `server/app/services/verification_policy.py`:

```python
class VerificationPolicy(ABC):
    policy_type: str  # written to photo_verifications.policy_type

    @abstractmethod
    async def should_auto_approve(self, completion: Completion, session: AsyncSession) -> bool: ...

class TimedVerificationPolicy(VerificationPolicy):
    """Auto-approves completions older than N days."""
    policy_type = "timed"

class NeverAutoApprovePolicy(VerificationPolicy):
    """Used when auto_approve_days is null."""
    policy_type = "timed"

def get_policy(group: Group) -> VerificationPolicy:
    if group.auto_approve_days is None:
        return NeverAutoApprovePolicy()
    return TimedVerificationPolicy(group.auto_approve_days)
```

The auto-approval runner (`verification_service.run_auto_approvals`) is invoked by a background asyncio task (started in the FastAPI lifespan, runs every hour). Future: swap to a k8s CronJob or an LLM-backed policy by implementing `LLMVerificationPolicy` and wiring it in `get_policy`.

---

## Group Admin Capabilities

Group admins (tracked in `group_admins` table, checked server-side on all admin endpoints) can:

1. **Toggle rewards on/off** for their group
2. **Set default and per-activity point values** for activities in their group's challenges
3. **Create prizes** (title, description, point cost, category, expiry)
4. **Upload voucher code batches** for each prize (bulk insert; admin pastes or uploads a list of codes)
5. **View remaining voucher stock** per prize
6. **Review the verification queue** — list of `pending_verification` completions in their group's challenges, each showing: family name (no child names per GDPR), activity title, photo, submission date
7. **Approve or reject** each photo; rejection requires a reason string

---

## API Endpoints (new)

All new endpoints follow the spec-driven workflow: `docs/openapi.yaml` must be updated first, codegen run second, implementation third.

**Rewards settings (admin only):**
- `GET  /groups/{id}/rewards/settings`
- `PATCH /groups/{id}/rewards/settings` — `{ rewards_enabled, auto_approve_days, default_activity_points }`

**Per-activity point overrides (admin only):**
- `GET  /groups/{id}/rewards/activity-points`
- `PATCH /groups/{id}/rewards/activity-points/{challenge_activity_id}` — `{ points }`

**Family balance:**
- `GET  /groups/{id}/rewards/balance` — returns family's balance in this group

**Prize catalog:**
- `GET  /groups/{id}/prizes` — all available prizes (members see `available=true` only; admin sees all)
- `POST /groups/{id}/prizes` — admin only
- `PATCH /groups/{id}/prizes/{prize_id}` — admin only
- `POST /groups/{id}/prizes/{prize_id}/vouchers` — bulk upload codes, admin only (`{ codes: string[] }`)
- `GET  /groups/{id}/prizes/{prize_id}/vouchers/remaining` — stock count, admin only

**Redemption:**
- `POST /groups/{id}/prizes/{prize_id}/redeem` — atomic: check balance ≥ cost, pop voucher, debit balance, create redemption record, return code

**Photo verification (admin only):**
- `GET  /groups/{id}/admin/verifications` — paginated list of `pending_verification` completions
- `POST /groups/{id}/admin/verifications/{completion_id}/approve`
- `POST /groups/{id}/admin/verifications/{completion_id}/reject` — body: `{ reason: string }`

**Photo re-upload (existing completion):**
- `PATCH /completions/{id}/photo` — multipart photo upload; re-triggers processing pipeline; respects sticky `verified` state

---

## Backend Implementation Order

1. Update `docs/openapi.yaml` (new schemas + all endpoints above, extend `CompletionStatus` enum)
2. Run codegen → `server/app/schemas/generated.py`
3. Add columns to `Group` model (`server/app/models/group.py`)
4. New models in `server/app/models/rewards.py`: `GroupActivityPoints`, `FamilyGroupPoints`, `Prize`, `VoucherCode`, `Redemption`, `PhotoVerification`
5. Import new models in `server/app/models/__init__.py`
6. Alembic migration (single file): extend `groups`, new tables, update `completions.status`
7. `server/app/repositories/rewards.py` — all data access (balance credit/debit with atomic UPDATE, voucher pop with SKIP LOCKED, verification queue)
8. `server/app/services/verification_policy.py` — policy abstraction
9. `server/app/services/verification.py` — `approve()`, `reject()`, `run_auto_approvals()`
10. `server/app/services/rewards.py` — settings, catalog, redemption logic
11. Modify `server/app/services/completion.py`:
    - `compress_photo`: set status to `pending_verification` (was `ready`)
    - Add `update_photo()` for re-upload
12. `server/app/api/rewards.py` — all new routes
13. Extend `server/app/api/completions.py` with `PATCH /completions/{id}/photo`
14. Register new router in `server/app/main.py` with `prefix="/groups"`
15. Add auto-approval background loop to lifespan in `server/app/main.py`

---

## Frontend Implementation Order

1. Update `CompletionStatus` type in `client/lib/api/completions.ts`: replace `ready` with `pending_verification`; add `verified`, `rejected`. Add `rejection_reason: string | null` to `Completion`.
2. Add `reuploadPhoto(completionId, image)` call to `client/lib/api/completions.ts`.
3. New `client/lib/api/rewards.ts` — all rewards, prizes, and verification API calls.
4. Update `client/components/collage-grid.tsx` — new slot visuals:
   - `pending_verification`: photo shown + clock icon overlay (bottom-right)
   - `verified`: photo shown + green checkmark badge (bottom-right)
   - `rejected`: photo shown with red tint + "!" badge; tap opens re-upload modal
5. New `client/components/reupload-modal.tsx` — shown when tapping a `rejected` slot; displays rejection reason + "Neues Foto hochladen" button
6. Update completion polling in challenge detail: poll resolves when status ≠ `processing`
7. New `client/app/group/[id]/admin.tsx` — group admin panel (visible only to admins):
   - Tab/section 1: Verification queue (photo + approve/reject actions; reject shows reason input)
   - Tab/section 2: Rewards settings (toggle, default points, auto-approve days, per-activity overrides)
   - Tab/section 3: Prize management (list, add, voucher upload)
8. New `client/app/group/[id]/prizes.tsx` — prize catalog for members; shows family balance, prize list, progress bars, redeem button + confirmation + voucher display
9. Extend `client/app/group/[id].tsx`: add points balance chip + "Prizes" navigation button
10. Add i18n strings to `client/lib/i18n/de.ts` and `en.ts`

---

## GDPR Notes

- Voucher codes are PII-free: partners receive no family data at redemption
- `redemptions` records are deleted on family hard-delete (CASCADE)
- `photo_verifications` anonymises on family hard-delete (SET NULL on `completion_id` chain; or delete cascade from `completions`)
- If points expiry is added in future: German consumer protection law requires 30-day advance notice and a way to use points before expiry — avoid this complication unless necessary

---

## Files Changed / Created

| Action | Path |
|---|---|
| **Modify** | `docs/openapi.yaml` — extended schemas, all new endpoints |
| **Regenerate** | `server/app/schemas/generated.py` — codegen only |
| **Modify** | `server/app/models/group.py` — 3 new columns |
| **New** | `server/app/models/rewards.py` — 6 new ORM models |
| **Modify** | `server/app/models/__init__.py` — import new models |
| **New** | `server/alembic/versions/<hash>_add_rewards_system.py` |
| **New** | `server/app/repositories/rewards.py` |
| **New** | `server/app/services/verification_policy.py` |
| **New** | `server/app/services/verification.py` |
| **New** | `server/app/services/rewards.py` |
| **Modify** | `server/app/services/completion.py` — status change + re-upload |
| **New** | `server/app/api/rewards.py` |
| **Modify** | `server/app/api/completions.py` — PATCH /completions/{id}/photo |
| **Modify** | `server/app/main.py` — router + auto-approval loop |
| **Modify** | `client/lib/api/completions.ts` — new statuses, re-upload |
| **New** | `client/lib/api/rewards.ts` |
| **Modify** | `client/lib/api/index.ts` — export rewards API |
| **Modify** | `client/components/collage-grid.tsx` — new slot visuals |
| **New** | `client/components/reupload-modal.tsx` |
| **New** | `client/app/group/[id]/admin.tsx` |
| **New** | `client/app/group/[id]/prizes.tsx` |
| **Modify** | `client/app/group/[id].tsx` — balance chip + prizes nav |
| **Modify** | `client/lib/i18n/de.ts` + `en.ts` — new strings |

---

## Open Decisions

1. **Voucher upload UX**: Should the admin paste codes into a textarea (newline-separated) or upload a `.csv` file? Both are simple server-side; CSV is more practical for large batches from partners.

2. **Admin verification notifications**: Currently admins have no way to know a new photo is in their queue. Consider a badge count on the group screen or a periodic email digest (v2).

3. **Points history / ledger**: The current design stores only a running balance. If families need a transaction history ("when did I earn what?"), a `point_ledger_entries` audit table should be added. Defer to v2 unless required for trust or GDPR data export.

4. **Redemption delivery**: Voucher code is shown in-app only. Should it also be emailed? Emailing requires collecting the parent's email for this purpose (likely already available via Google OAuth — check whether it's stored on `users`).

5. **Cross-group prize browsing**: Currently families only see prizes in groups they belong to. Should there be a global prize discovery screen to incentivise joining groups? Defer to v2.

6. **First partner**: No partner has been committed yet. The voucher-pool model works for any partner — the first implementation can be a collage-printing service (e.g. Pixum), which requires only a discount code per redemption.
