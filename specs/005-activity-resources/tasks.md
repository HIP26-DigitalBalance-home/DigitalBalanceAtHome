---
description: "Task list for Activity Resources implementation"
---

# Tasks: Activity Resources

**Input**: Design documents from `/specs/005-activity-resources/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/openapi-additions.yaml](contracts/openapi-additions.yaml)

**Tests**: Included — the design docs ([quickstart.md](quickstart.md) "Automated tests to add") call out a specific server test set, and the repo mandates `pytest` + schemathesis in its change workflow.

**Organization**: Tasks grouped by user story (US1 authoring, US2 viewing, US3 edit/remove) so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3
- Exact file paths included

## Path Conventions

Monorepo: server `server/app/...`, `server/tests/...`, `server/alembic/versions/`; client `client/...`. Repo-root docs: `docs/openapi.yaml`.

---

## Phase 1: Setup (Contract-First — Shared Infrastructure)

**Purpose**: Establish the authoritative contract before any handler work (hard rule from CLAUDE.md).

- [X] T001 Merge all paths and schemas from `specs/005-activity-resources/contracts/openapi-additions.yaml` into `docs/openapi.yaml` (6 endpoints under `/activities/{activity_id}...`; schemas `ActivityResource`, `ActivityResourcePhoto`, `ActivityDetail`, `CreateResourceRequest`, `UpdateResourceRequest`)
- [X] T002 Regenerate `server/app/schemas/generated.py` via the `datamodel-codegen` command in CLAUDE.md (run from repo root), then run `cd server && pytest` to confirm the baseline still passes with the new schemas
- [X] T003 [P] Add resource TypeScript interfaces (`ActivityResource`, `ActivityResourcePhoto`, `ActivityDetail`, request payloads) to `client/lib/api/activities.ts` (types only, no calls yet)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data layer + shared service scaffolding every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] Create `ActivityResource` ORM model in `server/app/models/activity_resource.py` (UUID PK, `activity_id` FK CASCADE, `kind`, `position`, `label`, `url`, `note_text`, `TimestampMixin`; CHECK constraints per [data-model.md](data-model.md))
- [X] T005 [P] Create `ActivityResourcePhoto` ORM model in `server/app/models/activity_resource_photo.py` (UUID PK, `resource_id` FK CASCADE, `photo_key`, `status` processing|ready, `position`, `TimestampMixin`; CHECK on status)
- [X] T006 Add `resources` relationship (`order_by=position`, `cascade="all, delete-orphan"`) to `server/app/models/activity.py` (depends on T004, T005)
- [X] T007 Register the two new models in `server/app/models/__init__.py` (depends on T004, T005)
- [X] T008 Create Alembic migration in `server/alembic/versions/` for `activity_resources` and `activity_resource_photos` (both tables, FKs, indexes, CHECKs); apply with `alembic upgrade head` (depends on T006, T007)
- [X] T009 Implement `ActivityResourceRepository` in `server/app/repositories/activity_resource.py` (get resources for activity ordered by position; get by id; create/update/delete resource; add/delete photo; count helpers for limit checks) (depends on T004, T005)
- [X] T010 Create service module `server/app/services/activity_resource.py` with shared helpers only: `assert_can_view(activity, family_id)` and `assert_owner(activity, family_id)` (reuse existing activity access rules: global `family_id IS NULL`, own family, or shared-challenge access), plus limit constants (10 resources/activity, 5 photos/resource) and an http/https URL validator (depends on T009)
- [X] T011 Add domain exceptions (e.g., `ResourceNotFound`, `ResourceLimitExceeded`, `NotResourceOwner`, `InvalidResourceUrl`) to `server/app/services/exceptions.py` and map them to HTTP status in the activities router error handling

**Checkpoint**: Tables, models, repository, and shared ownership/visibility helpers exist — stories can begin.

---

## Phase 3: User Story 1 — Attach resources while creating an activity (Priority: P1) 🎯 MVP

**Goal**: An owner can attach external links and internal notes+photos to their activity.

**Independent Test**: Create an activity, POST an external link, a text note, and a photo-only internal resource; verify each is stored and associated (quickstart Scenario 1).

### Tests for User Story 1

- [X] T012 [P] [US1] Integration tests for resource creation in `server/tests/integration/test_activity_resources_create.py` (plus service unit tests in `server/tests/unit/test_activity_resource_service.py`): external link (valid + rejected non-http/malformed), internal text note (valid + rejected empty), photo-only internal via multipart (returns `processing`), per-activity resource limit and per-resource photo limit, non-owner `403` (storage mocked)

### Implementation for User Story 1

- [X] T013 [US1] Implement `create_external_resource` and `create_internal_text_resource` in `server/app/services/activity_resource.py` (validate url/scheme, non-empty note, enforce resource limit, assign next `position`, assert owner)
- [X] T014 [US1] Implement `POST /activities/{activity_id}/resources` JSON endpoint in `server/app/api/activities.py` (dispatch by `kind`, return `ActivityResource` from `generated.py`)
- [X] T015 [US1] Implement resource-photo upload + background compression in `server/app/services/activity_resource.py`, reusing the completion pipeline pattern (`storage.upload_bytes` → Pillow compress → final key → `status=ready`); include `create_photo_only_resource(image, note_text?)` and `add_photo(resource_id, image)` with photo-limit enforcement
- [X] T016 [US1] Implement multipart endpoints in `server/app/api/activities.py`: `POST /activities/{activity_id}/resources/photos` (creates internal resource, 202) and `POST /activities/{activity_id}/resources/{resource_id}/photos` (adds photo, 202), using `BackgroundTasks` like completions
- [X] T017 [US1] Add resource authoring API calls (`createResource`, `createResourcePhoto`, `addResourcePhoto`) to `client/lib/api/activities.ts`
- [X] T018 [US1] Build the resources editor in `client/app/create-activity.tsx` (add/remove external links and note+photo blocks inline) plus a small `client/components/add-resource-sheet.tsx`; on save, create the activity then POST each resource/photo (theme tokens only, no hardcoded values)
- [X] T019 [P] [US1] Add German + English i18n strings for resource authoring in `client/lib/i18n/de.ts` and `client/lib/i18n/en.ts`

**Checkpoint**: An owner can fully author resources on an activity; verifiable via API and the create screen.

---

## Phase 4: User Story 2 — Use attached resources when doing an activity (Priority: P1)

**Goal**: A parent opening an activity sees its resources — followable external links and inline notes/photos.

**Independent Test**: Seed an activity with one external link and one internal note+photo; `GET /activities/{id}` returns them in order with a pre-signed `photo_url` once ready; a cross-family viewer (via shared challenge) sees them with `can_edit:false` (quickstart Scenario 2).

### Tests for User Story 2

- [X] T020 [P] [US2] Integration tests for `GET /activities/{activity_id}` in `server/tests/integration/test_activity_detail.py`: resources returned in `position` order; internal photo carries pre-signed `photo_url` when `ready` and none while `processing`; `can_edit` true for owner / false for accessible non-owner; `404` for inaccessible activity (storage mocked)

### Implementation for User Story 2

- [X] T021 [US2] Implemented as `get_activity_with_resources(session, user_id, activity_id)` in `server/app/services/activity_resource.py` (authorizes via `_load_viewable_activity`, loads resources + photos via repository, generates pre-signed URLs for `ready` photos with `expires=900`, returns `can_edit`)
- [X] T022 [US2] Implement `GET /activities/{activity_id}` endpoint in `server/app/api/activities.py` returning `ActivityDetail`; reuse `_activity_schema` for the base fields and attach `resources` + `can_edit`
- [X] T023 [US2] Fetch and render resources in `client/app/activity/[id].tsx`: external links with an "opens external site" affordance (open in device browser on tap only), internal notes with inline text + photos; empty state when none; `let cancelled = false` guard on the async effect
- [X] T024 [P] [US2] Add German + English i18n strings for resource viewing (section heading, "external site" label) in `client/lib/i18n/de.ts` and `client/lib/i18n/en.ts`

**Checkpoint**: Both P1 stories work — resources can be authored (US1) and consumed (US2). This is the recommended demo/MVP slice.

---

## Phase 5: User Story 3 — Update or remove resources you own (Priority: P2)

**Goal**: The owning family can edit and delete resources and individual photos, with storage cleaned up.

**Independent Test**: On an owned activity, PATCH a resource label, DELETE a photo, DELETE a resource; verify changes persist, they disappear from `GET /activities/{id}`, and S3 objects are removed; non-owner is `403` (quickstart Scenario 3).

### Tests for User Story 3

- [X] T025 [P] [US3] Integration tests in `server/tests/integration/test_activity_resources_edit.py` (route level) plus service unit tests (storage cleanup, kind-mismatch) in `server/tests/unit/test_activity_resource_service.py`: update label/url/note (valid + kind-mismatch rejected), delete single photo (row + `storage.delete_object` called), delete resource (cascades photos + storage), non-owner `403`, `404` for missing ids (storage mocked)

### Implementation for User Story 3

- [X] T026 [US3] Implement `update_resource`, `delete_resource`, `delete_photo` in `server/app/services/activity_resource.py` (assert owner; only kind-valid fields updatable; best-effort `storage.delete_object` on photo/resource delete, mirroring `delete_completion`)
- [X] T027 [US3] Implement `PATCH /activities/{activity_id}/resources/{resource_id}`, `DELETE /activities/{activity_id}/resources/{resource_id}`, and `DELETE /activities/{activity_id}/resources/{resource_id}/photos/{photo_id}` in `server/app/api/activities.py`
- [X] T028 [US3] Add edit/remove UI gated by `can_edit` in `client/app/activity/[id].tsx` (and/or the create-activity editor) plus `updateResource`, `deleteResource`, `deleteResourcePhoto` calls in `client/lib/api/activities.ts`

**Checkpoint**: All three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T029 [P] Extend the account/family hard-deletion sweep and `export_data` in `server/app/services/user.py` (and any deletion job/repository it calls) to collect and delete `activity_resource_photos.photo_key` objects, guaranteeing zero orphaned resource photos after erasure (SC-006). Note: resource photo keys live under the same `photos/{family_id}/` prefix the family teardown sweep (`app/services/seed.py::_delete_family_photos`) already purges; the sweep was additionally extended to the `raw/{family_id}/` prefix (stuck-processing uploads), and `export_data` now includes `created_activities` with their resources (DataExport schema extended in `docs/openapi.yaml` first, then codegen)
- [X] T030 [P] Run schemathesis contract tests (`schemathesis run ../docs/openapi.yaml --url http://localhost:8000`) and fix any contract drift for the new endpoints — fixed missing `401` (and one `404`) responses on the five authoring endpoints; one known-acceptable artifact remains (`PATCH .../resources/photos` returns 401 instead of 405 because the literal path overlaps the `{resource_id}` sibling route and auth runs before path validation — same behavior class as the rest of the API)
- [X] T031 [P] `ruff format . && ruff check .` in `server/` (feature files clean; repo-wide findings from newer ruff on untouched files left as-is); client `tsc --noEmit` + eslint clean on all touched files
- [X] T033 (post-review feedback) Surface resources in the actual user journey: the detail screen was unreachable (nothing navigated to `/activity/[id]`), so resources displayed nowhere. Extracted `client/components/resource-list.tsx` (shared read-only/editable renderer, used by `activity/[id].tsx`); `client/components/complete-activity-modal.tsx` now fetches `GET /activities/{id}` on open and shows a collapsed "ℹ️ Hilfreiche Infos (n)" toggle above the upload controls — hidden entirely when the activity has no resources, expanding inline to links/notes/photos, with an owner-only "Edit" link that closes the modal and opens `/activity/[id]` (making the edit UI reachable)
- [X] T034 (post-review feedback) Seed demo resources: `_RESOURCE_SEEDS` in `server/app/services/seed.py` attaches curated resources to two activities the demo family has not completed — "Gemeinsam ein Gericht kochen" (recipe link + note, active featured challenge) and "Selbstgemachte Knete herstellen" (recipe note + `playdough.jpg` photo, summer challenge) — covering all three resource shapes. Teardown deletes and re-creates them per seed run (idempotent; verified live: re-seed keeps exactly 3 rows, photo URL serves 200). Also fixed the "Hilfreiche Infos" toggle layout (icon/label/chevron as separate gap-spaced elements instead of emoji-in-string, which overlapped)
- [X] T032 Execute [quickstart.md](quickstart.md) end-to-end (Scenarios 1–3 + edge/rule checks) and run the full `cd server && pytest` suite to confirm green — all scenarios validated live against Docker Compose + real S3 (photo lifecycle processing→ready→pre-signed URL confirmed); 238 tests pass. Note: the migration originally shipped as revision `a1b2c3d4e5f6` collided with the pre-existing `a1b2c3d4e5f6_add_activity_ownership.py` (Alembic cycle, API crash-loop); renamed to `7e3b9d24c8a1_add_activity_resources.py`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 → T002 (codegen needs merged spec); T003 independent [P]
- **Foundational (Phase 2)**: depends on Setup; T004/T005 [P] → T006/T007 → T008; T004/T005 → T009 → T010 → T011. BLOCKS all stories.
- **User Stories (Phase 3–5)**: all depend on Foundational. US1 and US2 are both P1 and independent; US3 (P2) is independent but naturally demoed after US1/US2.
- **Polish (Phase 6)**: after the desired stories are complete.

### User Story Dependencies

- **US1 (P1)**: after Foundational. No dependency on other stories.
- **US2 (P1)**: after Foundational. Independently testable via seeded resources; does not require US1's UI.
- **US3 (P2)**: after Foundational. Independent; edits data US1 creates but testable via seeded resources.

### Within Each User Story

- Tests before implementation (write, watch fail, implement).
- Service before endpoint; endpoint before client; base implementation before integration.

### Parallel Opportunities

- T003 runs parallel to T001/T002.
- T004 and T005 in parallel; then T006/T007.
- Test tasks T012 / T020 / T025 are [P] within their stories.
- i18n tasks T019 / T024 are [P].
- With capacity, after Phase 2: Dev A → US1, Dev B → US2, Dev C → US3.

---

## Parallel Example: User Story 1

```bash
# Foundational models in parallel:
Task: "Create ActivityResource model in server/app/models/activity_resource.py"
Task: "Create ActivityResourcePhoto model in server/app/models/activity_resource_photo.py"

# Then within US1, i18n runs alongside backend work:
Task: "Add resource authoring i18n strings in client/lib/i18n/de.ts and en.ts"
```

---

## Implementation Strategy

### MVP

Per the spec, US1 and US2 are both P1 — authoring is only valuable once resources are viewable. Recommended MVP = **Setup + Foundational + US1 + US2**. (US1 alone is the minimum shippable authoring slice if a hard cut is needed.)

1. Phase 1 Setup → contract merged + codegen green
2. Phase 2 Foundational → data layer + helpers
3. Phase 3 US1 → author resources → validate (Scenario 1)
4. Phase 4 US2 → view resources → validate (Scenario 2) → **demo MVP**
5. Phase 5 US3 → edit/remove → validate (Scenario 3)
6. Phase 6 Polish → erasure sweep, contract tests, lint, full quickstart

### Notes

- [P] = different files, no dependency.
- Follow the CLAUDE.md hard rule: `docs/openapi.yaml` first, then regenerate `generated.py`, then handlers — never hand-edit `generated.py`.
- Resource photos must reuse `app/core/storage.py` + the completion background-processing pattern; do not introduce a second photo mechanism.
- Client must use `constants/theme.ts` tokens and the `let cancelled = false` effect guard.
- Commit after each task or logical group.
