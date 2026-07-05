# Feature Specification: Time Spent Insights and Journal Phase-Out

**Feature Branch**: `004-time-spent-insights`

**Created**: 2026-07-05

**Status**: Draft

**Input**: User description: "Add a parent-specific time-spent insight to Progress, support manual time logging from the home hero and duration capture for completions without photos, and remove all journal surfaces from the frontend while preserving the journal capability and data."

## Summary

Parents need a simple view of how much intentional time they spend with their child. The product will combine time from activities completed by the current parent with a manually entered daily amount and visualize the result at the top of Progress. The existing journal is being phased out of the user experience: its home card and mood analysis disappear, while its underlying capability and existing records remain intact for possible future use. The former Activity view becomes a single-purpose History view.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Personal Time Spent Trends (Priority: P1)

A parent opens Progress and immediately sees a time-spent chart showing their own intentional time with their child. They can switch between a weekly view of daily totals and a monthly view grouped by calendar week.

**Why this priority**: The insight is the feature's main user value. It turns existing activity records and new manual input into a meaningful reflection tool without comparing families or parents.

**Independent Test**: Create known activity and manual-time records for one parent, open Progress, and verify that the weekly and monthly chart values match the expected personal totals.

**Acceptance Scenarios**:

1. **Given** the current parent has 30 minutes of completed activity time and 15 manually entered minutes on Monday, **When** they open the current weekly view, **Then** Monday shows 45 minutes.
2. **Given** the current parent has time on several days in a selected week, **When** they view the weekly chart, **Then** the chart shows one value for each day from Monday through Sunday and zero for days without recorded time.
3. **Given** the current parent switches to the monthly view, **When** the chart loads, **Then** it shows the average time per day for each calendar-week portion in the selected month and displays the month's overall average time per day.
4. **Given** two parents belong to the same family, **When** each opens Progress, **Then** each sees only the activity time attributed to them plus their own manual time entries.
5. **Given** a parent selects a past week or month, **When** the period loads, **Then** the chart and period label update to that selected period and future periods cannot be selected.

---

### User Story 2 - Add Non-Activity Time from Home (Priority: P1)

A parent records additional intentional time with their child that was not part of an in-app activity. A compact card in the home hero replaces the journal card and lets the parent set today's manual time using common duration choices or an exact custom number of minutes.

**Why this priority**: Activity completions capture only part of family life. Manual input is necessary for the insight to reflect meaningful time that happens outside curated activities.

**Independent Test**: From the home hero, set today's manual time using a preset and then a custom value; verify that the card retains the latest value and the current-day Progress total updates correctly.

**Acceptance Scenarios**:

1. **Given** a parent is on the home screen, **When** they view the time card, **Then** they see 15, 30, 45, 60, 90, 120+, and Custom choices in one horizontally scrollable row.
2. **Given** no manual time is recorded today, **When** the parent selects 30 minutes and confirms, **Then** today's manual value becomes 30 minutes and today's combined total increases by 30 minutes.
3. **Given** the parent chooses Custom, **When** they enter and confirm a positive whole number of minutes, **Then** that exact value becomes today's manual value.
4. **Given** the parent already recorded manual time today, **When** they choose a different value, **Then** the previous manual value is replaced rather than added again, and the displayed daily total is recalculated.
5. **Given** saving fails, **When** the parent submits a value, **Then** the prior value remains unchanged and the parent receives a clear retryable error message.

---

### User Story 3 - Capture Time for Activities Completed Without a Photo (Priority: P1)

A parent who marks an activity complete without a photo reports how long it took using the same duration choices available elsewhere in the completion experience, including an exact custom duration.

**Why this priority**: Self-reported activities must contribute reliable time data; otherwise the insight systematically undercounts offline time for parents who choose not to upload photos.

**Independent Test**: Complete an activity without a photo, select a duration, and verify that the completion is accepted once and its duration appears in the parent's total for the completion date.

**Acceptance Scenarios**:

1. **Given** a parent selects "complete without photo," **When** the completion form is shown, **Then** it displays 15, 30, 45, 60, 90, 120+, and Custom duration choices.
2. **Given** no duration is selected, **When** the parent attempts to finish the no-photo completion, **Then** submission is blocked with a clear prompt to provide time spent.
3. **Given** the parent confirms a valid duration, **When** the completion succeeds, **Then** the duration contributes exactly once to that parent's total on the completion date.
4. **Given** a completion is later re-uploaded, verified, rejected, or otherwise changes photo status, **When** time is recalculated, **Then** that activity is still counted once and its duration is not duplicated.

---

### User Story 4 - Use a Simplified History Without Journal UI (Priority: P2)

A parent opens their profile and chooses History to see completed activities. The view contains only activity history, without the History/Analyze selector or any mood journal chart. The journal no longer appears on Home or through any other frontend navigation.

**Why this priority**: Removing the phased-out journal keeps the product focused and frees the home hero for time logging while preserving useful completion history.

**Independent Test**: Navigate through Home, Profile, History, and Progress; verify that History remains available as a single list and that no journal card, mood input, mood chart, Analyze tab, or journal link is visible.

**Acceptance Scenarios**:

1. **Given** a parent opens Profile, **When** they inspect the navigation actions, **Then** the former Activity action is labeled History.
2. **Given** a parent opens History, **When** the view loads, **Then** its title is History and it immediately shows activity completion history without a menu selector.
3. **Given** a parent visits Home, History, Profile, and Progress, **When** all views finish loading, **Then** no journal or mood check-in interface is displayed.
4. **Given** journal records existed before this release, **When** the release is applied, **Then** those records and the dormant journal capability remain intact and are not deleted or migrated into time-spent data.

### Edge Cases

- A day has manual time but no completed activities: the daily total equals the manual value.
- A day has completed activities but no manual time: the daily total equals the sum of activity durations.
- A completed activity has no reported duration because it predates this feature or followed a flow where duration was optional: its configured estimated duration is used as the fallback.
- A completion has both a reported duration and an estimated duration: only the reported duration is counted.
- The same family activity can be completed only once: its time is attributed to the parent recorded as having completed it and is not shown as activity time for the other parent.
- A completion crosses midnight or the parent travels: it belongs to the parent's local calendar date at the time it was completed; later timezone changes do not move the historical record.
- A selected week or month has no time data: the chart remains visible with zero values and a positive empty-state message.
- The selected month starts or ends midweek: only days within that month contribute to each displayed weekly bucket.
- A custom duration is empty, fractional, zero, negative, or greater than 1,440 minutes: it is rejected with a clear validation message.
- Selecting 120+ records 120 minutes for aggregation; parents who want to record a larger exact amount use Custom.
- Existing journal links or deep links are opened: they do not expose journal UI and lead to the simplified History view or the nearest relevant available view.

## Requirements *(mandatory)*

### Functional Requirements

**Time Aggregation and Insight**

- **FR-001**: The system MUST calculate daily time spent separately for each authenticated parent.
- **FR-002**: A parent's daily total MUST equal the sum of (a) the durations of activities attributed to that parent and completed on that local calendar date and (b) that parent's manual value for that date.
- **FR-003**: For each activity completion, the system MUST use its parent-reported duration when present; otherwise it MUST use the activity's configured estimated duration.
- **FR-004**: Each activity completion MUST contribute at most once to time spent, regardless of photo-processing, verification, rejection, or re-upload state.
- **FR-005**: The time-spent insight MUST appear as the first content section at the top of Progress.
- **FR-006**: The insight MUST provide a clearly labeled selector for Weekly and Monthly views.
- **FR-007**: Weekly view MUST show seven daily totals for the selected Monday-through-Sunday period.
- **FR-008**: Monthly view MUST group the selected month's daily totals into calendar-week buckets, show each bucket's average time per day (bucket total divided by the bucket's in-month, elapsed day count), and show the month's overall average time per day (sum of bucket totals divided by the in-month, elapsed day count of the displayed range).
- **FR-009**: Parents MUST be able to navigate to earlier weekly or monthly periods and back toward the current period, but MUST NOT navigate into a future period.
- **FR-010**: The chart MUST identify its selected date range, use minutes as its underlying unit, present longer totals in a readable hours-and-minutes format, and expose values through accessible labels rather than color alone.
- **FR-011**: Days or weekly buckets without recorded time MUST be represented as zero rather than omitted.

**Manual Time Entry**

- **FR-012**: The home hero MUST contain a time-spent input card in the space created by removing the journal card.
- **FR-013**: The card MUST offer 15, 30, 45, 60, 90, 120+, and Custom in a single horizontally scrollable row.
- **FR-014**: Selecting a preset MUST prepare that number of minutes; the 120+ preset MUST store 120 minutes.
- **FR-015**: Selecting Custom MUST allow entry of a positive whole number from 1 through 1,440 minutes.
- **FR-016**: Each parent MUST have at most one manual time value per local calendar date, and saving a new value for today MUST replace the prior value for today.
- **FR-017**: The card MUST show the parent's currently saved manual value for today and provide a clear confirmation that a changed value was saved.
- **FR-018**: A successful manual-time change MUST be reflected in the current daily total without requiring the parent to restart the app.
- **FR-019**: A failed or invalid submission MUST leave the previously saved value unchanged and communicate how the parent can correct or retry it.

**Activity Completion Duration**

- **FR-020**: The no-photo activity completion path MUST display the same duration choices listed in FR-013.
- **FR-021**: A valid duration MUST be required before a no-photo activity completion can be submitted.
- **FR-022**: A no-photo completion's selected duration MUST be saved as its reported duration and attributed to the parent who completes it.
- **FR-023**: Existing photo-completion duration behavior MUST remain available, and every photo-completion flow that displays a duration picker MUST include the same choices listed in FR-013; this feature MUST NOT change whether a photo completion earns points or how its proof is evaluated.

**Journal Phase-Out and History Simplification**

- **FR-024**: The frontend MUST NOT display the journal card, mood input, mood history chart, Analyze tab, or any other journal entry point.
- **FR-025**: The Profile action formerly labeled Activity MUST be relabeled History in all supported languages.
- **FR-026**: The former Activity view MUST be presented as History and MUST display only the activity completion list, without a History/Analyze selector.
- **FR-027**: Existing journal records and the dormant journal capability MUST remain intact; this release MUST NOT delete journal data or repurpose it as time-spent data.
- **FR-028**: Project documentation MUST state that journal logic and existing data remain in place but the journal is intentionally phased out of the frontend.
- **FR-029**: Time-spent information MUST remain private to the authenticated parent and MUST NOT appear in group feeds, family comparisons, rankings, or leaderboards.

### Key Entities

- **Daily Manual Time**: One parent-entered number of minutes for a parent and local calendar date. It can be replaced for the current date and is separate from activity completions.
- **Daily Time Spent**: A derived personal total for a parent and date, combining that parent's manual time and attributed activity durations.
- **Time Insight Period**: A derived weekly or monthly series of daily totals, including the selected date range and, for monthly view, weekly bucket totals from which per-day averages are displayed.
- **Activity Completion** *(existing, extended use)*: Records the completing parent, completion time, and optional reported duration. A reported duration takes precedence over the activity estimate.
- **Activity** *(existing)*: Supplies the estimated duration used when a completion has no reported duration.
- **Journal Record** *(existing, retained)*: A parent's historical mood entry. It remains stored but has no user-facing surface in this release and does not contribute to time-spent calculations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a test dataset spanning at least 30 days, every displayed daily total, weekly per-day average, and monthly per-day average matches the defined calculation exactly.
- **SC-002**: At least 90% of usability-test participants can identify how much time they spent on a specified day and whether their recent time is increasing or decreasing without assistance.
- **SC-003**: A parent can save a preset manual duration from Home in no more than 2 intentional taps and under 10 seconds; a custom duration can be saved in under 30 seconds.
- **SC-004**: A saved manual-time change or newly completed activity appears in the relevant current-period chart within 5 seconds when the device is online.
- **SC-005**: Progress displays the complete time-spent section within 2 seconds on a standard mobile connection for a parent with one year of time history.
- **SC-006**: Every no-photo activity completion submitted after release contains a valid duration, and no such completion contributes more than once to the time insight.
- **SC-007**: Across Home, Profile, History, and Progress, zero journal or mood controls are visible, while 100% of pre-existing journal records remain intact after release validation.
- **SC-008**: A parent reaches the renamed History list from Profile in one navigation action and sees no intermediate selector.
- **SC-009**: No time-spent value is exposed to another parent, another family, or a group-visible surface during privacy and access testing.

## Constraints

- The feature is reflective and positively framed; it MUST NOT introduce targets, warnings about being behind, parent-to-parent comparisons, or family rankings.
- Time spent is a personal parent insight, even though activity completions and challenges otherwise belong to the family domain.
- Journal removal is presentation-only. Journal records, collection rules, and dormant capability remain available for possible future reactivation.
- Mood and time are separate concepts. Existing mood data MUST NOT be converted into, merged with, or used to infer time spent.
- Activity proof and reward eligibility remain independent from time aggregation; time may count even when a completion has no photo or its photo is awaiting review.

## Assumptions

- The phrase "user's daily time spent" means the current authenticated parent's personal time, not a shared family total. Activity time is assigned using the parent recorded on the completion.
- The home card records today's manual total rather than an unlimited set of sessions. Re-selecting a duration corrects or replaces today's manual amount and prevents accidental double counting.
- Historical activity completions without a reported duration use the activity estimate so the insight can cover existing data.
- Weekly periods run Monday through Sunday, consistent with the project's existing progress calendar.
- Monthly view uses calendar-week buckets within the selected month and displays each bucket's average time per day plus the month's overall average per day. Partial boundary weeks include only dates inside the selected month, so their averages divide by the days actually in the bucket.
- Local dates are fixed when records are created so travel or later timezone changes do not move historical time between days.
- Manual entry for earlier dates and editing activity durations after completion are outside this feature's scope.
- Existing supported languages continue to receive equivalent History and time-spent labels.

## Dependencies

- Activity completions must continue to identify the parent who completed them and their completion date.
- Activities must retain their configured estimated durations for fallback calculations.
- The existing Progress view and mood-chart visual language provide the interaction pattern for period navigation and bar presentation, even though mood journal UI is removed.
- The existing History list remains the source of the simplified History experience.

## Out of Scope

- Deleting journal data or removing the dormant journal capability.
- Migrating journal mood records into the new time-spent insight.
- Manual time entry for past or future dates.
- Shared family, child-specific, group-level, or cross-family time analytics.
- Time goals, streaks based on minutes, reminders, badges, or rewards based on time spent.
- Changes to photo verification, point calculation, or social-sharing rules.
