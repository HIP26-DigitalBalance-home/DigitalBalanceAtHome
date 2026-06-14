# Feature Plan: Collage System Redesign

## Goal

Enforce 3×3 collages everywhere, add an Explore tab with predefined/random/custom collage templates, and let users replace any slot or create new activities from within the collage builder.

---

## What Changes

### 1. Lock CollageGrid to 3×3

**File:** `client/components/collage-grid.tsx`

Remove the dynamic column calculation:
```ts
// Remove:
const numColumns = Math.max(2, Math.ceil(Math.sqrt(slots.length)));

// Replace with:
const numColumns = 3;
```

All downstream screens already use `CollageGrid` — no other changes needed for rendering.

---

### 2. Explore Tab (replaces Activities tab)

**File rename:** `client/app/(tabs)/activities.tsx` → `client/app/(tabs)/explore.tsx`  
**Tab layout update:** `client/app/(tabs)/_layout.tsx` — rename tab from `activities` → `explore`, title `"Activities"` → `"Explore"`, update icon if desired.

The Explore screen shows a single **2-column grid** of collage topic cards (as many rows as needed):
- **First card**: Custom — starts the builder with 9 empty slots
- **Second card**: Random — generates a random selection of 9 activities at challenge-creation time
- **Remaining cards**: predefined collage templates fetched from the server

Each card shows:
- Collage name
- Short description

Tapping any card navigates to the Collage Builder.

The list is loaded via `GET /collage-presets`. The Custom and Random cards are rendered as static local cards prepended before the server-fetched list; they are never returned by the API. While loading, show a 2-column skeleton grid. On error, show a retry state; the Custom and Random cards are always visible even on network failure.

---

### 3. Predefined Collage Templates (server-side)

Predefined collages are stored and served by the backend. The client has no hardcoded template data.

**New API type** (client-side, in `client/lib/api/collage-presets.ts`):
```ts
export interface CollagePreset {
  id: string;
  name: string;
  description: string;
  activity_ids: string[]; // exactly 9, ordered by grid_position 0–8
}

export const collagePresetsApi = {
  list: () => apiClient.get<CollagePreset[]>('/collage-presets'),
};
```

**Server-side model:** A `CollagePreset` table (or seed-only JSON fixture loaded at startup) with:
- `id` UUID PK
- `name` string
- `description` string
- `activity_ids` UUID[9] — foreign keys into the `activities` table, ordered

Predefined collages are admin-managed (no CRUD endpoints needed in v1 — seed data only). The single read endpoint returns all presets ordered by a `sort_order` integer column.

**Seed data:** Create 5–6 themed presets in the seed script, each referencing 9 real activity IDs. Suggested themes (names in German):
- Outdoor-Abenteuer
- Kreative Familie
- Achtsame Momente
- Gemeinsam in der Küche
- Regentag-Entdecker

Seed data is maintained in `server/seed_data/collage_presets.json` and loaded by the existing seed script.

---

### 4. Collage Builder Screen

**New file:** `client/app/collage-builder.tsx`

**Route params:**
| Param | Values |
|---|---|
| `mode` | `'preset' \| 'random' \| 'custom'` |
| `presetId` | preset UUID (only when `mode=preset`) |

**Behaviour:**
- On mount, resolves the 9 activity slots:
  - `preset`: the `CollagePreset` object is passed via route params (serialised JSON) — the Explore screen already has it from the list fetch, so no extra request needed. The `activity_ids` array (length 9) maps directly to slots 0–8.
  - `random`: fetches `GET /activities` (no filters), shuffles client-side, takes first 9
  - `custom`: starts with 9 `null` slots
- Renders an interactive 3×3 grid using a simplified inline grid (not `CollageGrid`, which is for completed challenges — this is for editing)
- Each slot shows the activity title if filled, or "+" if empty
- Tapping any slot opens `ActivityPickerModal` with the slot index
- A "Continue" button is enabled only when all 9 slots are filled; it navigates to `create-challenge` with `activityIds` as a route param

**Visual design:**
- Grid uses `FlatList` with `numColumns={3}`, each cell square
- Filled slot: activity title (2 lines max) on `colors.surface` with `colors.accent` border
- Empty slot: "+" icon on `colors.surface` with `colors.border` dashed border

---

### 5. Activity Picker Modal

**New file:** `client/components/activity-picker-modal.tsx`

A full-screen modal (not a bottom sheet — the list is long) that wraps the existing activity-browsing experience.

**Props:**
```ts
interface Props {
  visible: boolean;
  onSelect: (activity: ActivityItem) => void;
  onClose: () => void;
}
```

**Contents:**
- Header: "Choose activity" + close button
- "Create new activity" CTA row at the very top of the list (always visible above the filter chips)
- Season + cost filter chips (same as current `activities.tsx`)
- `FlatList` of activities loaded via `activitiesApi.list(filters)` — same as current tab
- Tapping an activity calls `onSelect(activity)` and closes

**"Create new activity"** — taps navigate to `app/create-activity.tsx`. On return, the modal reloads the list and auto-selects the newly created activity (pass it back via route params or a shared state atom).

---

### 6. Create Activity Screen

**New file:** `client/app/create-activity.tsx`

Minimal form — single step:
| Field | Required | Notes |
|---|---|---|
| Title | yes | max 100 chars |
| Description | no | multiline, max 500 chars |
| Duration (minutes) | no | numeric input, default 30 |
| Cost | no | chip selector: Free / Low cost, default Free |

On submit: `POST /activities` (see backend section below).  
On success: `router.back()` with new activity data passed via Expo Router's `setParams` or pushed as a result param so the picker can auto-select it.

---

### 7. Update create-challenge.tsx

**Remove Step 2** (the current activity-picker step).  
The challenge wizard now starts with the 9 activity IDs already determined (from the Collage Builder). The wizard becomes 3 steps:

| Step | Content |
|---|---|
| 1 | Title + description |
| 2 | Set dates |
| 3 | Assign to group |

Activity IDs arrive as a route param: `activityIds` (comma-separated string or JSON-encoded array).

---

### 8. app/activity/[id].tsx

This detail screen currently receives activity data via route params from the Activities tab. Once that tab is gone, it's only reachable from `ActivityPickerModal` if we add a "View details" gesture (long-press or info button). For now, **keep the file but make it unreachable from main navigation** — surfacing it from the picker is a follow-on task.

---

## Backend Requirements

### New endpoint: `GET /collage-presets`

```yaml
GET /collage-presets
Auth: required (any authenticated user)
Response 200:
  [
    {
      id: string (UUID),
      name: string,
      description: string,
      activity_ids: string[9]  // ordered grid_position 0–8
    },
    ...
  ]
```

Returns all presets ordered by `sort_order`. This is a read-only endpoint; presets are managed via seed data only in v1.

**Server-side:**
- New `CollagePreset` SQLAlchemy model: `id`, `name`, `description`, `activity_ids` (ARRAY of UUID), `sort_order` (integer)
- New `collage_presets` table, populated by seed script
- New route at `GET /collage-presets` → `CollagePresetRepository.list_all()` → returns sorted list
- No service layer needed (no business logic); route calls repository directly

### New endpoint: `POST /activities`

```yaml
POST /activities
Auth: required (any authenticated user)
Request:
  title: string (required, max 100)
  description: string | null
  estimated_duration_minutes: integer | null (default 30)
  cost_indicator: 'free' | 'low_cost' (default 'free')
Response 201:
  { ...ActivityItem }
```

**Auth:** any authenticated user. User-created activities are globally visible (same pool as seeded activities). This keeps the data model flat and avoids "whose activity is this" scoping complexity.

**Mandatory spec-driven workflow (per CLAUDE.md):**
1. Add both endpoints to `docs/openapi.yaml` (including the `CollagePreset` schema)
2. Run codegen → regenerate `server/app/schemas/generated.py`
3. Implement routes → repositories
4. Add seed data in `server/seed_data/collage_presets.json`
5. Run `pytest`

---

## Files Changed / Created

| Action | Path |
|---|---|
| Modify | `client/components/collage-grid.tsx` — lock to 3 cols |
| Rename + rewrite | `client/app/(tabs)/activities.tsx` → `explore.tsx` |
| Modify | `client/app/(tabs)/_layout.tsx` — update tab name/screen name |
| New | `client/lib/api/collage-presets.ts` — API client + `CollagePreset` type |
| Modify | `client/lib/api/index.ts` — export `collagePresetsApi` and `CollagePreset` |
| New | `client/app/collage-builder.tsx` |
| New | `client/components/activity-picker-modal.tsx` |
| New | `client/app/create-activity.tsx` |
| Modify | `client/app/create-challenge.tsx` — remove step 2, accept activityIds param |
| Modify | `docs/openapi.yaml` — add `GET /collage-presets`, `CollagePreset` schema, `POST /activities` |
| Modify | `server/app/schemas/generated.py` — regenerated |
| New | `server/app/models/collage_preset.py` — SQLAlchemy model |
| New | `server/app/repositories/collage_presets.py` |
| New | `server/app/api/collage_presets.py` — GET route |
| New | `server/app/api/activities.py` — POST route (or extend existing) |
| Modify | `server/app/services/activities.py` — add create method |
| Modify | `server/app/repositories/activities.py` — add insert |
| New | `server/seed_data/collage_presets.json` — 5–6 themed presets |
| New | `server/alembic/versions/xxx_add_collage_presets.py` — migration |

---

## Open Decisions

1. **Language**: Are predefined collage names/descriptions in German only, or bilingual? (Recommendation: German, matching the app's primary audience)
2. **User-created activity visibility**: Global vs. family-scoped? (Recommendation above: global, simpler)
3. **Navigation after collage builder**: Does the builder push directly into create-challenge, or return to Explore? (Recommendation: push directly — collage building is step 0 of creating a challenge)
4. **Preset management in v2**: Should admins be able to add/edit/reorder collage presets via an API? For now, seed-data-only is fine. Flag as a follow-on if content needs to change without a deployment.
5. **Existing challenges**: Challenges already created with more or fewer than 9 activities will still render correctly via `CollageGrid` (which just locks columns, not slot count). No migration needed.
