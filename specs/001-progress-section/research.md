# Research: Progress Section

**Date**: 2026-06-28

---

## Decision 1: Where to store streak state

**Decision**: Six new columns directly on the `families` table — no separate table.

**Rationale**: Streak state (`streak_weeks`, `last_streak_weeks`, `longest_streak_weeks`, `last_activity_iso_week`, `last_frozen_iso_week`, `weekly_goal`) is one record per family. A join table would add complexity with no benefit at this scale.

**Alternatives considered**: A separate `family_progress` table — rejected because it's a 1-to-1 relationship with no querying advantage and adds a join on every request.

---

## Decision 2: ISO week format for streak tracking

**Decision**: Store week identifiers as `"YYYY-WNN"` strings (e.g. `"2026-W26"`), derived from Python's `datetime.isocalendar()`.

**Rationale**: ISO week strings are human-readable, timezone-safe when computed in UTC, easy to compare as strings (lexicographic order matches chronological order within the same year), and avoid off-by-one errors that arise from comparing raw dates across midnight boundaries.

**How to compute**:
```python
from datetime import datetime, timezone

def current_iso_week() -> str:
    iso = datetime.now(timezone.utc).isocalendar()
    return f"{iso.year}-W{iso.week:02d}"

def previous_iso_week(week_str: str) -> str:
    # Parse and subtract 7 days
    from datetime import timedelta
    year, w = week_str.split("-W")
    monday = datetime.strptime(f"{year}-W{w}-1", "%G-W%V-%u")
    prev = monday - timedelta(weeks=1)
    iso = prev.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"
```

**Alternatives considered**: Storing the Monday date of each week as a `DATE` column — rejected because ISO week year can differ from calendar year in late December/early January, causing subtle bugs.

---

## Decision 3: Streak update timing

**Decision**: Streak is updated eagerly at completion creation time (inside `completion.py` service, same transaction). The Sunday job only handles the freeze/reset for families that have not completed anything.

**Rationale**: Updating at completion time means the home screen always reflects the correct streak immediately after a completion. The Sunday job is a safety net for inactivity, not the primary updater.

**Race condition safety**: Both parents can complete activities concurrently. The streak update uses `SELECT … FOR UPDATE` on the family row to serialise concurrent writes. Since `last_activity_iso_week` is checked before incrementing, only the first completion in a new week triggers a streak increment — subsequent completions in the same week are no-ops for streak purposes.

**Alternatives considered**: Computing streak entirely from completions at query time — rejected because the freeze state (which week was frozen) cannot be reliably reconstructed from completion history alone.

---

## Decision 4: Sunday freeze background job

**Decision**: Asyncio background task started in the FastAPI lifespan, runs every Sunday at 21:00 UTC. Uses the same pattern as the auto-approval job planned for the rewards system.

**Rationale**: Consistent with existing project patterns. Simple to reason about. At prototype scale, running on-process is sufficient.

**Freeze logic per family**:
1. If `last_activity_iso_week == current_iso_week`: family was active this week — no action.
2. If `last_activity_iso_week != current_iso_week` AND `last_frozen_iso_week != previous_iso_week`: apply freeze — set `last_frozen_iso_week = current_iso_week`.
3. If `last_activity_iso_week != current_iso_week` AND `last_frozen_iso_week == previous_iso_week`: two consecutive empty weeks — reset streak: `last_streak_weeks = streak_weeks`, `streak_weeks = 0`, `last_frozen_iso_week = None`.

**Freeze void on late completion**: If a family completes an activity after the freeze is applied but before midnight Sunday, the completion service detects `last_frozen_iso_week == current_iso_week` and clears it, then processes the streak update normally.

**Alternatives considered**: k8s CronJob — deferred to production; asyncio task is sufficient for prototype.

---

## Decision 5: Goal ring component

**Decision**: Custom SVG ring using `react-native-svg` (already available in Expo managed workflow via `expo-modules`). A thin arc from 0° to `(progress / goal) * 360°`.

**Rationale**: No additional package needed. Simple to implement; a filled arc with a background track is ~30 lines of SVG.

**Alternatives considered**: `react-native-progress` library — adds a dependency; overkill for one component.

---

## Decision 6: Stats computed at query time vs. denormalised counters

**Decision**: Compute `this_week_activities`, `this_week_photos`, `all_time_activities`, `all_time_photos`, `all_time_challenges` at query time from `completions`.

**Rationale**: At prototype scale (tens of completions per family), a single aggregated query is fast. Avoids consistency issues from maintaining counters. Streak state (which needs historical week tracking) is the only thing that must be stored — pure counts don't need it.

**Alternatives considered**: Storing counters as columns — rejected to avoid dual-write consistency bugs.
