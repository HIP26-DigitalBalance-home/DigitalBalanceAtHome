# Quickstart: Validating Activity Resources

End-to-end validation that the feature works. Assumes the standard dev setup from `CLAUDE.md`.

## Prerequisites

- Server running: `cd server && docker compose up --build` (API + PostgreSQL)
- S3 configured (`S3_ENDPOINT_URL`, `S3_BUCKET_NAME`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`) for the photo path
- Migration applied: `alembic upgrade head` (creates `activity_resources`, `activity_resource_photos`)
- An authenticated parent who belongs to a family (obtain a bearer token via the normal login/seed flow)
- Client: `cd client && npx expo start`

## Contract regen (do this first — spec-driven rule)

```bash
# 1. Merge specs/005-activity-resources/contracts/openapi-additions.yaml into docs/openapi.yaml
# 2. Regenerate schemas (from repo root):
datamodel-codegen \
  --input docs/openapi.yaml --input-file-type openapi \
  --output server/app/schemas/generated.py \
  --output-model-type pydantic_v2.BaseModel \
  --use-annotated --field-constraints --target-python-version 3.12
# 3. pytest   # confirm nothing broke before implementing handlers
```

## Scenario 1 — Author resources on a family activity (User Story 1)

```bash
TOKEN=... ; API=http://localhost:8000

# Create an activity (existing endpoint)
AID=$(curl -s -X POST $API/activities -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Plätzchen backen","description":"Cookies"}' | jq -r .id)

# External link
curl -s -X POST $API/activities/$AID/resources -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"kind":"external","label":"Unser Rezept","url":"https://example.com/rezept"}' | jq

# Internal note (text)
curl -s -X POST $API/activities/$AID/resources -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"kind":"internal","note_text":"Wir nehmen die Hälfte Zucker."}' | jq

# Photo-only internal resource (multipart)
curl -s -X POST $API/activities/$AID/resources/photos -H "Authorization: Bearer $TOKEN" \
  -F image=@sample.jpg -F note_text="Fertige Kekse" | jq
```

**Expected**: Each returns the created `ActivityResource`. The external one has `url`+`label`; internal ones have `note_text` and/or a `photos[]` entry with `status:"processing"`.

## Scenario 2 — A doer reads the resources (User Story 2)

```bash
curl -s $API/activities/$AID -H "Authorization: Bearer $TOKEN" | jq '.resources'
```

**Expected**: `ActivityDetail` with `resources` in insertion order; external link followable; internal photo entries show `photo_url` (pre-signed) once `status` flips to `ready` (re-run after processing). `can_edit` is `true` for the owning family.

**Validation checks**:
- A parent in a *different* family who can reach the activity via a shared challenge sees the same resources, with `can_edit:false`.
- A non-owner receives `403` on any create/edit/delete resource call.

## Scenario 3 — Edit & remove (User Story 3)

```bash
RID=... ; PID=...
curl -s -X PATCH $API/activities/$AID/resources/$RID -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"label":"Besseres Rezept"}' | jq
curl -s -X DELETE $API/activities/$AID/resources/$RID/photos/$PID -H "Authorization: Bearer $TOKEN" -i | head -1
curl -s -X DELETE $API/activities/$AID/resources/$RID -H "Authorization: Bearer $TOKEN" -i | head -1
```

**Expected**: `200` on edit; `204` on both deletes; deleted photos/resources no longer appear in `GET /activities/$AID`, and the S3 objects are gone (verify bucket has no orphaned keys).

## Edge & rule checks

- `POST .../resources` with `kind:"external"` and a `ftp://` or malformed url → `400`.
- `POST .../resources` with `kind:"internal"` and empty `note_text` (no photo path) → `400`.
- 11th resource on one activity, or 6th photo on one resource → `400` with a limit message.
- Delete the activity → `GET` 404 and all resource rows + S3 objects removed (no orphans, SC-006).

## Client validation

- `create-activity.tsx`: add a link and a note-with-photo inline, save, land back — the new activity opens with its resources.
- `activity/[id].tsx`: resources render; external links show an "opens external site" affordance and open in the device browser only on tap; photos appear once ready.

## Automated tests to add (server)

- Resource CRUD happy paths (external, internal-text, internal-photo).
- Ownership: non-owner `403`; cross-family viewer via shared challenge `200` + `can_edit:false`.
- Photo lifecycle: upload → `processing` → `ready` → pre-signed URL present.
- Deletion cascade + S3 cleanup (storage mocked); limits enforced; url/scheme validation.
- Family erasure removes resource photo keys (no orphans).
