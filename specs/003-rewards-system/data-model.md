# Data Model: Group-Scoped Rewards System

**Feature**: `specs/003-rewards-system`
**Date**: 2026-06-28

---

## Modified Entities

### `completions` — Status machine extension

**Changed column**: `status: String`

| Old values | New values |
|---|---|
| `processing` | `processing` (unchanged) |
| `ready` | ~~`ready`~~ **removed** |
| `self_reported` | `self_reported` (unchanged) |
| — | `pending_verification` (new) |
| — | `verified` (new) |
| — | `rejected` (new) |

**State transitions**:

```
processing
    └── compress_photo completes → pending_verification

pending_verification
    ├── admin approves          → verified   (points credited)
    ├── admin rejects           → rejected   (no points)
    └── auto-approval sweeps    → verified   (points credited; policy_type = "timed")

verified
    └── family re-uploads       → verified   (photo_key updated; status/points unchanged)

rejected
    └── family re-uploads       → pending_verification (rejection_reason cleared from latest
                                                         photo_verifications entry)

self_reported
    └── terminal (no transitions; never earns points)
```

**Impact on existing code**:
- `_compress_async`: set `status = "pending_verification"` (was `"ready"`)
- `_completion_dict`, `get_photo_url`, `get_group_feed`, `get_my_history`: gate URL generation on `status in ("pending_verification", "verified", "rejected")` instead of `status == "ready"`
- `delete_completion`: already checks `status in ("ready", "processing")` — add `"pending_verification"` and `"verified"` to the set of statuses that have a photo to delete

---

### `groups` — Rewards configuration columns

Three new columns added to the existing `groups` table:

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `rewards_enabled` | `Boolean` | No | `False` | Feature toggle per group |
| `auto_approve_days` | `Integer` | Yes | `NULL` | NULL = never auto-approve; positive int = threshold in days |
| `default_activity_points` | `Integer` | No | `10` | Applied when no per-activity override exists |

---

## New Tables

### `group_activity_points`

Per-activity point override within a group. When no row exists for a `(group_id, challenge_activity_id)` pair, the group's `default_activity_points` applies.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `group_id` | UUID | FK → `groups.id` CASCADE |
| `challenge_activity_id` | UUID | FK → `challenge_activities.id` CASCADE |
| `points` | Integer | NOT NULL, > 0 |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

**Unique constraint**: `(group_id, challenge_activity_id)`

---

### `family_group_points`

Running point balance for a family within a specific group. One row per `(family_id, group_id)` pair; created on first point award if not already present (upsert).

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `family_id` | UUID | FK → `families.id` CASCADE |
| `group_id` | UUID | FK → `groups.id` CASCADE |
| `balance` | Integer | NOT NULL, DEFAULT 0, CHECK ≥ 0 |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

**Unique constraint**: `(family_id, group_id)`

**Atomicity invariant**: Balance is only modified via `UPDATE … WHERE balance >= :cost` (debit) or `INSERT … ON CONFLICT DO UPDATE SET balance = balance + :delta` (credit). Never modified with a read-then-write pattern.

---

### `prizes`

Prize catalog entry for a group. Managed by group admins.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `group_id` | UUID | FK → `groups.id` CASCADE |
| `title` | Text | NOT NULL (German) |
| `title_en` | Text | NULLABLE |
| `description` | Text | NULLABLE (German) |
| `description_en` | Text | NULLABLE |
| `point_cost` | Integer | NOT NULL, > 0 |
| `category` | Varchar | NOT NULL; enum: `collage_printing \| experience \| activity_voucher \| goods` |
| `available` | Boolean | NOT NULL, DEFAULT true |
| `expires_at` | TIMESTAMPTZ | NULLABLE |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

**Visibility rule**: Family-facing catalog query filters `WHERE available = true AND (expires_at IS NULL OR expires_at > NOW())`. Admin view returns all rows.

---

### `voucher_codes`

Individual redemption codes linked to a prize. Redeemed at most once.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `prize_id` | UUID | FK → `prizes.id` CASCADE |
| `code` | Text | NOT NULL |
| `redeemed_at` | TIMESTAMPTZ | NULLABLE |
| `redeemed_by_family_id` | UUID | FK → `families.id` SET NULL; NULLABLE |
| `created_at` | TIMESTAMPTZ | NOT NULL |

**Pop query** (used at redemption time):
```sql
SELECT id, code FROM voucher_codes
WHERE prize_id = :prize_id AND redeemed_at IS NULL
LIMIT 1
FOR UPDATE SKIP LOCKED
```

---

### `redemptions`

Immutable audit record of each redemption event.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `family_id` | UUID | FK → `families.id` CASCADE |
| `group_id` | UUID | FK → `groups.id` CASCADE |
| `prize_id` | UUID | FK → `prizes.id` CASCADE |
| `voucher_code_id` | UUID | FK → `voucher_codes.id` CASCADE |
| `points_spent` | Integer | NOT NULL (snapshot of `point_cost` at redemption time) |
| `redeemed_at` | TIMESTAMPTZ | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |

---

### `photo_verifications`

Immutable audit log for every verification action. One row per action; a completion may have multiple rows if rejected then re-submitted and approved.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `completion_id` | UUID | FK → `completions.id` CASCADE |
| `reviewer_user_id` | UUID | FK → `users.id` SET NULL; NULLABLE (null = auto-approved) |
| `action` | Varchar | NOT NULL; enum: `approved \| rejected \| auto_approved` |
| `rejection_reason` | Text | NULLABLE (required when `action = "rejected"`) |
| `policy_type` | Varchar | NOT NULL, DEFAULT `'manual'`; enum: `manual \| timed \| llm` |
| `reviewed_at` | TIMESTAMPTZ | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |

**GDPR note**: `reviewer_user_id` is SET NULL on user deletion. `completion_id` CASCADE-deletes when a completion is deleted (which CASCADE-deletes when a family is deleted). The rejection reason visible to the family is read from the most recent `photo_verifications` row with `action = 'rejected'` for a given `completion_id`.

---

## Relationships Summary

```
groups (1) ──── (0..1) group_activity_points (per challenge_activity)
groups (1) ──── (0..*) prizes
groups (1) ──── (0..*) family_group_points

families (1) ─── (0..*) family_group_points
families (1) ─── (0..*) redemptions

prizes (1) ─── (0..*) voucher_codes
prizes (1) ─── (0..*) redemptions

completions (1) ─── (0..*) photo_verifications
```

---

## Migration Strategy

Single Alembic revision: `<hash>_add_rewards_system.py`

Order within the migration:
1. `ALTER TABLE groups ADD COLUMN rewards_enabled …`
2. `ALTER TABLE groups ADD COLUMN auto_approve_days …`
3. `ALTER TABLE groups ADD COLUMN default_activity_points …`
4. `CREATE TABLE group_activity_points …`
5. `CREATE TABLE family_group_points …`
6. `CREATE TABLE prizes …`
7. `CREATE TABLE voucher_codes …`
8. `CREATE TABLE redemptions …`
9. `CREATE TABLE photo_verifications …`
10. No `completions.status` column type change needed (plain String); existing `ready` rows to be handled by a data migration (`UPDATE completions SET status = 'verified' WHERE status = 'ready'`) included in the same file.
