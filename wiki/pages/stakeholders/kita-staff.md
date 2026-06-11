---
name: stakeholders-kita-staff
description: KITA teachers and day-care staff — act as group admins; key distribution channel for invite links
type: stakeholder
last_updated: 2026-06-11
---

# Stakeholder: KITA Staff / Teacher

## Who They Are

Kindergarten teachers, KITA educators, and similar day-care staff who act as **group organisers** for a class of families. In the prototype they are not a distinct account type — a KITA teacher is a parent account with **GroupAdmin** rights over a specific group.

## Role in the System

- Creates a Group (e.g., "Sonnenblumen KITA – Frühjahrs-Challenge 2026")
- Generates an invite link and distributes it to class families (typically via a messaging app, printed notice, or email)
- Assigns or removes other admins
- May manage challenges associated with the group

## Why They Matter

KITA staff are the **primary distribution channel** for the prototype. If the invite-link flow is too cumbersome for a teacher with 20 families to onboard, adoption fails. Minimising friction at this step is critical.

## Key UX Concerns

- Invite link must be copy-pasteable and shareable in one tap
- Admin controls must be discoverable in-context (not buried in settings)
- Removing a family from a group must be easy but protected by a confirmation dialog

## Adoption Decision Role

Influencer and gatekeeper — they decide whether to use the app with their class and whether to recommend it to colleagues.

## Open Questions

- Will KITA staff be willing to create their own account (parent account type) to act as group admin, or will the foundation need a distinct staff account type for MVP?
- Should the invite link work as a multi-use link for a class-sized batch join, or is single-use acceptable if teachers generate one per family?

See → [stakeholders/parents.md](parents.md), [overview.md](../overview.md), [design/user-journeys.md](../design/user-journeys.md)
