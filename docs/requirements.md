# Software Requirements Specification
**Project:** Family Bonding Activity App  
**Version:** 0.1 (pre-prototype)  
**Date:** 2026-05-21  
**Status:** Draft — pending client review

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Stakeholders](#3-stakeholders)
4. [Assumptions and Constraints](#4-assumptions-and-constraints)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [User Stories](#7-user-stories)
8. [Out of Scope](#8-out-of-scope)
9. [Open Questions](#9-open-questions)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the software requirements for a family bonding mobile application. It serves as the authoritative reference for the development team, product owner, and client stakeholders during the design, prototype, and MVP phases.

### 1.2 Scope

The system consists of two components:

- **Backend API server** built with FastAPI (Python), responsible for all business logic, data persistence, and third-party integrations.
- **Client application** targeting mobile form factors (framework TBD — mobile-first webapp or native iOS app).

The application encourages parents to spend intentional offline time with their children by proposing activities, allowing families to document completed activities with photos, and providing light social features within trusted small groups.

### 1.3 Definitions

| Term | Definition |
|------|------------|
| **Parent** | Primary end-user of the application. An adult registered in the system with one or more associated child profiles. |
| **Child profile** | A non-account profile managed by a parent, storing age, interests, and activity history. Children do not have login credentials. |
| **Activity** | A concrete, offline task a parent can do with their child (e.g., bake cookies, go to the park). |
| **Challenge** | A curated collection of activities grouped into a shared session, completed over a defined period. |
| **Group** | A set of parent accounts that share a challenge (e.g., a kindergarten class, a group of friends). |
| **Collage** | A visual artifact (grid of photos) produced by completing activities within a challenge. |
| **Foundation** | The client organization (non-profit) commissioning and overseeing the project. |
| **Partner** | An external organization (business, workshop provider) that supplies rewards or activity suggestions. |

### 1.4 Document Conventions

- Requirements are labeled `FR-XXX` (functional) and `NFR-XXX` (non-functional).
- Priority levels: **P1** (must-have for prototype), **P2** (should-have for MVP), **P3** (nice-to-have).
- "System" refers to the backend unless otherwise stated.

---

## 2. Overall Description

### 2.1 Problem Context

Many parents are aware that excessive personal smartphone use negatively impacts family time and their children's development, yet struggle to change their behavior. Negative reinforcement (screen-time blockers, guilt-inducing statistics) has proven ineffective. Existing strategies that work include doing structured activities together.

The application addresses this by redirecting parental attention toward their children through a gamified, activity-based system grounded in positive reinforcement — without explicitly framing the app as a "screen addiction" tool.

### 2.2 Solution Summary

Parents join or create a **group** (e.g., their child's class). The group runs **challenges**: a set of activities to complete together over a period. As activities are completed and documented with a photo, a shared **collage** fills up. The collage is the tangible artifact — a memory album that doubles as a progress indicator.

A **rewards system** provides points redeemable for coupons or partner-provided benefits. A **resources section** provides accessible information on digital health and parenting.

Light **social features** allow group members to see each other's progress and react (this feature is under development and might be dropped, as we want to avoid increasing stress, envy, and fear-of-missing-out associated with social media use).

### 2.3 Key Design Principles

- **Positive reinforcement only.** The app never shows comparisons framed as deficits.
- **Socioeconomic accessibility.** Suggested activities must be achievable with no or minimal cost. The system must not inadvertently surface socioeconomic inequality between group members.
- **No competitive comparison.** There is no leaderboard, ranking, or mechanism that positions one family above another. Social features show shared progress, not relative performance.
- **Minimal overhead.** The app should reduce the cognitive load of planning activities, not add to it.
- **GDPR compliance by design.** All data collection is explicit, minimal, and compliant with EU regulation.

---

## 3. Stakeholders

| Stakeholder | Role | Primary Concern |
|-------------|------|-----------------|
| Parent (end user) | Primary user | Ease of use, engaging experience, low cognitive overhead |
| Child | Indirect beneficiary | Age-appropriate activities, fun |
| Foundation | Client / product owner | Mission alignment, data ethics, reach |
| Teacher / KITA staff | Potential group admin | Easy group management, low setup friction |
| Partner organizations | Reward providers | Brand exposure, new clients |
| Development team | Builders | Clear requirements, testable specs |

---

## 4. Assumptions and Constraints

### 4.1 Assumptions

- Users have a smartphone with a camera and an internet connection.
- The initial target group is parents of children aged approximately 5–10 years.
- The prototype is deployed for a limited cohort (early adopters via foundation contacts and TUM network).
- German is the primary language for the prototype; internationalization is deferred.
- Partners and reward content are out of scope for the prototype and treated as placeholder data.

### 4.2 Constraints

- **GDPR compliance** is mandatory from day one, not a later addition. This affects data model design, consent flows, and data retention policies.
- **Deployment** is a simple Docker Compose stack on a single EU-based server. No container orchestration in the prototype.
- **Activities must be free or very low cost.** Paid workshop suggestions may appear only when clearly labeled as optional and not as primary recommendations.
- **Social features must not enable cross-family comparison** in a way that highlights resource disparities.
- **No third-party analytics or advertising SDKs** in the client app.

---

## 5. Functional Requirements

### 5.1 User Account Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | The system shall support user registration via email and password. | P3 |
| FR-002 | The system shall support login via Google OAuth 2.0 (OIDC). | P1 |
| FR-003 | The system shall issue JWT access tokens and refresh tokens upon successful authentication. | P1 |
| FR-004 | The system shall support token refresh without re-authentication. | P1 |
| FR-005 | The system shall allow users to delete their account and all associated personal data. | P1 |
| FR-006 | The system shall allow users to update their display name and profile photo. | P2 |
| FR-007 | The system shall support invitation-based registration (invite link / code) for group onboarding. | P2 |

### 5.2 Child Profile Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-010 | A parent shall be able to create one or more child profiles under their account. | P1 |
| FR-011 | A child profile shall store: name (or nickname), date of birth (used to derive age group), and optional interests. | P1 |
| FR-012 | A child profile shall not have login credentials or any direct system access. | P1 |
| FR-013 | A parent shall be able to edit or delete any child profile they own. | P1 |
| FR-014 | Child profiles shall never be visible to other users outside the parent's groups. | P1 |

### 5.3 Activity Pool

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-020 | The system shall maintain a curated pool of activities. | P1 |
| FR-021 | Each activity shall have: title, description, estimated duration, age range, cost indicator (free / low-cost / paid), season relevance, and weather suitability. | P1 |
| FR-022 | Activities shall be filterable by age group, season, weather, and cost. | P1 |
| FR-023 | The system shall suggest activities to a parent based on their child's age group, current season, and weather (via a weather API or user-set location preference). | P2 |
| FR-024 | The system shall support AI-assisted activity suggestions based on child interests and past completed activities. | P3 |
| FR-025 | The system shall allow partner-provided activities to be added to the pool, clearly labeled as partner content. | P3 |
| FR-026 | Paid activities shall never be surfaced as primary suggestions; they may appear only in a clearly separated, opt-in section. | P1 |

### 5.4 Challenges

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-030 | The system shall support the creation of a challenge containing a set of activities drawn from the activity pool. | P1 |
| FR-031 | A challenge shall have: title, optional description, start date, end date, and an optionally associated group (`group_id` nullable for personal/family challenges). | P1 |
| FR-032 | A challenge shall support two display modes: **collage mode** (photo grid artifact) and **board game mode** (positional board with sequential activities). | P2 |
| FR-033 | For the prototype, the system shall implement collage mode. Board game mode may be deferred. | P1 |
| FR-034 | The creating family may delete a challenge they own. Deletion cascades to all associated activity slots. | P1 |
| FR-035 | The system shall support a challenge template system so that a managing entity can distribute the same challenge to multiple groups. | P2 |
| FR-036 | A challenge shall display overall group completion progress per slot as an aggregate count of families completed (e.g., "3 / 5 families") without ranking individual families. | P1 |
| FR-037 | A parent may have multiple simultaneously active challenges; all shall be visible on the home screen as independent collage cards. | P1 |
| FR-038 | The home screen activity suggestion shall be drawn from unfulfilled slots of the user's active challenges; it shall fall back to the general suggestion engine only when all active slots are complete or no active challenges exist. | P1 |

### 5.5 Activity Completion and Photo Documentation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-040 | A parent shall be able to mark an activity as completed by uploading a photo. | P1 |
| FR-041 | The system shall store the photo, associate it with the activity and challenge, and record the timestamp. | P1 |
| FR-042 | Photo upload shall support JPEG and PNG formats, with server-side compression and resizing (max 1200 px, JPEG 85%) to limit storage. Compression shall be asynchronous; the API shall return 202 immediately and update the completion status to `ready` when done. | P1 |
| FR-043 | A parent shall be able to add an optional short caption to a completed activity photo. | P2 |
| FR-044 | The system shall allow a parent to mark an activity as completed **without** uploading a photo (self-reported completion). | P2 |
| FR-045 | A completed activity shall be permanently tied to the parent's account history, even after a challenge ends. | P1 |
| FR-046 | A parent shall be able to delete a completion (and its associated photo) that their family submitted. Deletion shall remove both the database record and the stored photo. | P1 |
| FR-047 | Uploaded photos shall be viewable full-size within the app by tapping a filled collage slot. The viewer shall provide a download option and a delete option. | P1 |

### 5.6 Collage Mechanic

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-050 | The system shall generate a collage view for each challenge, displaying completed activity photos in a grid layout derived from the order in which activities were selected at challenge creation. | P1 |
| FR-051 | Empty collage slots (incomplete activities) shall be visually distinct but not highlighted negatively. | P1 |
| FR-052 | A completed collage shall be exportable as a static image (PNG) for the parent to save or share externally. | P2 |
| FR-053 | The collage shall be viewable by all members of the associated group. | P1 |
| FR-054 | Photos in the collage shall be served via pre-signed URLs with a 15-minute TTL. Pre-signed URLs shall be embedded in challenge and completion API responses to avoid additional round-trips. | P1 |

### 5.7 Groups

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-060 | The system shall support the creation of groups, each with a name and an admin. | P1 |
| FR-061 | A parent shall be able to join a group via an invite link or code. | P1 |
| FR-062 | A group admin shall be able to remove members and transfer admin rights. | P1 |
| FR-063 | Groups shall have a configurable visibility: **private** (invite-only) or **institution-managed**. | P2 |
| FR-064 | A parent may belong to multiple groups. | P1 |
| FR-065 | A group's member list shall only be visible to members of that group. | P1 |

### 5.8 Social Features

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-070 | Group members shall be able to see when another member completes an activity, displayed as a feed event within the group. | P3 |
| FR-071 | Activity completions shared to the group feed shall include the photo (if uploaded) and caption (if added). | P3 |
| FR-072 | Sharing to the group feed shall be **opt-in per activity** — the default shall be private. | P2 |
| FR-073 | Members shall be able to react to shared completions (e.g., a limited set of positive emoji reactions). | P3 |
| FR-074 | There shall be no mechanism for negative reactions, critical comments, or any content that could produce comparison-based distress. | P1 |
| FR-075 | The system shall not display any metric that ranks families by number of activities completed or any other quantitative measure. | P3 |

### 5.9 Rewards System

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-080 | The system shall award points to a parent upon completing an activity. | P2 |
| FR-081 | The system shall maintain a points balance per parent account. | P2 |
| FR-082 | Points shall be redeemable for rewards (coupons, partner offers). | P3 |
| FR-083 | The rewards catalogue shall clearly indicate whether a reward requires spending money. | P2 |
| FR-084 | Completing a full challenge collage shall award a completion badge visible on the parent's profile. | P2 |
| FR-085 | For the prototype, the rewards system shall be implemented as a placeholder (points accumulate, no real redemption). | P1 |

### 5.10 Digital Health Resources

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-090 | The system shall provide a curated library of articles and resources on digital health, screen time, and family bonding. | P2 |
| FR-091 | Resources shall be organized by topic and indexed for search. | P2 |
| FR-092 | Resources shall be linkable to activities where contextually relevant (e.g., an article on outdoor play linked to a nature activity). | P3 |
| FR-093 | The resources section shall be framed positively (e.g., "Learn more about quality time") and shall not frame the parent's behavior as a problem. | P1 |
| FR-094 | The system shall support a "resource challenge" format: completing a reading activity (reading a short article) counts as an activity completion. | P3 |

### 5.11 Notifications

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-100 | The system shall support push notifications (via a notification service) for: activity suggestions, challenge start/end reminders, and group feed events. | P2 |
| FR-101 | All notification types shall be individually opt-outable by the user. | P1 |
| FR-102 | The system shall not send notifications during configurable quiet hours. | P3 |

### 5.12 Administration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-110 | The system shall provide an admin interface (or API endpoints restricted by role) for managing the activity pool, challenges, and users. | P2 |
| FR-111 | The system shall support an institution role (e.g., KITA) that can create and manage challenges for their associated groups. | P2 |
| FR-112 | The system shall log all admin actions with actor ID and timestamp. | P3 |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-001 | API endpoints shall respond within 300 ms for 95% of requests under normal load (up to 500 concurrent users). | P1 |
| NFR-002 | Photo upload endpoints shall handle files up to 10 MB and respond within 3 seconds on a standard mobile connection. | P1 |
| NFR-003 | The system shall process image compression asynchronously so that the upload response is returned before compression completes. | P3 |

### 6.2 Security

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-010 | All API communication shall use HTTPS (TLS 1.2 or higher). | P1 |
| NFR-011 | Passwords shall be hashed using bcrypt with a minimum cost factor of 12. | P1 |
| NFR-012 | JWT tokens shall be short-lived (access: 15 min, refresh: 7 days) and refresh tokens shall be rotated on use. | P1 |
| NFR-013 | The system shall validate and sanitize all user-supplied inputs to prevent injection attacks. | P1 |
| NFR-014 | Photo uploads shall be scanned for malicious content before storage (at minimum: MIME type validation and file size limits). | P1 |
| NFR-015 | User-uploaded photos shall be stored in a private storage bucket; URLs shall be pre-signed with expiry. | P1 |
| NFR-016 | The system shall enforce rate limiting on authentication endpoints (max 10 attempts per IP per minute). | P1 |
| NFR-017 | The admin API shall be restricted by role and require a separate elevated permission scope. | P1 |

### 6.3 Privacy and GDPR

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-020 | The system shall present an explicit, granular consent screen at onboarding covering: data storage, photo processing, and (if applicable) location use. | P1 |
| NFR-021 | Consent shall be stored with a timestamp and version reference; re-consent shall be requested if the privacy policy changes. | P1 |
| NFR-022 | The system shall implement a right-to-erasure endpoint: upon account deletion, all personal data (including photos) shall be deleted within 30 days. | P1 |
| NFR-023 | The system shall implement data export: a parent shall be able to download all their personal data and photos in a machine-readable format. | P2 |
| NFR-024 | Photos of children shall never be shared outside the parent's explicitly chosen group. | P1 |
| NFR-025 | The server shall be hosted in an EU data center. No personal data shall be transferred outside the EU without explicit consent. | P1 |
| NFR-026 | A Data Processing Agreement (DPA) shall be established with all third-party services that handle personal data (storage, auth providers, notification services). | P1 |
| NFR-027 | The system shall not collect or store precise GPS location. Weather-based suggestions may use a coarse location (city level) set explicitly by the user. | P1 |

### 6.4 Reliability and Availability

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-030 | The system shall target 99% uptime for the prototype phase (planned maintenance excluded). | P1 |
| NFR-031 | The system shall perform automated daily database backups with a minimum 7-day retention. | P2 |
| NFR-032 | The system shall have a documented recovery procedure for server failure. | P3 |

### 6.5 Accessibility

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-040 | The client application shall meet WCAG 2.1 Level AA guidelines. | P3 |
| NFR-041 | All images in the app UI shall have descriptive alt text. | P2 |
| NFR-042 | The application shall be usable without requiring precise motor input (e.g., tap targets ≥ 44×44 px). | P1 |

### 6.6 Maintainability

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-050 | The backend shall include unit tests for all business logic with a minimum 80% line coverage. | P1 |
| NFR-051 | The backend shall include integration tests for all API endpoints. | P2 |
| NFR-052 | The codebase shall follow a defined style guide (PEP 8 for Python, enforced via linter in CI). | P1 |
| NFR-053 | All API endpoints shall be documented via OpenAPI (auto-generated by FastAPI) and kept current. | P1 |
| NFR-054 | The CI/CD pipeline shall run lint, tests, and image build on every pull request; deployment shall be gated on all checks passing. | P1 |

### 6.7 Scalability

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-060 | For the prototype phase, the system shall run on a single-server Docker Compose stack without orchestration. | P1 |
| NFR-061 | The architecture shall not introduce hard coupling that prevents horizontal scaling in a future phase (e.g., no in-memory session state). | P1 |

---

## 7. User Stories

The following stories capture key interactions from the primary user's perspective. They supplement the formal requirements above.

### Onboarding

- As a parent, I want to register quickly (email or Google) so I can start using the app with minimal friction.
- As a parent, I want to create a profile for my child without creating a separate account for them, so I can manage everything from one place.
- As a parent, I want to join my child's KITA group via an invite link so I don't have to manually find or configure a group.

### Doing Activities

- As a parent, I want the app to suggest activities suited to my child's age and today's weather so I don't have to think of something myself.
- As a parent, I want to complete an activity with my child, take a photo inside the app, and have it fill a slot in our shared collage automatically.
- As a parent, I want to see the collage fill up as we complete activities so I feel a sense of progress and accomplishment.

### Social

- As a parent, I want to optionally share a completed activity photo with my group so others can see what we did, but only if I choose to.
- As a parent, I want to see what activities other families in my group have completed so I can get inspired — without feeling like I'm falling behind.

### Resources

- As a parent, I want to read short, positive articles about family bonding inside the app so I can learn without feeling judged.

### Privacy and Control

- As a parent, I want to delete my account and all my data at any time so I know I remain in control of my and my child's information.
- As a parent, I want to export all my photos and activity history so I can keep them as a personal record even if I leave the app.

---

## 8. Out of Scope

The following items are explicitly out of scope for the prototype and early MVP:

- Real reward redemption (partner coupon integration). The rewards system will be a placeholder.
- Board game mechanic. Collage mode is the prototype target.
- AI-driven activity personalization. Rule-based filtering is sufficient for the prototype.
- Multi-language support. German only for the prototype.
- Web admin dashboard. Admin operations will use direct API calls or a minimal internal tool.
- Push notifications. Deferred to MVP.
- Partner-provided activities. The initial activity pool is curated manually.
- Paid activity suggestions.

---

## 9. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Are parents willing to pay for the app, and if so, what is the acceptable price point? | Foundation | Open |
| 2 | What is the target challenge duration — one week, one month, one school term? | Foundation + Dev | Open |
| 3 | Client framework decision: mobile-first webapp vs. native iOS app. | Dev team | Pending next sync |
| 4 | Should board game mode and collage mode coexist in the same app as selectable modes, or should one be chosen? | Foundation + Dev | Open |
| 5 | Which weather API shall be used, and under what usage tier? | Dev team | Open |
| 6 | What is the definition of "successful prototype" from the foundation's perspective — PoC, user-testable build, or functional MVP? | Foundation | Open |
| 7 | Does the foundation have existing partner relationships for rewards/coupons that can be referenced in the prototype even as placeholders? | Foundation | Open |
| 8 | Should teachers / KITA staff have a distinct account type with elevated permissions, or is a "group admin" role sufficient? | Foundation | Open |
