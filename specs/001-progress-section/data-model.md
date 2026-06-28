# Data Model: Progress Section

**Date**: 2026-06-28

---

## Extend `families` table

Six new columns added to the existing `Family` ORM model (`server/app/models/family.py`):

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `weekly_goal` | Integer | No | `2` | Family's self-set weekly activity target |
| `streak_weeks` | Integer | No | `0` | Current consecutive-week streak count |
| `last_streak_weeks` | Integer | Yes | `NULL` | Previous streak, shown as "last streak: X weeks" after a reset |
| `longest_streak_weeks` | Integer | No | `0` | All-time highest streak achieved |
| `last_activity_iso_week` | Varchar(10) | Yes | `NULL` | ISO week string of the last week with ≥1 completion (e.g. `"2026-W26"`) |
| `last_frozen_iso_week` | Varchar(10) | Yes | `NULL` | ISO week string of the most recently auto-frozen week |

**Invariants**:
- `streak_weeks >= 0` always
- `longest_streak_weeks >= streak_weeks` always
- `last_frozen_iso_week` is always a different week from `last_activity_iso_week` (a week cannot be both active and frozen)
- No two consecutive weeks may both equal `last_frozen_iso_week` — enforced by the freeze job logic

---

## Computed stats (query-time, not stored)

These are derived on every `GET /families/{id}/progress` request from the `completions` table. No new columns.

| Stat | Source query |
|---|---|
| `this_week.activities` | `COUNT(*)` on `completions` where `family_id = ?` and `completed_at >= monday_00:00 UTC` |
| `this_week.photos` | Same filter + `photo_key IS NOT NULL` |
| `all_time.activities` | `COUNT(*)` on `completions` where `family_id = ?` |
| `all_time.photos` | Same + `photo_key IS NOT NULL` |
| `all_time.challenges` | `COUNT(DISTINCT challenge_id)` via `completions → challenge_activities → challenges` |

---

## Streak state machine

```
streak_weeks = 0
    │
    │  first completion in any week
    ▼
streak_weeks = 1, last_activity_iso_week = W
    │
    │  completion in W+1 (or freeze covered W+1 gap)
    ▼
streak_weeks++, last_activity_iso_week = W+1
    │
    ├── [Sunday eve, no activity this week, prev week NOT frozen]
    │     → last_frozen_iso_week = current_week   (streak preserved)
    │
    └── [Sunday eve, no activity this week, prev week WAS frozen]
          → last_streak_weeks = streak_weeks
            streak_weeks = 0
            last_frozen_iso_week = NULL
```

---

## API response shapes

### `GET /families/{familyId}/progress` → `FamilyProgress`

```json
{
  "weekly_goal": 2,
  "this_week": {
    "activities": 1,
    "photos": 1
  },
  "streak": {
    "current_weeks": 4,
    "last_weeks": null,
    "longest_weeks": 6,
    "frozen_this_week": false
  },
  "all_time": {
    "activities": 27,
    "photos": 24,
    "challenges": 5
  }
}
```

### `PATCH /families/{familyId}/settings` request body → `FamilySettingsUpdate`

```json
{
  "weekly_goal": 3
}
```

Response: `204 No Content`

---

## Streak update on completion (service-layer logic)

Triggered inside `completion.py` service, after a new `Completion` row is flushed, within the same transaction:

```
current_week = iso_week(now_utc)

if family.last_activity_iso_week == current_week:
    # Already counted this week — no streak change
    return

prev_week = previous_iso_week(current_week)
bridged = (family.last_frozen_iso_week == current_week)
  # freeze was applied this week but family completed anyway → void it

consecutive = (
    family.last_activity_iso_week == prev_week
    or family.last_frozen_iso_week == prev_week
)

if consecutive:
    family.streak_weeks += 1
    if bridged:
        family.last_frozen_iso_week = None  # void the freeze
else:
    # Gap not covered by freeze — start over
    family.last_streak_weeks = family.streak_weeks
    family.streak_weeks = 1

family.last_activity_iso_week = current_week
family.longest_streak_weeks = max(family.longest_streak_weeks, family.streak_weeks)
```

The family row is locked with `SELECT … FOR UPDATE` before this logic to serialise concurrent completions by two parents.
