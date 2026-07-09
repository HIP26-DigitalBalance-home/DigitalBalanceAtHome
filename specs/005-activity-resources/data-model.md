# Phase 1 Data Model: Activity Resources

Two new tables extend the existing `activities` aggregate. Conventions follow the project: UUID PKs (`gen_random_uuid()`), `TIMESTAMPTZ` via `TimestampMixin`, hard deletes, `ON DELETE CASCADE`.

## Entity: ActivityResource

A helpful item attached to one activity. Discriminated by `kind`.

**Table**: `activity_resources`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | UUID | no | PK, `gen_random_uuid()` |
| `activity_id` | UUID | no | FK → `activities.id` `ON DELETE CASCADE`, indexed |
| `kind` | String | no | `external` \| `internal` (CHECK constraint) |
| `position` | Integer | no | 0-based display order within the activity |
| `label` | String(100) | yes | External: link label. Internal: optional heading. |
| `url` | String(2048) | yes | External only — required when `kind='external'`; must be `http`/`https` |
| `note_text` | String(2000) | yes | Internal only — the written note |
| `created_at` / `updated_at` | TIMESTAMPTZ | no | `TimestampMixin` |

**Constraints & rules**
- `CHECK (kind IN ('external','internal'))`.
- `CHECK`: when `kind='external'` → `url` NOT NULL and `note_text` NULL; when `kind='internal'` → `url` NULL.
- **Invariant (FR-003, service-enforced)**: an `internal` resource must have non-empty `note_text` **or** ≥1 associated photo (in any state). Enforced by the creation paths in [research.md](research.md) D3 — no transient-empty rows are ever written.
- `url` scheme/format validated in the service/schema layer (Pydantic `AnyUrl` limited to http/https), not only DB length.
- Per-activity resource count capped at 10 (service validation; FR-016).
- Ordered by `position` on read.

**Relationships**
- Many `ActivityResource` → one `Activity`.
- One `internal` `ActivityResource` → many `ActivityResourcePhoto`.

## Entity: ActivityResourcePhoto

An image belonging to exactly one internal resource. Same lifecycle as completion photos.

**Table**: `activity_resource_photos`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | UUID | no | PK, `gen_random_uuid()` |
| `resource_id` | UUID | no | FK → `activity_resources.id` `ON DELETE CASCADE`, indexed |
| `photo_key` | String | yes | S3 object key of the final (compressed) image; NULL while `processing` |
| `status` | String | no | `processing` \| `ready` (CHECK constraint) |
| `position` | Integer | no | 0-based order within the resource |
| `created_at` / `updated_at` | TIMESTAMPTZ | no | `TimestampMixin` |

**Constraints & rules**
- `CHECK (status IN ('processing','ready'))`.
- `photo_url` is **not stored** — generated on read via `storage.generate_presigned_url(photo_key, expires=900)` when `status='ready'`.
- Per-resource photo count capped at 5 (service validation; FR-016).
- Only attachable to `kind='internal'` resources (enforced in service).

**Lifecycle** (mirrors completion photo)
```
upload (multipart) ──► row created status=processing, photo_key=NULL
        │  background task: compress (Pillow) ──► storage.upload_bytes(final_key)
        ▼
   status=ready, photo_key=final_key ──► pre-signed URL served inline
delete ──► row hard-deleted + storage.delete_object(photo_key) best-effort
```

## Relationship to existing entities

- **Activity** (`app/models/activity.py`): add `resources` relationship (`ordering by position`, `cascade="all, delete-orphan"`). Ownership (`family_id`) governs edit rights; `family_id IS NULL` = curated/global = read-only in-app.
- **Family / erasure**: `activities.family_id` already `ON DELETE CASCADE` to families, so resources and photos cascade on family deletion. The erasure S3-key sweep is extended to include resource `photo_key`s (SC-006).

## Derived / response schemas (OpenAPI)

See [contracts/openapi-additions.yaml](contracts/openapi-additions.yaml). Summary:

- **`ActivityResource`** (response): `id, kind, position, label?, url?, note_text?, photos?[]`.
- **`ActivityResourcePhoto`** (response): `id, status, position, photo_url?` (`photo_url` present only when `ready`).
- **`ActivityDetail`** (response): all `Activity` fields + `resources: ActivityResource[]` + `can_edit: boolean` (true when caller's family owns the activity).
- **`CreateResourceRequest`** (request, JSON): `kind`, plus `url`+`label?` (external) or `note_text` (internal).
- **`UpdateResourceRequest`** (request, JSON): optional `label`, `url`, `note_text`.
- Photo uploads use multipart `image` (binary) form, returning `202` with the created/updated `ActivityResourcePhoto` in `processing` state — identical convention to completion photo upload.

## State transitions

Only photos have states (`processing` → `ready`). Resources themselves are created-complete and only edited/deleted; no status field.
