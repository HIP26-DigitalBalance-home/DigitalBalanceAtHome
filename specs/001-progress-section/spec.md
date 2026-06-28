# Feature Specification: Progress Section

**Feature Branch**: `001-progress-section`

**Created**: 2026-06-28

**Status**: Draft

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Home screen progress snapshot (Priority: P1)

A parent opens the app and immediately sees, on the home screen, two elements: their current streak (how many consecutive weeks the family has completed at least one activity) and a ring indicator showing this week's progress toward their weekly goal. Both parents in the family see and share the same numbers, since completions belong to the family.

**Why this priority**: The home screen is the daily entry point. A glanceable snapshot here is the core motivation mechanic — it makes families want to keep going without navigating anywhere else.

**Independent Test**: Open the app as an authenticated parent, complete at least one activity, and verify that the streak counter and goal ring appear on the home screen with correct values.

**Acceptance Scenarios**:

1. **Given** a family has completed 1 activity this week and their goal is 2, **When** a parent opens the home screen, **Then** the goal ring shows 1 of 2 (half filled) and the streak counter shows the current consecutive-week count.
2. **Given** both parents are logged in to the same family, **When** either parent completes an activity, **Then** both parents see the updated ring and streak on their respective home screens.
3. **Given** the family has no completed activities this week, **When** a parent opens the home screen, **Then** the ring shows empty and the streak counter reflects the current state (active streak, frozen, or 0).

---

### User Story 2 — Full progress dashboard (Priority: P2)

A parent navigates to the progress page and sees a structured breakdown of their family's activity history across three sections: this week, their running streak, and lifetime totals.

**Why this priority**: The progress page provides the full picture that motivates continued engagement — it's for parents who want to reflect on what they've built together, not just see the daily glance.

**Independent Test**: Navigate to the progress page and verify all three sections render with values that accurately reflect the family's activity history.

**Acceptance Scenarios**:

1. **Given** a family has completed 3 activities and taken 3 photos this week, **When** a parent opens the progress page, **Then** the "This Week" section shows the ring at 3/N, "3 activities", and "3 photos".
2. **Given** a family has a current streak of 4 weeks and their all-time longest streak was 6 weeks, **When** a parent views "Your Streak", **Then** "4 weeks" is shown prominently and "longest: 6 weeks" appears alongside it.
3. **Given** a family has completed 27 activities across all challenges, **When** a parent views "All Time", **Then** the counter shows 27 activities, plus their total photos taken and total challenges completed.

---

### User Story 3 — Weekly goal setup during onboarding (Priority: P2)

During onboarding, a family sets a single weekly activity target. This goal is shared by both parents and becomes the reference value for the goal ring on the home screen and progress page.

**Why this priority**: The goal ring is meaningless without a target. Onboarding is the natural moment to set it — it gives parents immediate ownership of their commitment before they've even done anything.

**Independent Test**: Complete onboarding and verify that the weekly target chosen matches the denominator shown in the goal ring on the home screen.

**Acceptance Scenarios**:

1. **Given** a parent is in the onboarding flow, **When** they reach the goal-setting step, **Then** they are shown a simple selection to choose a weekly activity count.
2. **Given** a goal of 2 was set during onboarding, **When** either parent views the home screen or progress page, **Then** the goal ring shows X of 2.
3. **Given** the weekly goal was set by one parent during onboarding, **When** the second parent logs in, **Then** they see the same goal.

---

### User Story 4 — Automatic streak freeze (Priority: P3)

When Sunday evening arrives and the family has not completed any activity that week, the system automatically applies a freeze — provided the previous week was not also frozen. The streak is preserved exactly as it was: neither incremented nor reset. If the previous week was already frozen (making this the second consecutive empty week), no freeze is applied and the streak resets to 0.

**Why this priority**: The freeze reduces the emotional cost of a single missed week with zero effort from the family. The two-consecutive-freeze cap prevents the mechanic from making the streak meaningless.

**Independent Test**: Simulate a week with no activity where the previous week was active, advance to Sunday evening, and verify the streak count is unchanged on Monday.

**Acceptance Scenarios**:

1. **Given** a family has a 3-week streak and logs no activity this week, and the previous week was not frozen, **When** Sunday evening arrives, **Then** a freeze is applied automatically and the streak remains 3 weeks on Monday.
2. **Given** a family had a freeze applied last week and logs no activity this week, **When** Sunday evening arrives, **Then** no freeze is applied, the streak resets to 0, and "last streak: 3 weeks" appears beneath the counter.
3. **Given** a freeze has been auto-applied on Sunday evening, **When** a parent completes an activity before midnight Sunday, **Then** the freeze is voided and the week counts normally toward the streak increment.
4. **Given** a family's streak has just been reset to 0, **When** they complete an activity the following week, **Then** a new streak of 1 week begins and "last streak" continues to show the previous count.

---

### Edge Cases

- Family has never completed any activity: all counters show 0, streak shows 0, ring is empty.
- Weekly goal is reached mid-week: ring shows complete; further completions in the same week do not overflow or break the display.
- Family is in multiple groups across different challenge periods: completions from any challenge count toward streak and goal ring.
- Timezone boundary for Monday reset: device local timezone of the first parent to set up the family account; does not shift if a parent travels.
- Weekly goal changed after onboarding: streak and historical totals are unaffected; the new goal applies from the current week onward.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The home screen MUST display the family's current streak as a numeric counter (unit: consecutive weeks with ≥1 completed activity).
- **FR-002**: The home screen MUST display a goal ring showing activities completed this week versus the family's weekly goal.
- **FR-003**: Both parents in a family MUST see identical streak and ring values; a completion by either parent updates both views.
- **FR-004**: The progress page MUST contain a "This Week" section with: the goal ring, count of activities completed this week, count of photos taken this week.
- **FR-005**: The progress page MUST contain a "Your Streak" section showing the current streak prominently and the all-time longest streak alongside it.
- **FR-006**: The progress page MUST contain an "All Time" section showing: total activities completed, total photos taken, total challenges participated in.
- **FR-007**: During onboarding, a family MUST be able to set a weekly activity goal (a positive integer ≥ 1).
- **FR-008**: The weekly goal MUST be shared by both parents in the family and editable from settings after onboarding.
- **FR-009**: On Sunday evening, the system MUST automatically apply a freeze to any family that has no completed activity that week AND whose previous week was not also frozen.
- **FR-010**: Two consecutive weeks without activity MUST NOT both be frozen; the second empty week always resets the streak.
- **FR-011**: A frozen week MUST leave the streak count unchanged (not incremented, not reset).
- **FR-012**: If a family completes an activity on the same Sunday evening after an automatic freeze has been applied, the freeze MUST be voided and the week counts normally toward the streak increment.
- **FR-013**: When a week ends without a freeze and with no completed activity, the streak MUST reset to 0 and the previous streak value MUST be shown as "last streak: X weeks" beneath the counter.
- **FR-014**: The streak unit is a calendar week (Monday–Sunday); the streak increments by 1 when the family completes at least one activity during that week.

### Key Entities

- **FamilyProgress**: Aggregate engagement record per family — current streak, last streak, longest streak, all-time activity/photo/challenge totals, freeze state for the current week.
- **WeeklyGoal**: The family's self-set target for activities per calendar week. Shared by both parents; set during onboarding; editable from settings.
- **StreakFreeze**: An automatic protection applied by the system on Sunday evening when a family has no completed activity that week and the previous week was not also frozen. Prevents the streak from resetting. Voided if the family completes an activity before the week ends.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A parent can see current streak and weekly goal progress without leaving the home screen.
- **SC-002**: The progress page loads all three sections with accurate data in under 2 seconds on a standard mobile connection.
- **SC-003**: After either parent completes an activity, both parents see the updated ring and streak within 5 seconds without manually refreshing.
- **SC-004**: The weekly goal is set during onboarding in a single step with no more than 2 taps.
- **SC-005**: No family-to-family comparison data appears anywhere in this feature — all numbers are private to the family.

---

## Assumptions

- Any completed activity — regardless of which group challenge it belongs to — counts toward the weekly streak and goal ring.
- The calendar week begins Monday and resets at midnight in the device's local timezone of the first parent who set up the family account.
- "Challenges participated in" (All Time) counts any challenge where the family completed at least one activity — not only fully completed collages.
- The progress section is accessible from the family profile or a dedicated tab; exact navigation placement is a UI decision out of scope for this spec.
- No group-average or cross-family comparison data is shown anywhere in this feature.
