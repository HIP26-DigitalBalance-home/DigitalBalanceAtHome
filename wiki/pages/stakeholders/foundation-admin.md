---
name: stakeholders-foundation-admin
description: Stiftung Kindergesundheit — curates the activity pool; no admin UI in prototype
type: stakeholder
last_updated: 2026-06-11
---

# Stakeholder: Foundation Admin (Stiftung Kindergesundheit)

## Who They Are

Staff at **Stiftung Kindergesundheit** (the commissioning organisation), responsible for maintaining the curated activity pool and challenge templates. They are also the project client for the TUM Healthcare Innovation Program engagement.

## Role in the System

- Manages the Activity pool (add, edit, retire activities)
- Sets age ranges, cost indicators, season/weather metadata
- May create or template group challenges
- Not a standard user account — interacts via direct API calls in the prototype

**No admin UI is planned for the prototype.** Admin actions go directly through the API.

## Data They Control

The Activity table is effectively foundation-owned. Key rules they must respect:
- `cost_indicator` must be `free` or `low_cost` — paid activities are never surfaced to parents by the suggestion engine
- `is_partner_content` flag distinguishes foundation-curated vs. partner-contributed content

## What They Care About

- Scientific grounding of suggested activities (aligned with paediatric health evidence)
- Avoiding any activity that could cause socioeconomic exclusion
- GDPR compliance before any real user data is collected
- Outcome data for reporting to TUM and program sponsors

## Open Questions

- What is the process for the foundation to add new activities once the prototype is live? (Direct API calls are acceptable for prototype but need a lightweight admin UI for MVP)
- Will the foundation want aggregate anonymised outcome metrics (completions per activity type, group sizes) for impact reporting?

See → [overview.md](../overview.md), [design/data-model.md](../design/data-model.md) (Activity)
