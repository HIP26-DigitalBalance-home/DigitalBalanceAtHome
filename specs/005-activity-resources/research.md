# Phase 0 Research: Activity Resources

All Technical Context items are known (the feature extends an existing, well-established aggregate). This document records the design decisions that resolve the spec's open choices and the "reasonable defaults" recorded in the spec's Assumptions section.

## D1 — Storage shape: relational tables vs. JSON column

**Decision**: Two new relational tables — `activity_resources` (one row per resource, discriminated by `kind`) and `activity_resource_photos` (one row per photo, FK to an internal resource).

**Rationale**: Photos require an independent lifecycle (`processing` → `ready`), individual deletion, and pre-signed URL generation per object — exactly the completion photo model. Relational rows make ordering, per-photo deletion, cascade-on-erasure, and the "no orphaned objects" guarantee straightforward. The project already models everything relationally with one repository per aggregate root.

**Alternatives considered**: A single JSONB `resources` column on `activities`. Rejected — can't cleanly track per-photo processing state or drive object-storage cleanup, and diverges from the codebase's uniform relational + repository pattern.

## D2 — Photo pipeline: reuse the completion flow

**Decision**: Reuse `app/core/storage.py` and the completion upload pattern verbatim — multipart `UploadFile`, store raw, `BackgroundTasks` compresses (Pillow) to a final key, set `status='ready'`; serve via `storage.generate_presigned_url(key, expires=900)` embedded inline in responses when ready.

**Rationale**: The completion path (`services/completion.py`) already solves EU-hosted storage, background compression, processing states, pre-signed 15-min URLs, and best-effort object deletion on delete. Reusing it keeps privacy/GDPR behavior identical and avoids a second photo mechanism (spec Assumption).

**Alternatives considered**: Client-direct pre-signed PUT upload. Rejected for v1 — the app has no existing direct-PUT pattern; matching completions minimizes new surface and keeps compression server-side.

## D3 — API shape for authoring (avoiding transient-invalid resources)

**Decision**: Nest resources under the activity and split creation by kind so no resource ever exists in an invalid (neither-text-nor-photo) state:

- `POST /activities/{id}/resources` (JSON) — creates an **external** resource (`url` required) **or** an **internal** resource with `note_text` (required non-empty for this path).
- `POST /activities/{id}/resources/photos` (multipart) — creates a **photo-only** (or photo+optional-text) internal resource carrying the first photo.
- `POST /activities/{id}/resources/{rid}/photos` (multipart) — adds another photo to an existing internal resource.
- `PATCH /activities/{id}/resources/{rid}` — edit label / url / note_text.
- `DELETE /activities/{id}/resources/{rid}` — remove a resource (+ its photos + S3 objects).
- `DELETE /activities/{id}/resources/{rid}/photos/{pid}` — remove a single photo.

**Rationale**: The FR-003 invariant ("internal resource must have text OR ≥1 photo") is enforced at creation with no transient empty rows: a text resource is born with text; a photo resource is born via multipart carrying a photo. The inline "add resources while creating" UX (User Story 1) is realized as multiple calls under the hood — the same shape completions already use.

**Alternatives considered**: (a) One bundled `POST /activities` accepting the whole resource array. Rejected — can't carry photo binaries in the activity-create JSON, and would need multipart on the primary create route. (b) Allowing empty internal resources then pruning. Rejected — creates transient-invalid states and orphan-cleanup burden.

## D4 — Reading resources: new detail endpoint

**Decision**: Add `GET /activities/{id}` returning `ActivityDetail` = the existing `Activity` fields plus `resources: ActivityResource[]`, each internal photo carrying a pre-signed `photo_url` when `status='ready'`. The activity **list** and **suggestion** endpoints are unchanged (no resources embedded there).

**Rationale**: There is currently no single-activity GET — the list embeds everything. Generating pre-signed URLs for every photo of every activity in a list would be wasteful; resources are only needed when a parent opens one activity to do it (User Story 2). A detail endpoint is the natural fetch point.

**Alternatives considered**: Embedding resources in the list response. Rejected on cost (N pre-signed URLs per list) and irrelevance to browsing.

## D5 — Ownership & visibility

**Decision**:
- **View**: any caller who can already access the activity — global/curated activities, the caller's own family-created activities, or activities embedded in a challenge the caller can access. Reuse the existing activity-access rules (`ActivityRepository` visibility: `family_id IS NULL OR family_id = caller_family`) extended to challenge-embedded access already used for shared challenges.
- **Edit** (create/update/delete resources): only the owning family (`activities.family_id == caller_family`). Curated activities (`family_id IS NULL`) are read-only in-app; their resources are authored via seed/admin only.

**Rationale**: Mirrors FR-010/FR-011 and existing activity semantics. No new permission concept is introduced.

**Alternatives considered**: Per-parent (not per-family) ownership. Rejected — activities are family-scoped in this product; either parent in the owning family may maintain them, consistent with child profiles and completions.

## D6 — GDPR erasure & orphan prevention

**Decision**: FK chain `activities → activity_resources → activity_resource_photos` all `ON DELETE CASCADE`. Deleting a resource/photo/activity deletes the row(s) and best-effort deletes the S3 object(s) (try/except, mirroring `delete_completion`). Family erasure already cascades to the family's activities; extend the erasure photo-key sweep to also collect resource photo keys so no S3 objects are orphaned (SC-006).

**Rationale**: Satisfies "no soft deletes", FR-013/FR-014/FR-015, and the 0-orphaned-objects success criterion using the pattern already in `delete_completion`.

## D7 — External link handling (no fetch/unfurl)

**Decision**: Store `url` verbatim (validated as `http`/`https` and length-bounded); the server never fetches, HEAD-checks, or unfurls it. The client renders the label + host and marks it as an external destination; navigation happens only on user tap in the device browser.

**Rationale**: FR-017 and the project's no-third-party-tracking stance — server-side fetching would leak parent behavior to third parties and add failure modes.

**Alternatives considered**: Server-side link preview/title fetch. Rejected on privacy grounds.

## D8 — Limits (defaults)

**Decision** (enforced in schema constraints + service validation; final numbers can be tuned in tasks):

| Field | Limit |
|---|---|
| Resources per activity | 10 |
| Photos per internal resource | 5 |
| `note_text` length | 2000 chars |
| `label` length | 100 chars |
| `url` length | 2048 chars |

**Rationale**: Keeps the activity view scannable (SC-001/SC-003) and storage bounded; a limit is communicated before a save fails (FR-016).

## Resolved unknowns

No `NEEDS CLARIFICATION` markers remained in the spec, and none arose here. All Technical Context fields are concrete.
