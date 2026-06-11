---
name: stakeholders-children
description: Indirect beneficiaries — no account, represented only via parent's child profile
type: stakeholder
last_updated: 2026-06-11
---

# Stakeholder: Child

## Who They Are

Children aged approximately 5–10, the indirect beneficiaries of the app. **They have no account and cannot use the app directly.** They are represented entirely through a parent-managed **ChildProfile**.

## Data Held About Them

| Field | Notes |
|---|---|
| Nickname | Name or nickname; never used as a login credential |
| Date of birth | Stored; age derived at query time |
| Interests | Optional free-text tags — used as a suggestion filter signal |

## Privacy Constraints

- `date_of_birth` and interests are **never included in any API response visible to other users**
- Child profiles are accessible only to parents in the same Family
- Photos may contain identifiable images of minors → stored in private S3 bucket; served only via pre-signed URLs with 15-min TTL; validated against group membership before a URL is issued

## Legal Considerations

Processing photos **of** children requires a lawful basis under GDPR even though children have no accounts. The intended basis is parental consent on behalf of the child. This framing needs legal review before launch.

See → [regulatory/compliance-landscape.md](../regulatory/compliance-landscape.md) (R1, R2)

## Role in Activity Suggestion

A child's age and interests (when provided) are used as input signals for `GET /activities/suggestions`. If no child profile has interests, the system falls back to age-appropriate random suggestions.

See → [design/data-model.md](../design/data-model.md) (ChildProfile), [overview.md](../overview.md)
