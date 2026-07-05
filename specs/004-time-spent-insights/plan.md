# Implementation Plan: Time Spent Insights and Journal Phase-Out

**Branch**: Current working tree (`main`; no feature branch created) | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-time-spent-insights/spec.md`

## Summary

Add a private, parent-level time insight to the top of Progress. A new current-user time-spent service will aggregate activity completion durations with one replaceable manual value per local calendar day. It will expose weekly daily totals and monthly calendar-week totals/average through an OpenAPI-first contract. Activity completions gain a stored local completion date so past values remain stable across timezone changes. On the client, a reusable duration picker gains Custom support, a manual-time card replaces the journal card in the home hero, self-reported completions require duration, and a new chart renders the insight. The journal backend, data, and dormant client modules remain intact, while all journal UI and the History/Analyze selector are removed.

## Technical Context

**Language/Version**: Python 3.12; TypeScript 5.9; React 19 / React Native 0.81

**Primary Dependencies**: FastAPI, SQLAlchemy 2.x async, asyncpg, Pydantic v2 generated from OpenAPI; Expo 54, Expo Router 6, axios, react-i18next, React Native Reanimated

**Storage**: PostgreSQL 16 via Alembic; one new `manual_time_entries` table and one new local-date field on `completions`; no stored aggregate table

**Testing**: pytest + pytest-asyncio, ruff, Schemathesis contract checks; client TypeScript typecheck, Expo ESLint, and manual iOS/Android/web visual validation

**Target Platform**: FastAPI service on the existing Docker Compose deployment; Expo mobile app for iOS 15+ and Android, with current web compatibility preserved

**Project Type**: Mobile application plus web service in an existing monorepo

**Performance Goals**: Time insight response under 500 ms for a one-month range; complete Progress view visible within 2 seconds; a save reflected in current-period UI within 5 seconds; chart interactions remain responsive at 60 fps

**Constraints**: OpenAPI contract first; generated schemas never hand-edited; strict route → service → repository layering; UUID primary keys; UTC timestamps; local calendar dates stored explicitly; all async client effects cancellation-safe; theme tokens and localization only; no journal data deletion; no cross-parent or cross-family disclosure

**Scale/Scope**: One manual row per parent per day; at most 31 daily values and 4–6 weekly buckets per insight request; completion aggregation scoped by `completed_by_user_id` and a bounded date range

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

The constitution file contains only unratified placeholders, so it defines no enforceable project-specific gates. The repository instructions provide the active gates:

- **Contract-first backend changes — PASS**: `docs/openapi.yaml` will be updated before code generation, migration, route, or client work. The design contract is staged in `contracts/time-spent-api.yaml`.
- **Layer boundaries — PASS**: new HTTP handling, aggregation rules, and SQL access are separated across API, service, and repository modules.
- **Privacy and non-competition — PASS**: endpoints resolve the authenticated parent internally and expose no family selector, group aggregation, leaderboard, or other parent's data.
- **Data lifecycle — PASS**: manual entries cascade on user deletion; no soft deletes are introduced; journal rows and APIs remain unchanged.
- **Date/time invariants — PASS**: timestamps remain UTC `TIMESTAMPTZ`; user-facing day ownership is stored as `DATE` at record creation.
- **Client architecture — PASS**: network access remains behind typed API modules; async effects use cancellation guards; localized, themed components are planned.

## Project Structure

### Documentation (this feature)

```text
specs/004-time-spent-insights/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── time-spent-api.yaml
└── tasks.md                    # created later by /speckit-tasks
```

### Source Code (repository root)

```text
docs/
├── openapi.yaml                                      # MODIFY first
└── architecture.md                                   # MODIFY: journal phase-out note

server/
├── alembic/versions/c9e7a4b2d1f0_add_time_spent.py  # NEW
├── app/
│   ├── api/
│   │   ├── completions.py                            # MODIFY: self-report local date + duration
│   │   ├── photos.py                                 # MODIFY: photo completion local date
│   │   └── time_spent.py                             # NEW
│   ├── models/
│   │   ├── completion.py                             # MODIFY: completed_on + duration constraint
│   │   ├── manual_time_entry.py                      # NEW
│   │   └── __init__.py                               # MODIFY
│   ├── repositories/
│   │   ├── completion.py                             # MODIFY: persist completed_on
│   │   └── time_spent.py                             # NEW
│   ├── schemas/generated.py                          # REGENERATE only
│   ├── services/
│   │   ├── challenge.py                              # MODIFY: expose completed_on
│   │   ├── completion.py                             # MODIFY: require/persist no-photo duration
│   │   └── time_spent.py                             # NEW
│   ├── main.py                                       # MODIFY: register router
│   └── services/seed.py                              # MODIFY: seed completed_on
└── tests/
    ├── integration/test_time_spent_routes.py         # NEW
    └── unit/test_time_spent_service.py               # NEW

client/
├── app/
│   ├── (tabs)/index.tsx                              # MODIFY: replace JournalCard
│   ├── (tabs)/profile.tsx                            # MODIFY: History label
│   ├── activity-history.tsx                          # MODIFY: list only; ignore old tab param
│   ├── challenge/[id].tsx                            # MODIFY: submit no-photo duration/date
│   └── progress.tsx                                  # MODIFY: insight first
├── components/
│   ├── complete-activity-modal.tsx                   # MODIFY: no-photo duration required
│   ├── duration-picker.tsx                           # MODIFY: horizontal/custom support
│   ├── time-spent-card.tsx                           # NEW
│   └── time-spent-chart.tsx                          # NEW
├── lib/
│   ├── api/index.ts                                  # MODIFY
│   ├── api/challenges.ts                             # MODIFY: completion local-date type
│   ├── api/time-spent.ts                             # NEW
│   └── time-spent-utils.ts                           # NEW: local dates/formatting
└── lib/i18n/{de,en}.ts                               # MODIFY
```

The existing journal route, service, repository, model, migration, tests, API contract, `client/lib/api/journal.ts`, mood constants, and `JournalCard` source remain in place. They become dormant because active screens no longer import or render them.

**Structure Decision**: Add a dedicated parent-scoped time-spent vertical slice rather than embedding personal data in the family-scoped Progress response. Reuse the existing completion and activity records as source data; persist only manual input and stable local completion dates.

## Phase 0: Research Decisions

Research is consolidated in [research.md](research.md). All technical unknowns are resolved:

1. Dedicated current-parent endpoints, separate from family progress.
2. Stored `completed_on` local date, provided by the client at completion time.
3. Query-time aggregation with reported duration preferred over activity estimate.
4. One atomic upsert row per parent/date for manual time.
5. Monday-based weekly periods and month-to-date handling for the current month.
6. One controlled duration picker shared by manual and completion flows.
7. Journal presentation removed without deleting journal capability or data.

## Phase 1: Design and Contracts

### A. Contract-first API and storage

1. Merge [contracts/time-spent-api.yaml](contracts/time-spent-api.yaml) into `docs/openapi.yaml`:
   - add `GET /time-spent` and `PUT /time-spent/manual`;
   - add time-spent request/response schemas;
   - add `completed_on` and duration constraints to completion/photo schemas.
2. Regenerate `server/app/schemas/generated.py` using the repository codegen command.
3. Add an Alembic migration for `manual_time_entries`, `completions.completed_on`, indexes, constraints, and UTC-date backfill for historical completions.
4. Update direct completion seed creation to populate `completed_on`.

### B. Server vertical slice

1. Add `ManualTimeEntry` and register it with model metadata.
2. Add `TimeSpentRepository` with an atomic manual-value upsert and bounded activity/manual aggregation queries.
3. Add `time_spent` service helpers for period boundaries, zero-filled daily series, weekly grouping, and rounded monthly average.
4. Add the authenticated current-parent router and register it in `main.py`.
5. Extend both completion paths to accept and persist `completed_on`; require `duration_minutes` for self-reported completions while retaining the casual-photo points rule.
6. Add unit and route tests for privacy scoping, upsert replacement, fallback duration, zero filling, period boundaries, and request validation.

### C. Shared client duration entry and home card

1. Extend `DurationPicker` as a controlled component with presets 15/30/45/60/90/120, a localized `120+` label, Custom numeric entry, 1–1,440 validation, and an optional horizontal single-row presentation.
2. Make no-photo completion submission require duration and pass `duration_minutes` plus client-local `completed_on`; keep the current photo duration requirement and point behavior unchanged.
3. Add the typed `timeSpentApi` module and home `TimeSpentCard`.
4. Replace the rendered `JournalCard` with `TimeSpentCard`; load today's manual value from the current weekly insight and use an explicit save action so selecting a chip does not silently persist.

### D. Progress insight and journal phase-out

1. Add `TimeSpentChart` at the top of Progress with Weekly/Monthly selection, previous/next navigation, accessible bar values, zero state, and minutes/hour formatting.
2. Fetch the insight independently from family progress so one failure does not hide the existing progress sections.
3. Simplify `activity-history.tsx` to the completion list, remove journal requests and mood chart code, ignore legacy `tab=analyze`, and show the localized History title.
4. Relabel the Profile action to History in German and English.
5. Remove all active journal imports/navigation while retaining dormant source and server capability.

### E. Documentation and validation

1. Add an architecture note that journal logic/data remain but all current frontend surfaces are intentionally phased out.
2. Run migration, codegen, server tests, ruff, client typecheck/lint, and Schemathesis against the authoritative spec.
3. Execute every scenario in [quickstart.md](quickstart.md), including two-parent isolation and journal-record preservation.

## Post-Design Constitution Re-check

- Contract-first sequence remains explicit and generated schemas are not manually edited.
- The new table has UUID PK, UTC audit timestamps, hard-delete cascade, and no soft-delete field.
- Personal time is not added to `FamilyProgress`; authorization is current-user scoped by construction.
- No journal schema, route, record, or test is removed.
- No new dependency or architectural layer is required.

All gates pass. No complexity exceptions are required.
