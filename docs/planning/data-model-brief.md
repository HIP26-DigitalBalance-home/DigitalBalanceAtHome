# Data Model Planning Brief — DigitalBalance @home
**Version:** 0.2 | **Status:** Draft | **Date:** 2026-05-29

---

## FHIR Decision

**This app is app-internal only. No FHIR, no EHR integration, no clinical export.**

All data stays in the application's PostgreSQL database and S3-compatible object storage. No standard clinical terminologies are needed.

---

## Core Entities

### User
Authenticated parent account. The only account type. Admin status is a per-group and per-family property, not global.

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

---

### Family
The primary unit of participation. Children, group memberships, and challenge completions all belong to a Family, not to individual parents.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `name` | string? | Optional display name, e.g. "The Garcia Family" |
| `created_at` | timestamptz | UTC |

A Family has ≥1 parent members. In practice this is 1 (single-parent household) or 2 (two-parent household) for the prototype.

---

### FamilyMembership
Connects parents to their family. Carries the family-level admin role.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `family_id` | UUID | FK → Family |
| `user_id` | UUID | FK → User |
| `role` | enum | `admin` \| `member` |
| `joined_at` | timestamptz | UTC |

- A family must always have at least one `admin`; the last admin cannot be demoted or removed.
- A parent can be a member of multiple families (e.g. divorced parent across two households). Prototype does not restrict this.
- The parent who creates the family is automatically granted the `admin` role.

---

### FamilyInvite
Single-use token for a second parent to join an existing family. Same mechanics as GroupInvite.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `family_id` | UUID | FK → Family |
| `token` | UUID | Opaque token sent in the invite URL |
| `created_by_user_id` | UUID | FK → User |
| `expires_at` | timestamptz | +7 days |
| `used_by_user_id` | UUID? | Set on use; nullable |
| `used_at` | timestamptz? | Set on use; nullable |

Revocation is done by deleting the row.

---

### ChildProfile
A non-authenticated child representation. Belongs to a Family, not to an individual parent. Any `admin` parent in the family can create, edit, or delete child profiles.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `family_id` | UUID | FK → Family |
| `nickname` | string | Name or nickname; never a login credential |
| `date_of_birth` | date | Age derived at query time; never stored as a computed field |
| `interests` | string[]? | Free-text tags — used as a suggestion filter signal alongside age, season, and weather; see compliance note re: sensitive data |
| `created_at` | timestamptz | UTC |
| `updated_at` | timestamptz | UTC |

Child profiles are never visible outside the family's groups. Service layer enforces: requester must be a member of the owning Family.

---

### Group
A set of families sharing one or more challenges. Invite-only.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `name` | string | |
| `description` | string? | Nullable |
| `created_by_user_id` | UUID | FK → User |
| `created_at` | timestamptz | UTC |

---

### GroupMembership
Connects a Family to a Group. Admin status is tracked separately in GroupAdmin (because admins are individual parents, not families).

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `family_id` | UUID | FK → Family |
| `group_id` | UUID | FK → Group |
| `joined_at` | timestamptz | UTC |

- A family joins a group — both parents in that family are implicitly members.
- The family of the parent who creates the group is automatically added as the first GroupMembership.

---

### GroupAdmin
Tracks which individual parents hold admin rights within a group. Separate from GroupMembership because admins are users, not families.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `group_id` | UUID | FK → Group |
| `user_id` | UUID | FK → User; must be a member of a family that has a GroupMembership in this group |
| `granted_at` | timestamptz | UTC |

- A group must always have at least one GroupAdmin row.
- A parent can be GroupAdmin in multiple groups.
- Multiple parents can be GroupAdmin in the same group.

---

### GroupInvite
Single-use token for a family to join a group. The parent who redeems the token triggers creation of a GroupMembership for their family.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `group_id` | UUID | FK → Group |
| `token` | UUID | Opaque token sent in the invite URL |
| `created_by_user_id` | UUID | FK → User |
| `expires_at` | timestamptz | +7 days |
| `used_by_user_id` | UUID? | Set on use; nullable |
| `used_at` | timestamptz? | Set on use; nullable |

The redeeming parent must already have a Family. If they have no family, the join is blocked at the service layer with a clear error directing them to create one first.

---

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
| `is_partner_content` | boolean | Default false |
| `created_at` | timestamptz | UTC |
| `updated_at` | timestamptz | UTC |

Paid activities are never surfaced as primary suggestions (service-layer rule, not a DB constraint).

---

### Challenge
A set of activities for a group or a family to complete together over a period. Prototype supports collage mode only.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `title` | string | |
| `description` | text? | Nullable |
| `group_id` | UUID? | FK → Group; nullable — null means a personal/family challenge |
| `created_by_user_id` | UUID | FK → User; the specific parent who created it |
| `start_date` | date | UTC date |
| `end_date` | date | UTC date (inclusive) |
| `display_mode` | enum | `collage` only in prototype |
| `template_id` | UUID? | FK → ChallengeTemplate; nullable |
| `created_at` | timestamptz | UTC |

**Personal challenge access:** when `group_id` is null, the challenge belongs to the creating parent's family. Any parent who is a member of that family can view and manage it. Access is derived at query time: `Challenge.created_by_user_id` → `FamilyMembership.user_id` → `Family`.

---

### ChallengeActivity
Join table between Challenge and Activity. `grid_position` is a visual layout property, not a completion order.

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `challenge_id` | UUID | FK → Challenge |
| `activity_id` | UUID | FK → Activity |
| `grid_position` | integer | Zero-based index in the collage grid; unique per challenge |

---

### Completion
Records that a Family completed a specific ChallengeActivity. A family shares one collage — either parent can complete an activity on the family's behalf.

One Completion per `(family_id, challenge_activity_id)` pair. A second attempt by either parent overwrites the record (photo + caption updated, `completed_by_user_id` updated).

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `challenge_activity_id` | UUID | FK → ChallengeActivity |
| `family_id` | UUID | FK → Family |
| `completed_by_user_id` | UUID | FK → User; which parent uploaded or marked it |
| `status` | enum | `processing` \| `ready` \| `self_reported` |
| `photo_key` | string? | S3 key of compressed photo; null until compression done |
| `raw_photo_key` | string? | S3 key of original upload; deleted after compression |
| `caption` | string? | Optional short text; nullable |
| `shared_to_feed` | boolean | Default false; opt-in per completion |
| `completed_at` | timestamptz | UTC; set on creation, updated on re-attempt |
| `updated_at` | timestamptz | UTC |

**Group aggregate view:** "X of Y families completed this activity." Not per-parent.

**On account deletion:** if the deleted parent was the only family member, `family_id` on orphaned Completions is nulled and `photo_key`/`caption` are cleared (GDPR anonymisation). If the other parent remains in the family, the Completion is untouched.

---

### ConsentRecord
Append-only GDPR consent log. Per-user (each parent consents individually).

| Attribute | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → User |
| `policy_version` | string | e.g. `"1.0"` |
| `consented_at` | timestamptz | UTC |
| `data_storage_consent` | boolean | Required |
| `photo_processing_consent` | boolean | Required for photo-based completions |
| `location_consent` | boolean | Optional; for weather-based suggestions |

---

## Entity Relationships

```
User ──< FamilyMembership >── Family
                               │
                               ├──< FamilyInvite
                               ├──< ChildProfile
                               ├──< GroupMembership >── Group
                               │                         │
                               │                         ├──< GroupInvite
                               │                         ├──< GroupAdmin >── User
                               │                         └──< Challenge
                               │                                 └──< ChallengeActivity >── Activity
                               └──< Completion >── ChallengeActivity
                                       └──o User  (completed_by_user_id)

User ──< ConsentRecord
```

### Notable cardinalities

- A User can be a FamilyMembership member in ≥1 families (prototype allows this for blended/divorced households).
- A Family can be a GroupMembership member in many Groups.
- A ChallengeActivity has many Completions — one per participating Family.
- A Family has at most one Completion per ChallengeActivity (unique on `family_id + challenge_activity_id`).
- A User can hold GroupAdmin rights in many Groups, and FamilyMembership admin in many Families.

**Collage ownership:** A family's collage is derived at query time — the set of Completions for `(family_id, challenge_id)`. Not a stored entity. The group-level view aggregates how many families have a Completion for each ChallengeActivity.

---

## Lifecycle States

### Challenge
Derived at query time — no stored state column.

| State | Condition |
|---|---|
| `upcoming` | `start_date > today` |
| `active` | `start_date <= today <= end_date` |
| `completed` | `end_date < today` |

### Completion

| State | Meaning |
|---|---|
| `processing` | Photo uploaded; background compression running |
| `ready` | Compressed photo available at `photo_key` |
| `self_reported` | Marked complete with no photo |

### GroupInvite / FamilyInvite

| State | Condition |
|---|---|
| active | `used_at IS NULL AND expires_at > now()` |
| used | `used_at IS NOT NULL` |
| expired | `used_at IS NULL AND expires_at <= now()` |

---

## Governance and Data Quality

| Concern | Decision |
|---|---|
| Primary keys | UUID everywhere (`gen_random_uuid()`); no sequential integers |
| Timestamps | All `TIMESTAMPTZ`, stored in UTC |
| Deletes | Hard deletes only — no soft-delete columns (GDPR compliance) |
| ConsentRecord | Append-only; never update in place — always insert a new row |
| ChildProfile visibility | Service layer: requester must be a FamilyMembership member of the owning Family |
| `date_of_birth` sensitivity | Never included in group- or feed-visible API responses |
| Photo access | Private S3 bucket; pre-signed URLs (15-min TTL); service validates family group membership before issuing a URL |
| `points_balance` | Denormalised on User; acceptable for prototype |
| Personal challenge access | Derived from `created_by_user_id` → FamilyMembership → all family members |
| Last-admin protection | Removing the last GroupAdmin or last FamilyMembership admin is rejected at the service layer |
| Account deletion | `deletion_pending_at` set immediately; async job within 30 days: deletes S3 photos, removes FamilyMembership, clears PII on Completions if sole family member, hard-deletes ConsentRecord and User |
| Interests field | Free-text string array; in-app hint warns against entering medical conditions (compliance D5) |

---

## Resolved Modeling Decisions

| Decision | Outcome |
|---|---|
| Family as primary unit | Children, group memberships, and completions belong to Family, not User |
| Family size | ≥1 parent members; in practice 1–2 for prototype |
| Admin roles | Two types: FamilyMembership role (`admin`\|`member`) and GroupAdmin (separate entity linking user to group) |
| Personal challenge ownership | Owned by the creating parent's family; any family member can view and manage it |
| Collage ownership | Per-family; one collage per family per challenge; either parent can complete slots |
| Group aggregate | "X of Y families completed" — not per-parent |
| Personal challenges (no group) | `group_id` nullable on Challenge; access derived from creator's family membership |
| Activity suggestion inputs | Age + season + weather + child interests — all four signals |
| No FHIR | App-internal only; no clinical export planned |
