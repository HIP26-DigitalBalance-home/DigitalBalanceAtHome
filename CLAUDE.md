# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a monorepo containing all three components of the DigitalBalance @home project:

```
DigitalBalanceAtHome/
├── client/          React Native (Expo) mobile app
├── server/          FastAPI + PostgreSQL backend  ← created in Milestone 0
├── docs/
│   ├── planning/    UX brief, data model, compliance brief
│   ├── implementation-plan.md
│   ├── requirements.md
│   └── architecture.md
└── CLAUDE.md
```

## Project

**DigitalBalance @home** — a family activity challenge app that encourages parents to spend intentional offline time with their children. Parents join groups, participate in activity challenges, and document completions with photos that fill a shared collage. Built for [Stiftung Kindergesundheit](https://www.kindergesundheit.de/) as part of the TUM Healthcare Innovation Program (Challenge #6, SoSe 2026).

## Stack

| Component | Technology |
|---|---|
| Client | React Native, Expo 54, TypeScript, Expo Router |
| Server | Python 3.12, FastAPI, SQLAlchemy 2.x async, asyncpg |
| Database | PostgreSQL 16, Alembic migrations |
| Auth | Google OAuth 2.0 / OIDC |
| Photo storage | Hetzner Object Storage (S3-compatible, EU-hosted) |
| Deployment | Docker Compose, single EU server, Caddy (TLS) |
| Server linter | ruff |

## Client (`client/`)

### Commands
```bash
cd client
npm install          # Install dependencies
npx expo start       # Start dev server (press i for iOS, a for Android)
npx expo run:ios     # Development build for iOS (required for camera features from M7)
npm test             # Run tests
```

### Architecture
- **Expo Router** file-based routing; tabs in `app/(tabs)/`
- **`StandardProvider`** wraps the app; access via `useStandard()` — never import backends directly
- **`lib/api/client.ts`** — axios instance with auth header injection and 401 refresh logic
- **`constants/theme.ts`** — colour tokens, spacing, typography; all UI uses these, no hardcoded values
- Every async effect needs `let cancelled = false` to prevent state updates after unmount
- Use `<Redirect href="..." />` for auth guards, never `router.replace()`

## Server (`server/`)

### Commands
```bash
cd server
docker compose up            # Start API + PostgreSQL
docker compose up --build    # Rebuild after dependency changes
alembic upgrade head         # Apply migrations
alembic revision --autogenerate -m "description"  # New migration
ruff check .                 # Lint
ruff format .                # Format
pytest                       # Run tests
pytest tests/path/to/test.py::test_name  # Single test
```

### Spec-driven workflow

`docs/openapi.yaml` is the **authoritative API contract**. This is a hard rule:

- **Never add, remove, or change an API endpoint, request field, or response field without first updating `docs/openapi.yaml`.**
- `server/app/schemas/generated.py` is generated from the spec — **never edit it by hand**.
- The spec and the implementation must stay in sync at all times. If they diverge, the spec wins.

**Mandatory sequence for any backend change** (new endpoint, modified response, deleted route, new field):
1. Edit `docs/openapi.yaml` — add/modify/remove paths, parameters, and schemas
2. Run codegen (from repo root) to regenerate `server/app/schemas/generated.py`
3. Implement or update the route handler importing types from `generated.py`
4. Run `pytest` to confirm nothing broke

**Codegen command** (run from repo root):
```bash
datamodel-codegen \
  --input docs/openapi.yaml \
  --input-file-type openapi \
  --output server/app/schemas/generated.py \
  --output-model-type pydantic_v2.BaseModel \
  --use-annotated \
  --field-constraints \
  --target-python-version 3.12
```

**Contract testing** (run from `server/` with Docker Compose running):
```bash
pip install -r requirements-dev.txt
schemathesis run ../docs/openapi.yaml --base-url http://localhost:8000
```

### Architecture
Four strict layers — dependencies flow downward only:

```
routes (app/api/) → services (app/services/) → repositories (app/repositories/) → database
```

- **Routes**: HTTP concerns only — validate input (Pydantic), call one service method, return response
- **Services**: all business logic; raise domain exceptions (e.g., `GroupNotFound`), never `HTTPException`
- **Repositories**: data access only, no business rules; one class per aggregate root
- **Models** (`app/models/`) and **schemas** (`app/schemas/`) are strictly separate — ORM models never leave the service layer

Key invariants:
- All PKs: UUID (`gen_random_uuid()`), never sequential integers
- All timestamps: `TIMESTAMPTZ`, stored in UTC
- No soft deletes — hard deletes only (GDPR compliance)
- JWT access tokens: 15 min; refresh tokens: 7 days, rotated on use
- Photos never served directly through the API — clients receive pre-signed S3 URLs (15-min TTL). URLs are embedded inline in challenge and completion responses when `status="ready"`; `GET /photos/{completion_id}/url` also exists for explicit re-fetching
- Paid activities filtered at the service layer, not by a DB constraint

## Key Domain Concepts

- **User (Parent)**: the only authenticated account type. Holds admin roles at two independent levels: family admin and group admin.
- **Family**: the primary unit of participation (≥1 parents). Children, group memberships, and challenge completions all belong to a Family. A second parent joins via a FamilyInvite link.
- **ChildProfile**: belongs to a Family, not to an individual parent. Any admin parent in the family can manage child profiles.
- **Activity**: a curated offline task with age range, cost indicator, season/weather metadata.
- **Group**: invite-only set of **families** (not individual parents). When a parent joins a group, their whole family joins. Group admins are individual parents (tracked separately from family membership).
- **Challenge**: a set of activities with a start/end date. `group_id` is nullable — null means a personal/family challenge accessible to all parents in the creating parent's family.
- **Collage**: a family's collage is derived at query time from their Completions for a Challenge. Each family fills one shared collage — either parent can complete slots.
- **Completion**: one per `(family_id, challenge_activity_id)`; `completed_by_user_id` tracks which parent did it. Group aggregate view shows "X of Y **families** completed."

## Project Wiki Schema

The project wiki lives at `wiki/` and follows a three-layer architecture:

```
wiki/
  raw/                    # Immutable source documents — never modify
    interviews/           # Parent and stakeholder interviews
    papers/               # Research papers and clinical literature
    observations/         # Field notes and usability observations
    competitors/          # Competitor analysis and screenshots
    regulatory/           # Legal and compliance documents
    media/                # Press, social media, other media
  pages/                  # AI-maintained wiki pages — only write here
    index.md              # Catalog of all pages (updated on every ingest)
    log.md                # Append-only chronological activity log
    overview.md           # Project summary, mission, current stage
    stakeholders/         # One page per stakeholder group
    evidence/             # Clinical, behavioral, and design evidence
    landscape/            # Competitive and market analysis
    design/               # User journeys, data model, architecture, roadmap
    regulatory/           # Compliance landscape and open decisions
    questions/            # Living list of open questions
```

### Domain and Key Terminology

- **Parent**: only authenticated user type; German-speaking adult with ≥1 child
- **Family**: primary unit of participation; children and completions belong to Family, not User
- **ChildProfile**: non-account child representation; belongs to Family; never in group-visible responses
- **Group**: invite-only set of families; group admins are individual parents
- **Challenge**: set of activities with start/end date; `group_id` nullable (null = personal/family)
- **Collage**: derived at query time from Completions for (family_id, challenge_id); not stored
- **Completion**: one per (family_id, challenge_activity_id); states: processing, ready, self_reported
- **ConsentRecord**: append-only GDPR consent log; 3 types: data_storage, photo_processing, location

### Page Naming Conventions

- Filenames: lowercase kebab-case (e.g., `kita-staff.md`, `open-questions.md`)
- Stakeholder pages: one per distinct stakeholder group
- Evidence pages: one per topic area (problem framing, design principle, clinical finding)
- Design pages: one per design concern (user journeys, data model, architecture, roadmap)
- Cross-references use standard Markdown links: `[label](relative/path.md)`

### Ingest Workflow

When the user adds a source (interview, paper, observation, competitor, regulatory doc):
1. Save to the correct `wiki/raw/` subfolder with a dated descriptive filename (`YYYY-MM-DD-description.md`)
2. Read the source completely
3. Discuss key takeaways with the user
4. Write or update a summary page in `wiki/pages/`
5. Update every relevant page across the wiki (a single source may touch 5–15 pages)
6. Flag contradictions with existing wiki content explicitly
7. Update `wiki/pages/index.md`
8. Append an entry to `wiki/pages/log.md`

### Query Workflow

When answering a question about the project:
1. Read `wiki/pages/index.md` to find relevant pages
2. Read those pages and synthesise an answer with citations
3. Offer to file useful synthesis as a new wiki page

### Stage and Priorities

Current stage: **active development prototype** (M9 of 13 complete). Wiki depth priorities:
- **High priority:** compliance open decisions (D2–D5, D7), M10–M12 implementation context, UX risk validation
- **Medium priority:** stakeholder evidence from user testing once it begins
- **Low priority:** landscape analysis (no competitor research conducted yet)

---

## Design Constraints

- **No competitive comparison** — no leaderboards, no per-family rankings; group progress is aggregate only
- **Positive reinforcement only** — no negative framing, no "you're behind" language
- **Paid activities** are never surfaced as primary suggestions
- **Social sharing is opt-in per completion** — default is private
- **GDPR by design** — right to erasure within 30 days; data export; consent stored with timestamp + policy version; no precise GPS; no third-party analytics SDKs in the client
- **Socioeconomic accessibility** — activities must be free or low-cost

## Implementation Plan

`docs/implementation-plan.md` — 13 milestones (M0–M12). Each milestone ships both backend routes and frontend screens together. Start with **Milestone 0: Server Skeleton**.

## Planning Documents

| Document | What it covers |
|---|---|
| `docs/implementation-plan.md` | Milestone-by-milestone build plan |
| `docs/planning/ux-brief.md` | User journeys, onboarding, engagement strategy |
| `docs/planning/data-model-brief.md` | All 10 entities, relationships, lifecycle states |
| `docs/planning/compliance-brief.md` | GDPR obligations, required decisions, controls |
| `docs/requirements.md` | Full SRS with FR-XXX / NFR-XXX requirements |
| `docs/architecture.md` | C4 diagrams, key flows, technology decisions |
