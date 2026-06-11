---
name: stakeholders-parents
description: Primary user — German-speaking parent, cognitively loaded, varying digital literacy
type: stakeholder
last_updated: 2026-06-11
---

# Stakeholder: Parent

## Who They Are

The only authenticated account type. An adult (or two co-parents) with one or more children aged approximately 5–10. The prototype targets **German-speaking** parents only.

## Key Characteristics

| Attribute | Detail |
|---|---|
| Cognitive load | High — app must reduce planning overhead, not add to it |
| Digital literacy | Varies — onboarding must be minimal and self-explanatory |
| Sensitivity | Must never feel judged, shamed, or compared against other families |
| Language | German (prototype); internationalisation deferred |
| Family structure | 1–2 parents per family; app supports blended/divorced households (one parent can belong to multiple families) |

## Role in the System

- Authenticates via Google OAuth (single sign-on)
- Creates a **Family** unit; invites a second parent via a FamilyInvite link
- Creates **ChildProfiles** (nickname, DOB, optional interests)
- Joins or creates **Groups** (e.g., KITA class)
- Completes activities and fills collage slots with photos
- May hold **GroupAdmin** rights for specific groups

## Entry Points

**Invite path (expected majority):** KITA teacher or friend shares an invite link → parent taps it → sign in → GDPR consent → child profile → auto-joins the group.

**Cold download (minority):** parent discovers app independently → goes through full onboarding → must create or find a group separately.

## Key UX Concerns

- First win = completing first activity as fast as possible after joining a group
- Empty collage slots framed as "available to fill", not "missed"
- No comparative metrics between families
- Social sharing is opt-in per completion (default: private)

## Adoption Decision Role

Decision-maker (downloads app, accepts consent), influenced by KITA teacher or peer group.

## Open Questions

- Will parents tolerate the limitation of Google-only sign-in, or will some be blocked by lack of a Google account?
- How much friction is acceptable in the GDPR consent step for a parent who just received an invite link?

See → [overview.md](../overview.md), [design/user-journeys.md](../design/user-journeys.md)
