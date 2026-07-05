# Data Model: Family Points & Reward Levels (Demo Scope)

**Feature**: `specs/003-rewards-system`
**Date**: 2026-07-04

---

## Modified Entities

### `completions` — Status machine extension + duration

**Changed column**: `status: String`

| Old values | New values |
|---|---|
| `processing` | `processing` (unchanged) |
| `ready` | ~~`ready`~~ **removed** |
| `self_reported` | `self_reported` (unchanged) |
| — | `pending_verification` (new) |
| — | `verified` (new) |
| — | `rejected` (new) |

**New column**: `duration_minutes: Integer, nullable` — set from the client's duration dropdown at upload time. Required (enforced in the service layer) when the completed activity's resolved tier is `casual`; optional otherwise.

**State transitions**:

```
processing
    └── compress_photo completes → pending_verification

pending_verification
    ├── admin approves (group challenge)     → verified   (points awarded)
    ├── admin rejects  (group challenge)      → rejected   (no points)
    └── auto-approval sweeps (group_id NULL)  → verified   (points awarded; policy_type = "timed")

verified
    └── family re-uploads → verified (photo_key updated; status/points unchanged)

rejected
    └── family re-uploads → pending_verification (rejection_reason cleared from latest
                                                    photo_verifications entry)

self_reported
    └── terminal (no transitions; never earns points)
```

**Impact on existing code**:
- `_compress_async`: set `status = "pending_verification"` (was `"ready"`)
- `_completion_dict`, `get_photo_url`, `get_group_feed`, `get_my_history`: gate URL generation on `status in ("pending_verification", "verified", "rejected")` instead of `status == "ready"`
- `delete_completion`: add `"pending_verification"` and `"verified"` to the set of statuses that have a photo to delete
- Upload entrypoint: accept and persist `duration_minutes`; validate presence when tier is casual

---

### `activities` — Effort tier

**New column**: `effort_tier: String, NOT NULL` — values `casual | dedicated`. Marketplace classification is **derived**, not stored here (see `resolve_tier()` in `research.md`): an activity is marketplace-tier for point purposes if `cost_indicator == "paid"` or `is_partner_content == true`, regardless of `effort_tier`.

**Backfill (OD-101)**: the 30 existing seed activities are classified by duration/structure — `estimated_duration_minutes ≥ 45` or clearly planned/structured activities (board game night, cooking project, bike outing, teaching to ride a bike) → `dedicated`; the rest → `casual`. Exact per-row mapping is finalized in the migration data-fill and should get a quick sign-off pass from the business team (flagged as OD-101).

---

### `challenges` — Featured flag

**New column**: `is_featured: Boolean, NOT NULL, DEFAULT false` — marks a challenge as a "community challenge" per the business model. Verified completions inside a featured challenge earn +5 bonus points on top of the base tier award. Set at creation time or via seed data (OD-104); no dedicated admin toggle UI in v1.

---

## New Tables

### `point_ledger_entries`

Immutable record of a single point award. The family's current-quarter balance is the aggregate sum of rows in the current quarter — there is no stored running balance.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `family_id` | UUID | FK → `families.id` CASCADE |
| `completion_id` | UUID | FK → `completions.id` CASCADE; **UNIQUE** |
| `base_points` | Integer | NOT NULL, ≥ 0 (3 casual / 6 dedicated / 15 marketplace, or 0 if casual under 30 min) |
| `bonus_points` | Integer | NOT NULL, DEFAULT 0 (+5 if the challenge is featured) |
| `awarded_at` | TIMESTAMPTZ | NOT NULL — determines which quarter the points land in (verification time, not upload time) |
| `created_at` | TIMESTAMPTZ | NOT NULL |

**Unique constraint on `completion_id`**: guarantees at most one ledger entry per completion — this is the idempotency mechanism (FR-015), replacing any need for application-level locking around point awards.

**Quarter balance query**:
```sql
SELECT COALESCE(SUM(base_points + bonus_points), 0)
FROM point_ledger_entries
WHERE family_id = :family_id
  AND awarded_at >= :quarter_start
  AND awarded_at < :quarter_end
```
Quarter boundaries computed in UTC for v1 (OD-102).

---

### `reward_levels`

Seeded, system-wide reward tiers. Not admin-editable; not per-group.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `level_number` | Integer | NOT NULL, UNIQUE (1–4) |
| `points_threshold` | Integer | NOT NULL, > 0 (50 / 100 / 150 / 250) |
| `title` | Text | NOT NULL (German) |
| `title_en` | Text | NULLABLE |
| `description` | Text | NULLABLE (German) |
| `description_en` | Text | NULLABLE |
| `choice_options` | JSONB | NULLABLE — e.g. `["supermarket_voucher", "streaming_month"]` for Level 3; NULL for levels with a single fixed reward |
| `annual_redemption_cap` | Integer | NULLABLE — `3` for Level 4; NULL for Levels 1–3 |
| `created_at` | TIMESTAMPTZ | NOT NULL |

**Seed data** (migration inserts these 4 rows):

| level_number | points_threshold | title | choice_options | annual_redemption_cap |
|---|---|---|---|---|
| 1 | 50 | Kostenloses BOND Marktplatz-Erlebnis | NULL | NULL |
| 2 | 100 | Kinokarten | NULL | NULL |
| 3 | 150 | Supermarktgutschein oder Disney+/Netflix-Monat | `["supermarket_voucher", "streaming_month"]` | NULL |
| 4 | 250 | LEGO-Set oder Musik-/Keramikkurs | NULL | 3 |

---

### `redemptions`

Immutable audit record of each level redemption.

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `family_id` | UUID | FK → `families.id` CASCADE |
| `reward_level_id` | UUID | FK → `reward_levels.id` CASCADE |
| `quarter_key` | Text | NOT NULL — e.g. `"2026-Q3"`; used for the once-per-quarter uniqueness check |
| `chosen_option` | Text | NULLABLE — required when the level has `choice_options` (Level 3), stores the selected value |
| `points_at_redemption` | Integer | NOT NULL — snapshot of the family's quarter balance at redemption time |
| `voucher_code` | Text | NOT NULL — placeholder code generated at redemption (`BOND-XXXXXX`); no inventory table in v1 |
| `redeemed_at` | TIMESTAMPTZ | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |

**Unique constraint**: `(family_id, reward_level_id, quarter_key)` — enforces "at most once per family per level per quarter" (FR-022) at the database level.

**Level 4 annual cap check** (FR-023, application-level, checked before insert):
```sql
SELECT COUNT(*) FROM redemptions
WHERE family_id = :family_id
  AND reward_level_id = :level_4_id
  AND redeemed_at >= :year_start AND redeemed_at < :year_end
-- reject if count >= 3
```

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
| `policy_type` | Varchar | NOT NULL, DEFAULT `'manual'`; enum: `manual \| timed \| llm` (`llm` reserved for the planned AI-validation evolution, not implemented in v1) |
| `reviewed_at` | TIMESTAMPTZ | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |

**GDPR note**: `reviewer_user_id` is SET NULL on user deletion. `completion_id` CASCADE-deletes when a completion is deleted (which CASCADE-deletes when a family is deleted). The rejection reason visible to the family is read from the most recent `photo_verifications` row with `action = 'rejected'` for a given `completion_id`.

---

## Relationships Summary

```
families (1) ─── (0..*) point_ledger_entries
families (1) ─── (0..*) redemptions

reward_levels (1) ─── (0..*) redemptions

completions (1) ─── (0..1) point_ledger_entries   (unique on completion_id)
completions (1) ─── (0..*) photo_verifications

challenges (1) ─── (0..*) completions   (via challenge_activities, unchanged)
```

Note the deliberate absence of any `group_id` on `point_ledger_entries`, `reward_levels`, or `redemptions` — the point economy is family-global, not group-scoped (see spec.md "Deprecated from Rev 1"). Provenance of which group/challenge produced a given ledger entry remains recoverable via `completion_id → challenge_activity_id → challenge_id → group_id` if ever needed for reporting.

---

## Migration Strategy

Single Alembic revision: `<hash>_add_rewards_system.py`

Order within the migration:
1. `ALTER TABLE activities ADD COLUMN effort_tier VARCHAR NOT NULL DEFAULT 'casual'` (temporary default for the ALTER; immediately followed by the backfill in step 2, then the column keeps `NOT NULL` with no default going forward for new rows — the service layer always sets it explicitly)
2. Data migration: backfill `effort_tier = 'dedicated'` for the seed activities identified in OD-101 (by title match, same pattern as `relink_collage_presets.py`); all others remain `casual`
3. `ALTER TABLE challenges ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false`
4. `ALTER TABLE completions ADD COLUMN duration_minutes INTEGER NULL`
5. Data migration: `UPDATE completions SET status = 'verified' WHERE status = 'ready'`
6. `CREATE TABLE point_ledger_entries …`
7. `CREATE TABLE reward_levels …` + seed 4 rows (50/100/150/250, per table above)
8. `CREATE TABLE redemptions …`
9. `CREATE TABLE photo_verifications …`

Deferred to a later cleanup migration (not part of this feature): dropping `users.points_balance`, since FR-019 only requires the client to stop reading it, not an immediate schema change.
