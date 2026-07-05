# Data Model: Time Spent Insights and Journal Phase-Out

**Feature**: `004-time-spent-insights`  
**Date**: 2026-07-05

## Design Principles

- Store only source facts: manual daily minutes and a stable local date on each completion.
- Derive daily and weekly insight values at query time so edits and hard deletes are immediately reflected.
- Scope every time-spent query by the authenticated parent, never by a caller-supplied user or family ID.
- Keep UTC timestamps for auditing while using explicit `DATE` fields for user-facing calendar grouping.
- Leave all journal entities and records unchanged.

## New Entity: `manual_time_entries`

One parent-entered manual total for one local calendar date.

| Column | Type | Constraints / Meaning |
|---|---|---|
| `id` | UUID | Primary key; generated with `gen_random_uuid()` |
| `user_id` | UUID | Required FK → `users.id`, `ON DELETE CASCADE` |
| `entry_date` | DATE | Required; client-local calendar date |
| `minutes` | INTEGER | Required; 1–1,440 inclusive |
| `created_at` | TIMESTAMPTZ | Required; UTC |
| `updated_at` | TIMESTAMPTZ | Required; UTC; changes when today's value is replaced |

**Constraints and indexes**:

- Unique `(user_id, entry_date)` named `uq_manual_time_user_date`.
- Check `minutes >= 1 AND minutes <= 1440` named `ck_manual_time_minutes_range`.
- The unique constraint supplies the index needed for parent/date lookup and atomic upsert.

**Lifecycle**:

```text
absent ── first save ──> present(minutes=N)
present(minutes=N) ── later save ──> present(minutes=M)
user hard-deleted ── cascade ──> deleted
```

No append-only session history and no soft delete are introduced. The product UI saves only today's local date, although the contract carries the explicit date to avoid server-timezone ambiguity.

## Modified Entity: `completions`

Existing completion rows remain the source of activity time.

### New field

| Column | Type | Constraints / Meaning |
|---|---|---|
| `completed_on` | DATE | Required after backfill; local calendar date supplied when the completion is created |

### Existing field tightened

| Column | Type | New rule |
|---|---|---|
| `duration_minutes` | INTEGER nullable | When present, 1–1,440 inclusive; required by the service for every self-reported completion and for casual photo completions |

### Index

- Composite index `(completed_by_user_id, completed_on)` named `ix_completions_user_completed_on` supports bounded personal aggregation.

### Time contribution rule

For each completion row:

```text
activity contribution = duration_minutes
                        if duration_minutes is present
                        else activity.estimated_duration_minutes
```

The contribution is grouped by `completed_on`. Status and photo-verification records do not multiply or remove the contribution; deleting the completion removes it naturally from future derived totals.

## Existing Entity: `activities`

No schema change. `estimated_duration_minutes` remains required and is the fallback for historical completions or photo flows where actual duration was optional.

## Existing Entity: `journal_entries`

No schema, lifecycle, migration, or relationship change.

| Relevant field | Continued meaning |
|---|---|
| `user_id` | Parent who recorded the mood |
| `entry_date` | Local mood date |
| `mood` | Mood value only; never interpreted as time |

Journal rows do not join to, seed, or affect time-spent calculations. They remain hard-deleted through the existing user cascade.

## Derived Read Models

These are response/service concepts, not database tables.

### DailyTimeTotal

| Field | Type | Derivation |
|---|---|---|
| `date` | date | Every date in the requested range, including zero days |
| `activity_minutes` | integer ≥ 0 | Sum of completion contributions for current parent/date |
| `manual_minutes` | integer ≥ 0 | Manual row minutes, or 0 when absent |
| `total_minutes` | integer ≥ 0 | `activity_minutes + manual_minutes` |

### WeeklyTimeTotal

| Field | Type | Derivation |
|---|---|---|
| `start_date` | date | Monday or selected month start, whichever is later |
| `end_date` | date | Sunday, selected month end, or current-month anchor, whichever is earlier |
| `total_minutes` | integer ≥ 0 | Sum of DailyTimeTotal values inside the clipped bucket |

### TimeSpentInsight

| Field | Type | Rule |
|---|---|---|
| `period` | `weekly` or `monthly` | Requested view |
| `range_start` | date | Monday for weekly; first of month for monthly |
| `range_end` | date | Sunday for weekly; month end for past months; anchor date for current month |
| `daily_totals` | list of DailyTimeTotal | Chronological, zero-filled |
| `weekly_totals` | list of WeeklyTimeTotal | Empty in weekly view; populated in monthly view |
| `average_weekly_minutes` | integer or null | Null in weekly view; rounded arithmetic mean of monthly weekly bucket totals |

## Relationships

```text
users (1) ─────── (0..*) manual_time_entries
users (1) ─────── (0..*) completions [completed_by_user_id]

activities (1) ── (0..*) challenge_activities
challenge_activities (1) ── (0..*) completions

journal_entries        (retained, independent)
```

The daily insight is computed by combining the two user-scoped streams after activity duration fallback; there is no foreign key between manual entries and completions.

## Validation Rules

1. Manual and reported activity minutes are whole numbers in `[1, 1440]`.
2. `120+` is transmitted and stored as `120`; exact higher values use Custom.
3. Self-reported completion requests require `duration_minutes` and `completed_on`.
4. Photo completion requests require `completed_on`; existing business rules continue to decide when `duration_minutes` is mandatory.
5. Date range generation is bounded to one week or one calendar month per request.
6. The service fills absent dates with zeros; it never creates zero-minute manual rows.
7. Only rows with `completed_by_user_id == current_user.id` and `manual_time_entries.user_id == current_user.id` are aggregated.

## Migration Strategy

One Alembic revision, ordered to avoid invalid intermediate states:

1. Create `manual_time_entries` with UUID PK, user cascade FK, unique and range constraints, and UTC audit timestamps.
2. Add nullable `completions.completed_on`.
3. Backfill every existing completion with the UTC calendar date of `completed_at`. This is a deterministic approximation because historical local timezones were not stored.
4. Alter `completed_on` to non-null.
5. Create `(completed_by_user_id, completed_on)` index.
6. Add the nullable duration range check to `completions` (`duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440`).

The downgrade removes the duration check and index, drops `completed_on`, then drops `manual_time_entries`. It does not touch journal data.

## Query Strategy

The repository performs two bounded aggregates for the authenticated parent and requested range:

1. Completion totals joined through `challenge_activities` to `activities`, grouped by `completed_on`, summing the reported duration or activity estimate.
2. Manual totals from `manual_time_entries`, keyed by `entry_date`.

The service merges both maps into a complete date series and derives monthly buckets. This avoids a Cartesian join between manual entries and completions and keeps the SQL results small.

## Privacy and Erasure

- There is no child ID or child name in the new table or response.
- Endpoints do not accept `user_id`; authorization identity comes from the access token.
- Manual entries cascade immediately when the user is hard-deleted.
- Completion contributions follow the existing completion/family deletion lifecycle.
- Journal retention and erasure behavior are unchanged.
