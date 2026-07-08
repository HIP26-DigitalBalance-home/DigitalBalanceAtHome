# Implementation Plan: Activity Resources

**Branch**: `005-activity-resources` | **Date**: 2026-07-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-activity-resources/spec.md`

## Summary

Let whoever creates an activity attach helpful **resources** — external web links and internal notes (text + photos) — so a parent doing the activity has the prep information (recipe, location, instructions) inline instead of searching for it. Resources are a new relational aggregate hanging off the existing `activities` table: an `activity_resources` table (external vs. internal, ordered) plus an `activity_resource_photos` table that reuses the exact completion photo pipeline (multipart upload → background compress → S3 key → `processing`/`ready` status → pre-signed 15-min GET URLs). A new `GET /activities/{id}` detail endpoint embeds resources with pre-signed photo URLs; nested CRUD under `/activities/{id}/resources` handles authoring, restricted to the owning family. On the client, `create-activity.tsx` gains a resources editor and `activity/[id].tsx` renders resources for the doer, with external links clearly marked as leaving the app.

## Technical Context

**Language/Version**: Python 3.12 (server), TypeScript / React Native + Expo 54 (client)

**Primary Dependencies**: FastAPI, SQLAlchemy 2.x async, asyncpg, Alembic, boto3 (S3), Pillow (existing image compression); Expo Router, axios

**Storage**: PostgreSQL 16 (two new tables); Hetzner Object Storage (S3-compatible, EU) for resource photos — reuses `app/core/storage.py`

**Testing**: pytest (server, JIRA/S3/LLM mocked per repo convention); schemathesis contract tests against `docs/openapi.yaml`; Jest (client)

**Target Platform**: iOS/Android via Expo; Linux server behind Caddy

**Project Type**: Mobile app + web service (monorepo: `client/` + `server/`)

**Performance Goals**: Activity detail (with resources + pre-signed URLs) responds in <300 ms p95; photo upload accepted in <500 ms with processing off the request path (background task), matching completion upload behavior

**Constraints**: No third-party fetch/unfurl of external links (privacy); photos never served directly/persistently through the API (pre-signed URLs only); hard deletes only; GDPR erasure within 30 days; all PKs UUID; all timestamps TIMESTAMPTZ (UTC)

**Scale/Scope**: Small per-activity volumes — cap ~10 resources/activity, ~5 photos/internal resource; two DB tables, one Alembic migration, ~6 endpoints, two client screens touched

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository constitution file is an unpopulated template, so the binding governance is the project's `CLAUDE.md` engineering rules. Evaluated against them:

| Gate (from CLAUDE.md) | Status | Notes |
|---|---|---|
| Spec-driven: `docs/openapi.yaml` updated first, then codegen, then handlers | ✅ Plan | New paths/schemas defined in [contracts/openapi-additions.yaml](contracts/openapi-additions.yaml) to be merged into `docs/openapi.yaml` before any handler; `generated.py` regenerated, never hand-edited |
| Four-layer architecture (routes → services → repositories → db) | ✅ Plan | New `resource` service + `activity_resource` repository; routes stay thin; ORM models never leave the service layer |
| UUID PKs, TIMESTAMPTZ, hard deletes, no soft delete | ✅ Plan | Both new tables use `gen_random_uuid()` PKs, `TimestampMixin`, ON DELETE CASCADE |
| Photos via pre-signed URLs, never served directly | ✅ Plan | Reuses `storage.generate_presigned_url(..., expires=900)`; identical to completions |
| GDPR erasure / no orphaned objects | ✅ Plan | FK CASCADE activity→resource→photo; S3 objects deleted on resource/photo/activity delete and swept on family erasure |
| No third-party analytics / no external tracking | ✅ Plan | URLs stored verbatim, never fetched/previewed by the server (FR-017) |
| Positive-reinforcement / no competition design constraints | ✅ N/A | Resources are informational only; no scoring, ranking, or progress impact |

No violations. Complexity Tracking table left empty.

## Project Structure

### Documentation (this feature)

```text
specs/005-activity-resources/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── openapi-additions.yaml   # Paths + schemas to merge into docs/openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
server/
├── docs/openapi.yaml                      # (root docs/) authoritative contract — edit FIRST
├── app/
│   ├── models/
│   │   ├── activity.py                     # + relationship to ActivityResource
│   │   ├── activity_resource.py            # NEW — ActivityResource ORM model
│   │   └── activity_resource_photo.py      # NEW — ActivityResourcePhoto ORM model
│   ├── repositories/
│   │   └── activity_resource.py            # NEW — CRUD for resources + photos
│   ├── services/
│   │   ├── activity_resource.py            # NEW — business logic, ownership/visibility, S3 lifecycle
│   │   └── activity.py                     # + get_activity_detail() embedding resources
│   ├── api/
│   │   └── activities.py                   # + GET /{id}; nested /{id}/resources routes
│   └── schemas/generated.py                # regenerated from openapi.yaml (never hand-edited)
├── alembic/versions/
│   └── <rev>_add_activity_resources.py     # NEW migration (two tables)
└── tests/
    └── ...                                 # resource CRUD, ownership, visibility, photo lifecycle, erasure

client/
├── lib/api/activities.ts                   # + resource types + resource API calls
├── app/create-activity.tsx                 # + resources editor (add/remove links & notes+photos)
├── app/activity/[id].tsx                   # + render resources for the doer
└── components/                             # NEW small components: resource list item, add-resource sheet
```

**Structure Decision**: Web-application layout — the existing `server/` (FastAPI four-layer) plus `client/` (Expo Router). No new top-level projects; the feature extends the `activities` aggregate with two new tables, one new service + repository pair, additive OpenAPI paths, and edits to two existing client screens plus a couple of small new components.

## Complexity Tracking

> No constitution violations — table intentionally empty.
