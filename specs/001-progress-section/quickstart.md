# Quickstart Validation Guide: Progress Section

**Date**: 2026-06-28

Use this guide to validate that the progress section works end-to-end after implementation. Scenarios are ordered by priority; each can be run independently.

---

## Prerequisites

- Docker Compose running (`docker compose up`)
- App seeded with at least one family and one active challenge (`POST /dev/seed`)
- A test parent account authenticated (grab a JWT from `/auth/google` or the dev seed)
- `familyId` known from seed output

---

## Scenario 1 — Home screen shows streak and ring (P1)

**Goal**: Verify the home screen widget renders after a completion.

1. Open the app as a seeded parent. Confirm the home screen loads.
2. Complete one activity (take a photo or self-report).
3. Without navigating away, verify:
   - The goal ring updates to show `1 / N` (where N is the weekly goal set during onboarding).
   - The streak counter shows `1` (first week with activity).

**API check**:
```
GET /families/{familyId}/progress
```
Expected response:
```json
{
  "weekly_goal": 2,
  "this_week": { "activities": 1, "photos": 1 },
  "streak": { "current_weeks": 1, "last_weeks": null, "longest_weeks": 1, "frozen_this_week": false },
  "all_time": { "activities": 1, "photos": 1, "challenges": 1 }
}
```

---

## Scenario 2 — Progress page shows all three sections (P2)

**Goal**: Verify the full dashboard renders correctly.

1. Complete 2 activities in the same week.
2. Navigate to the progress page (from profile or dedicated tab).
3. Verify:
   - **This Week**: ring shows `2/N`, "2 activities", "2 photos" (if both had photos).
   - **Your Streak**: shows `1 week` prominently; "longest: 1 week" alongside.
   - **All Time**: shows `2 activities`, `2 photos`, `1 challenge`.

---

## Scenario 3 — Both parents see the same numbers (P1)

**Goal**: Verify family-shared state.

1. Log in as Parent A. Complete one activity. Note streak = 1 and ring = 1/N.
2. Log in as Parent B (same family). Open the home screen.
3. Verify Parent B sees streak = 1 and ring = 1/N without doing anything.

---

## Scenario 4 — Weekly goal set during onboarding (P2)

**Goal**: Verify onboarding goal step and its effect on the ring.

1. Create a fresh account (no family).
2. Complete onboarding. At the goal-setting step, select `3`.
3. Open the home screen. Verify the ring shows `0/3`.
4. Complete one activity. Verify ring shows `1/3`.

**API check**:
```
GET /families/{familyId}/progress
```
Expected: `"weekly_goal": 3`

**Change goal**:
```
PATCH /families/{familyId}/settings
{ "weekly_goal": 1 }
```
Expected: `204 No Content`. Ring immediately shows `1/1` (complete).

---

## Scenario 5 — Automatic streak freeze on Sunday evening (P3)

**Goal**: Verify freeze is applied and streak is preserved.

*Note: Trigger the Sunday freeze job manually via a test endpoint or by calling the service directly in a test.*

1. Set a family to have `streak_weeks = 3`, `last_activity_iso_week = "<last week>"`, `last_frozen_iso_week = NULL`.
2. Trigger the Sunday freeze job for the current week (no activity this week).
3. Verify:
   - `GET /families/{familyId}/progress` returns `streak.current_weeks = 3` and `streak.frozen_this_week = true`.
   - Home screen still shows `3`.

---

## Scenario 6 — Consecutive frozen weeks cause reset (P3)

**Goal**: Verify the two-consecutive-freeze cap.

1. Set a family to have `streak_weeks = 3`, `last_frozen_iso_week = "<last week>"`, `last_activity_iso_week = "<two weeks ago>"`.
2. Trigger the Sunday freeze job (no activity this week, last week was already frozen).
3. Verify:
   - `streak.current_weeks = 0`
   - `streak.last_weeks = 3`
   - `streak.frozen_this_week = false`
   - Home screen shows `0` and "last streak: 3 weeks" beneath it.

---

## Scenario 7 — Late completion voids freeze (P3)

**Goal**: Verify that completing an activity after a freeze is applied clears the freeze.

1. Trigger the Sunday freeze job (family has no activity this week, prev week not frozen) → freeze applied.
2. Before midnight, complete one activity.
3. Verify:
   - `streak.frozen_this_week = false`
   - `streak.current_weeks` has incremented correctly.

---

## Regression checks

After implementing, verify these existing behaviours are unaffected:

- `GET /families/{familyId}` still returns family data without progress fields leaking into it.
- Completing an activity still updates the collage on the home screen.
- Onboarding still completes without the goal step breaking the redirect flow.
