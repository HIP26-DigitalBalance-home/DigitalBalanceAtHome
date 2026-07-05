# Quickstart: Time Spent Insights and Journal Phase-Out

**Feature**: `specs/004-time-spent-insights`  
**Purpose**: End-to-end validation guide after implementation

## Prerequisites

Start the local backend and apply migrations:

```bash
cd server
docker compose up --build
alembic upgrade head
```

The test setup needs one family with two parent accounts, one active challenge with at least two activities, and at least one pre-existing journal entry. Keep access tokens for Parent A and Parent B. Dates below are examples; use the current local week/month when testing the UI.

Before implementation verification, return to the repository root and confirm the authoritative contract was updated and schemas regenerated:

```bash
cd ..
datamodel-codegen \
  --input docs/openapi.yaml \
  --input-file-type openapi \
  --output server/app/schemas/generated.py \
  --output-model-type pydantic_v2.BaseModel \
  --use-annotated \
  --field-constraints \
  --target-python-version 3.12
```

## Scenario 1 — Migration and data preservation

1. Before migration, note the counts of `completions` and `journal_entries`.
2. Apply the new migration.
3. Confirm every existing completion has non-null `completed_on` and the count is unchanged.
4. Confirm the journal count and existing mood values are unchanged.
5. Confirm `manual_time_entries` exists with a unique parent/date rule and 1–1,440 minute validation.

**Expected**: No completion or journal row is deleted. Historical `completed_on` equals the UTC date of the existing `completed_at` value.

## Scenario 2 — Manual daily value is private and replaceable

As Parent A, save 30 minutes for local today:

```http
PUT /time-spent/manual
Authorization: Bearer <PARENT_A_TOKEN>
Content-Type: application/json

{"entry_date":"2026-07-05","minutes":30}
```

Repeat with 45 minutes for the same date.

**Expected**:

- Both calls return 200.
- Exactly one row exists for Parent A/date.
- The second response and stored row show 45, not 75.
- Parent B's insight shows zero manual minutes for that date.

Try 0, -1, 1.5, and 1,441 minutes. Each must fail validation and leave 45 unchanged.

## Scenario 3 — Activity duration and fallback

1. Complete Activity 1 as Parent A without a photo using 30 minutes.
2. Complete Activity 2 as Parent A through a flow where duration is optional, leaving it empty; ensure its configured estimate is 60 minutes.
3. Request Parent A's weekly insight for the completion dates.

```http
GET /time-spent?period=weekly&anchor_date=2026-07-05
Authorization: Bearer <PARENT_A_TOKEN>
```

**Expected**:

- Activity 1 contributes 30 minutes.
- Activity 2 contributes its 60-minute estimate.
- Each completion contributes once even after a photo status transition or re-upload.
- Parent B sees neither activity contribution because both completions identify Parent A.

Delete one completion and repeat the GET. Its contribution must disappear without any aggregate repair job.

## Scenario 4 — No-photo completion requires time

1. Open a challenge and choose complete without photo.
2. Confirm the duration row contains 15, 30, 45, 60, 90, 120+, and Custom.
3. Attempt to submit without choosing a duration.
4. Select Custom, enter 75, and submit.

**Expected**:

- Step 3 is blocked in the client and rejected by the server if called directly without `duration_minutes`.
- The accepted completion stores `duration_minutes = 75` and its client-local `completed_on`.
- It remains `self_reported`, fills the collage slot, earns no points, and contributes 75 minutes to Parent A's insight.

Repeat a casual photo completion and confirm the existing point gate is unchanged. Any displayed photo duration picker must also offer Custom.

## Scenario 5 — Weekly and monthly calculations

Prepare Parent A data with known totals:

| Date | Activity | Manual | Expected total |
|---|---:|---:|---:|
| Monday | 30 | 15 | 45 |
| Tuesday | 60 | 0 | 60 |
| Wednesday | 0 | 20 | 20 |
| Other days | 0 | 0 | 0 |

Request weekly view anchored within that week.

**Expected**: Seven chronological Monday–Sunday values are returned; the first three total 45/60/20 and all other dates are explicit zeros.

Then create known values across multiple weeks of one past month and request monthly view.

**Expected**:

- Daily totals cover the month.
- Weekly buckets start Monday but are clipped at month boundaries.
- Bucket totals equal the sum of their included days.
- `average_weekly_minutes` equals the rounded arithmetic mean of all returned buckets.

For the current month, confirm the returned range and buckets stop at local today so future weeks do not lower the average. The client must prevent navigation into a future period.

## Scenario 6 — Home and Progress experience

1. Open Home as Parent A.
2. Confirm the journal/mood card is absent and the time-spent card occupies that hero space.
3. Scroll the single-row duration choices horizontally; select 30 and save.
4. Choose Custom, test invalid input, then save 50.
5. Open Progress.
6. Switch Weekly/Monthly and navigate backward/forward.

**Expected**:

- Home shows the saved manual value and confirms successful saves.
- A failed save preserves the old value and offers a retry.
- The time chart is the first Progress section.
- Weekly bars expose day and minute values to screen readers; monthly bars expose week range and total.
- Long values use localized hours/minutes formatting, while the contract remains minute-based.
- A no-data period shows zero bars and positive empty-state text, not an error.
- Existing family goal, streak, and all-time sections continue to work if the time request fails.

## Scenario 7 — History simplification and dormant journal

1. Open Profile in German and English.
2. Confirm the former Activity action reads `Verlauf` / `History`.
3. Open the view and confirm it immediately shows completion history.
4. Open the legacy `/activity-history?tab=analyze` deep link.
5. Call the retained journal GET endpoint with Parent A's token.

**Expected**:

- The screen title is History and there is no History/Analyze selector.
- No mood chart, mood input, journal copy, or journal navigation appears on Home, Profile, History, or Progress.
- The legacy deep link shows the history list and never exposes mood UI.
- `/journal/entries` still returns the pre-existing entry; journal backend tests still pass.

## Scenario 8 — Privacy isolation

1. Give Parent A and Parent B different manual and activity totals on the same date.
2. Request `/time-spent` with each token.
3. Inspect group feed, collage, family progress, and rewards responses.
4. Attempt to add user/family identifiers to time-spent requests.

**Expected**:

- Each token receives only its own values.
- No endpoint parameter can select another parent.
- Time totals appear in none of the family/group/social responses.
- Existing family progress remains identical for both parents.

## Automated Checks

From `server/`:

```bash
ruff check .
ruff format --check .
pytest
```

With Docker Compose running:

```bash
schemathesis run ../docs/openapi.yaml --base-url http://localhost:8000
```

From `client/`:

```bash
npm run typecheck
npm run lint
```

## Definition of Done

- All eight scenarios pass.
- API implementation matches `docs/openapi.yaml`; generated schemas contain no hand edits.
- Migration upgrade and downgrade are exercised on a disposable database.
- Server tests cover period math, fallback order, zero fill, upsert replacement, validation, and parent isolation.
- Client is visually checked on at least one iOS and one Android viewport, including large text and screen-reader labels.
- Existing journal integration tests pass and journal row counts remain unchanged.
