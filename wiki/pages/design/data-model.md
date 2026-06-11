---
name: design-data-model
description: All 10 entities, relationships, lifecycle states, and key data-governance decisions
type: design
last_updated: 2026-06-11
---

# Design: Data Model

Source: `docs/planning/data-model-brief.md`

No FHIR, no EHR integration — app-internal only. All data stays in PostgreSQL + S3.

---

## Entity Map

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

---

## Entity Reference

### User
Authenticated parent. Admin is a per-group/per-family property, not global.

Key fields: `google_sub`, `email`, `display_name`, `profile_photo_key`, `points_balance`, `deletion_pending_at`

### Family
Primary unit of participation. Children, group memberships, and completions all belong to a Family, not an individual parent.

- ≥1 parent members (typically 1–2)
- Second parent joins via a FamilyInvite link
- A parent can belong to multiple families (blended/divorced households)

### FamilyMembership
No admin role — all family members are equal. Any member can invite others; any member can leave; no one can remove another member.

### FamilyInvite
Single-use, 7-day expiry. Redeemed by a second parent joining the family. Revocable by deleting the row.

### ChildProfile
Belongs to Family (not User). Any parent in the family can manage it.

Key fields: `nickname`, `date_of_birth` (age derived at query time), `interests` (optional free-text tags)

Privacy: never visible outside the family's groups; `date_of_birth` never in group-visible responses.

### Group
Invite-only set of families. A group admin is an individual parent (not a family).

### GroupMembership
Families join groups — not individual parents. Both parents of a family are implicitly members.

### GroupAdmin
Separate from GroupMembership. Tracks which individual parents hold admin rights. A group must always have ≥1 GroupAdmin. Multiple parents can share admin in the same group.

### GroupInvite
Single-use, 7-day expiry. Redeeming parent must already have a family.

### Activity
Curated offline task managed by foundation admins. Key fields: `title`, `description`, `estimated_duration_minutes`, `age_min`, `age_max`, `cost_indicator` (`free`|`low_cost`|`paid`), `season_relevance`, `weather_suitability`, `is_partner_content`.

**Paid activities are never surfaced as primary suggestions (service-layer rule, not a DB constraint).**

### Challenge
A set of activities with a start/end date. `group_id` nullable → personal/family challenge. Challenge state (upcoming/active/completed) is derived at query time — no stored state column.

| State | Condition |
|---|---|
| `upcoming` | `start_date > today` |
| `active` | `start_date ≤ today ≤ end_date` |
| `completed` | `end_date < today` |

### ChallengeActivity
Join table between Challenge and Activity. `grid_position` is visual layout only — not completion order.

### Completion
One per `(family_id, challenge_activity_id)`. Re-attempt overwrites the record.

States: `processing` (photo compression running), `ready` (compressed photo available), `self_reported` (no photo).

`shared_to_feed` default false. `completed_by_user_id` tracks which parent submitted.

**Collage ownership:** derived at query time — the set of Completions for `(family_id, challenge_id)`. Not stored.

On account deletion: if the deleted parent was the sole family member, `family_id` is nulled and `photo_key`/`caption` are cleared (GDPR anonymisation). Otherwise Completion is untouched.

### ConsentRecord
Append-only GDPR consent log. Per-user. Fields: `policy_version`, `consented_at`, `data_storage_consent`, `photo_processing_consent`, `location_consent`.

---

## Key Governance Decisions

| Concern | Decision |
|---|---|
| Primary keys | UUID everywhere (`gen_random_uuid()`) |
| Timestamps | `TIMESTAMPTZ`, stored in UTC |
| Deletes | Hard deletes only (GDPR compliance) |
| ConsentRecord | Append-only — never update in place |
| ChildProfile visibility | Service layer enforces family membership |
| Photo access | Private S3 bucket; pre-signed URLs; 15-min TTL |
| Last-admin protection | Service layer blocks removal of last GroupAdmin |
| Account deletion | `deletion_pending_at` set immediately; async job within 30 days |

See → [design/architecture.md](architecture.md), [regulatory/compliance-landscape.md](../regulatory/compliance-landscape.md)
