# Data Model Planning Brief — DigitalBalance @home
**Version:** 0.1 | **Status:** Draft | **Date:** 2026-05-28

---

## FHIR Decision

**This app is app-internal only. No FHIR, no EHR integration, no clinical export.**

The data captured (activity completions, child profiles, collage photos) is behavioural and social, not clinically meaningful in a medical sense. The challenge owners and clinical advisors confirmed no research or EHR data exchange is planned. Adding FHIR would introduce significant complexity with no benefit at this stage.

All data stays in the application's PostgreSQL database and S3-compatible object storage. No standard clinical terminologies (LOINC, SNOMED CT, RxNorm) are needed.

---

## Core Entities

### User
Authenticated parent account. The only account type — admin status is a per-group property, not a global role.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `google_sub` | string | Google OIDC subject identifier; unique |
| `email` | string | From Google ID token; unique |
| `display_name` | string | Editable by user |
| `profile_photo_key` | string? | S3 key; nullable |
| `points_balance` | integer | Prototype placeholder; incremented on completion |
| `deletion_pending_at` | timestamptz? | Set on deletion request; null = active account |
| `created_at` | timestamptz | UTC |
| `updated_at` | timestamptz | UTC |

### ChildProfile
Non-authenticated child representation, owned by one parent. Never directly shared outside the parent's groups.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `parent_user_id` | UUID | FK → User |
| `nickname` | string | Name or nickname; never a login credential |
| `date_of_birth` | date | Age derived at query time; never stored as a computed field |
| `interests` | string[] | Free-text tags; optional — used as an additional filter signal in activity suggestions alongside age, season, and weather |
| `created_at` | timestamptz | UTC |
| `updated_at` | timestamptz | UTC |

### Group
A set of parents sharing one or more challenges. Invite-only.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `name` | string | |
| `description` | string? | Nullable |
| `created_by_user_id` | UUID | FK → User |
| `created_at` | timestamptz | UTC |

### GroupMembership
Join table between User and Group. Carries role.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → User |
| `group_id` | UUID | FK → Group |
| `role` | enum | `member` \| `admin` |
| `joined_at` | timestamptz | UTC |

A user who creates a group is automatically an `admin` member. Admin rights can be transferred but not removed from the last admin (group must always have at least one admin).

### Invite
Single-use token for joining a group. Expires after 7 days.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `group_id` | UUID | FK → Group |
| `token` | UUID | Opaque token sent in the invite URL |
| `created_by_user_id` | UUID | FK → User |
| `expires_at` | timestamptz | Created_at + 7 days |
| `used_by_user_id` | UUID? | Set on use; nullable |
| `used_at` | timestamptz? | Set on use; nullable |

An invite is considered consumed once `used_by_user_id` is set. Revocation is done by deleting the row.

### Activity
A curated offline activity in the shared pool. Managed by foundation admins via API.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `title` | string | |
| `description` | text | |
| `estimated_duration_minutes` | integer | |
| `age_min` | integer | Minimum child age in years |
| `age_max` | integer | Maximum child age in years |
| `cost_indicator` | enum | `free` \| `low_cost` \| `paid` |
| `season_relevance` | enum[]? | `spring` \| `summer` \| `autumn` \| `winter`; null = year-round |
| `weather_suitability` | enum[]? | `sunny` \| `cloudy` \| `rainy` \| `any` |
| `is_partner_content` | boolean | Default false; partner activities must be clearly labelled |
| `created_at` | timestamptz | UTC |
| `updated_at` | timestamptz | UTC |

Paid activities (`cost_indicator = 'paid'`) are never surfaced as primary suggestions (enforced in the service layer, not by a DB constraint).

### Challenge
A set of activities assigned to a group over a defined period. The prototype supports collage mode only.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `title` | string | |
| `description` | text? | Nullable |
| `group_id` | UUID | FK → Group |
| `created_by_user_id` | UUID | FK → User |
| `group_id` | UUID? | FK → Group; nullable — null means a personal challenge owned by the creator with no group |
| `start_date` | date | UTC date |
| `end_date` | date | UTC date (inclusive) |
| `display_mode` | enum | `collage` only in prototype |
| `template_id` | UUID? | FK → ChallengeTemplate; nullable if created from scratch |

A Challenge with `group_id = null` is a personal challenge — only the creating parent participates and fills the collage.
| `created_at` | timestamptz | UTC |

### ChallengeActivity
Join table between Challenge and Activity. The `grid_position` field determines where the slot appears in the collage grid — it is a visual layout property, not a completion order constraint.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `challenge_id` | UUID | FK → Challenge |
| `activity_id` | UUID | FK → Activity |
| `grid_position` | integer | Zero-based index in the collage grid; unique per challenge |

### Completion
Records that a specific parent completed a specific ChallengeActivity. Each parent in a group fills their **own** collage — slots are not shared. Every group member is expected to complete every activity independently and upload their own photo.

One Completion per `(user_id, challenge_activity_id)` pair — a second attempt overwrites the existing record (photo + caption updated, timestamp refreshed).

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `challenge_activity_id` | UUID | FK → ChallengeActivity |
| `user_id` | UUID | FK → User |
| `status` | enum | `processing` \| `ready` \| `self_reported` |
| `photo_key` | string? | S3 key of compressed photo; null until compression done |
| `raw_photo_key` | string? | S3 key of original upload; deleted after compression |
| `caption` | string? | Optional short text; nullable |
| `shared_to_feed` | boolean | Default false; opt-in per completion |
| `completed_at` | timestamptz | UTC; set on creation, updated on re-attempt |
| `updated_at` | timestamptz | UTC |

On account deletion, `user_id` is set to null and `photo_key` / `caption` are cleared. The row itself is retained for aggregate challenge statistics (e.g., total completions per challenge).

### ConsentRecord
Append-only GDPR consent log. A new row is written on first consent and on re-consent after a policy version change. Never updated in place.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → User |
| `policy_version` | string | e.g., `"1.0"` |
| `consented_at` | timestamptz | UTC |
| `data_storage_consent` | boolean | Required; must be true to use the app |
| `photo_processing_consent` | boolean | Required for photo-based completions |
| `location_consent` | boolean | Optional; required only for weather-based suggestions |

---

## Entity Relationships

```
User ──< ChildProfile
User ──< GroupMembership >── Group
Group ──< Invite
Group ──< Challenge
Challenge ──< ChallengeActivity >── Activity
User ──< Completion
ChallengeActivity ──< Completion
User ──< ConsentRecord
```

Notable cardinalities:
- A User can be a member (and/or admin) of many Groups.
- A Challenge belongs to exactly one Group.
- A ChallengeActivity has many Completions — one per group member. Every member fills their own collage independently; slots are not shared.
- A User has at most one Completion per ChallengeActivity (unique constraint on `user_id + challenge_activity_id`).

**Collage ownership:** A parent's collage is not a stored entity — it is derived at query time as the set of Completions for `(user_id, challenge_id)`. The group-level view is an aggregate: for each ChallengeActivity, how many group members have a Completion (and optionally, which members have shared theirs to the feed).

---

## Lifecycle States

### Challenge

| State | Condition |
|---|---|
| `upcoming` | `start_date > today` |
| `active` | `start_date <= today <= end_date` |
| `completed` | `end_date < today` |

State is derived at query time — not stored. No state column needed.

### Completion

| State | Meaning |
|---|---|
| `processing` | Photo uploaded, background compression running |
| `ready` | Compressed photo available at `photo_key` |
| `self_reported` | Marked complete with no photo |

Transitions: `processing` → `ready` (on worker completion). `self_reported` is set directly at creation with no intermediate state.

### Invite

| State | Condition |
|---|---|
| active | `used_at IS NULL AND expires_at > now()` |
| used | `used_at IS NOT NULL` |
| expired | `used_at IS NULL AND expires_at <= now()` |

State is derived at query time — not stored.

---

## Governance and Data Quality

| Concern | Decision |
|---|---|
| Primary keys | UUID everywhere (`gen_random_uuid()`); no sequential integers |
| Timestamps | All `TIMESTAMPTZ`, stored in UTC |
| Deletes | Hard deletes only — no soft-delete columns. Simplifies GDPR erasure. |
| ConsentRecord | Append-only. Never update a consent row — always insert a new one. |
| ChildProfile visibility | Service layer enforces: a child profile is never returned to any user other than the owning parent |
| `date_of_birth` sensitivity | Access-controlled; never included in group-visible API responses |
| Photo access | S3 bucket is private; all photo access via pre-signed URLs (15-min TTL); service validates group membership before issuing a URL |
| `points_balance` | Denormalised on User for simplicity; acceptable for prototype. A future ledger table (one row per award event) would enable auditing and rollback. |
| Activity suggestion — `paid` filter | Enforced in the service layer (`ActivityService.get_suggestions`), not a DB constraint — keeps the constraint visible in code |
| Account deletion | `deletion_pending_at` set immediately; async job runs within 30 days: deletes photos from S3, clears PII fields from Completion rows, hard-deletes ChildProfile, GroupMembership, ConsentRecord, User |
| Interests field | Free-text string array for prototype; no controlled vocabulary. Consider a tag normalisation table if user-entered interests are later used for filtering. |

---

## Resolved Modeling Decisions

| Decision | Outcome |
|---|---|
| Personal challenges (no group) | `group_id` is nullable on Challenge; a null value means a personal challenge owned by the creator only |
| Activity suggestion inputs | Age + season + weather + child interests — all four signals are used |
