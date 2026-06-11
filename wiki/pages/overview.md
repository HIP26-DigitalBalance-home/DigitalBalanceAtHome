---
name: overview
description: Project summary — mission, context, current build stage, and key facts for DigitalBalance @home
type: project
last_updated: 2026-06-11
---

# DigitalBalance @home — Project Overview

## Mission

Help parents spend intentional offline time with their children by making offline activities visible, shareable, and worth coming back to — without shame, competition, or screen-time guilt.

The app is a **family activity challenge platform** built for **Stiftung Kindergesundheit** as part of the TUM Healthcare Innovation Program (Challenge #6, SoSe 2026).

## Problem Context

Many parents are aware that their smartphone use encroaches on family time, yet behaviour-change tools framed around screen addiction (blockers, guilt-inducing counters) fail. The evidence suggests a positive, activity-based approach works better: give families something fun and concrete to do together rather than telling them to stop doing something.

See → [evidence/problem-context.md](../evidence/problem-context.md)

## Solution

Parents join invite-only **groups** (e.g., a KITA class). Groups run **challenges**: a curated set of offline activities to complete over a defined period. Each completed activity fills a slot in a **photo collage** — the collage is both a progress indicator and a memory artifact. When the challenge ends, families celebrate with confetti and export the collage as a PNG.

Light social features allow parents to see group-level aggregate progress (not per-family rankings) and optionally share a photo to a group feed.

## Key Stakeholders

| Role | Summary |
|---|---|
| [Parent](stakeholders/parents.md) | Primary user — German-speaking adult, cognitively loaded, ≥1 child |
| [Child](stakeholders/children.md) | Indirect beneficiary — no account, represented via child profile |
| [KITA Staff / Teacher](stakeholders/kita-staff.md) | Group admin — creates group, distributes invite link, manages challenge |
| [Foundation Admin](stakeholders/foundation-admin.md) | Stiftung Kindergesundheit — curates the activity pool via API |

## Current Build Stage

As of 2026-06-11, **Milestones 0–9 are complete**. Open milestones:

| Milestone | What it delivers |
|---|---|
| M10 | Profile screen, `GET/PATCH /users/me`, completion history |
| M11 | GDPR self-service: data export, account deletion, consent management |
| M12 | Polish, empty states, accessibility audit, WCAG contrast |

Server deployment (EU VM + Caddy TLS) is not in the milestone plan but is required before any real-user testing.

See → [design/implementation-roadmap.md](../design/implementation-roadmap.md)

## Technology Stack

| Component | Technology |
|---|---|
| Client | React Native (Expo 54), TypeScript, Expo Router, web target |
| Server | Python 3.12, FastAPI, SQLAlchemy 2.x async, asyncpg |
| Database | PostgreSQL 16, Alembic migrations |
| Auth | Google OAuth 2.0 / OIDC |
| Photo storage | Hetzner Object Storage (S3-compatible, EU-hosted) |
| Deployment | Docker Compose, single EU server, Caddy (TLS) |

## Design Principles

1. **Positive reinforcement only** — no shame language, no leaderboards
2. **No competitive comparison** — group view shows aggregate counts only
3. **Socioeconomic accessibility** — activities must be free or low-cost
4. **GDPR by design** — consent, erasure, portability built in from day one
5. **Minimal overhead** — reduce planning effort, not add to it

See → [evidence/design-principles.md](../evidence/design-principles.md)

## Compliance Summary

GDPR is the primary obligation. Five open pre-launch decisions remain (D2–D5, D7).

See → [regulatory/compliance-landscape.md](../regulatory/compliance-landscape.md), [regulatory/open-decisions.md](../regulatory/open-decisions.md)
