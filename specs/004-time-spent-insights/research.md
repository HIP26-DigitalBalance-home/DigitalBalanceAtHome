# Research: Time Spent Insights and Journal Phase-Out

**Feature**: `004-time-spent-insights`  
**Date**: 2026-07-05

## 1. API scope: current parent, not family progress

**Decision**: Add `GET /time-spent` and `PUT /time-spent/manual`, both implicitly scoped to the authenticated parent. Keep `GET /families/{familyId}/progress` family-shared and unchanged.

**Rationale**: The existing Progress payload is identical for both parents, while this feature deliberately shows each parent's own time. Embedding personal fields in a family resource would make the response context-dependent and increase the risk of one parent's values leaking to the other. A current-user resource needs no caller-supplied user ID and is private by construction.

**Alternatives considered**:

- Extend `FamilyProgress` with personal data: rejected because one response would mix family and user ownership.
- Add `/users/{userId}/time-spent`: rejected because accepting a user ID creates unnecessary authorization surface.
- Calculate totals entirely on-device: rejected because the client does not own the authoritative completion history and multi-device manual values must stay consistent.

## 2. Stable local dates for activity completions

**Decision**: Add `completions.completed_on` as a required calendar `DATE`. New clients send their local date when creating either a photo or self-reported completion. Existing rows are backfilled from the UTC date of `completed_at`.

**Rationale**: `completed_at` is correctly stored as UTC, but converting it using the device's current timezone at read time can move a completion between days after travel or a timezone change. Persisting the local date at creation matches the existing journal pattern and makes historical charts deterministic. UTC remains the audit timestamp.

**Alternatives considered**:

- Convert `completed_at` using the current device timezone on every request: rejected because history would shift.
- Store an IANA timezone or numeric offset on every completion: more precise, but unnecessary when the product only needs the original local date.
- Backfill from each user's historical timezone: impossible because the project does not currently store that information. UTC date is the only deterministic migration default and will be documented as an approximation for pre-feature rows.

## 3. Aggregation source and fallback order

**Decision**: Derive totals at query time. For every completion attributed to the authenticated parent, use `completion.duration_minutes` when present; otherwise use `activity.estimated_duration_minutes`. Sum each completion once based on `completed_on`, independent of photo status. Add the manual value for the same user/date.

**Rationale**: Completion duration is the best account of actual time, while the activity estimate provides full historical coverage. The existing uniqueness rule on `(family_id, challenge_activity_id)` prevents duplicate completions; querying the completion row directly avoids duplication from verification or photo re-upload records. Proof status determines rewards, not whether intentional time occurred.

**Alternatives considered**:

- Count only verified/photo completions: rejected because self-reported offline time is explicitly in scope.
- Count only completions with reported duration: rejected because historical and dedicated-photo completions would disappear.
- Persist daily aggregates: rejected because the bounded query is small and stored rollups would need complex correction logic when completions are deleted or durations change.

## 4. Manual time storage and replacement

**Decision**: Store one `manual_time_entries` row per `(user_id, entry_date)` and atomically upsert it. A later save for the same date replaces `minutes`; it does not append another session.

**Rationale**: This implements the specification's one daily manual total, prevents double counting from repeat taps or retries, supports correction, and behaves consistently across devices. A database uniqueness constraint plus an atomic upsert handles simultaneous saves safely.

**Alternatives considered**:

- Store multiple sessions: rejected because the requested card captures a daily value and no session history/editor was requested.
- Store manual minutes on the user record: rejected because historical daily data would be lost.
- Reuse `journal_entries`: rejected because mood and time have distinct meaning, retention, and future evolution; the journal must remain dormant and untouched.

## 5. Period and average semantics

**Decision**:

- Weekly view covers Monday–Sunday around `anchor_date` and returns all seven days, zero-filled.
- Monthly view covers the selected calendar month. Past months include every day. For the current month, data and weekly buckets stop at the supplied local-current `anchor_date`, so future weeks do not dilute the average.
- Month buckets are Monday-based, clipped to the month boundary. `average_weekly_minutes` is the sum of displayed bucket totals divided by the number of displayed buckets, rounded to the nearest whole minute.

**Rationale**: Monday weeks match existing project progress behavior. Month-to-date handling makes the average meaningful early in the current month while preserving complete historical months. Clipped boundary weeks ensure days from adjacent months never contaminate the selected month.

**Alternatives considered**:

- Include future zero weeks in the current month's average: rejected because it creates a misleading decline.
- Use rolling 7/30-day windows: rejected because the requested UI is weekly/monthly and existing product language uses calendar periods.
- Return only pre-aggregated chart bars: rejected because daily source values are also useful to initialize today's home card and make contract tests transparent.

## 6. Client-supplied local date

**Decision**: Follow the existing journal convention: the client sends a `YYYY-MM-DD` local date for manual entries and completion creation. The active UI sends only its local today. The backend validates format and duration but does not attempt to infer the user's timezone.

**Rationale**: The user profile has no timezone field, and server UTC date can differ from the parent's date. Adding timezone account management solely for this feature would be disproportionate. The value is not an authorization boundary; it is user-authored tracking data.

**Alternatives considered**:

- Use server UTC date: rejected because evening/morning users in other zones would see entries on the wrong day.
- Add a stored family timezone: rejected because this insight is parent-specific and parents can travel independently.
- Send an offset and convert server-side: rejected because the desired output is already a local date and offsets add no value once the date is known.

## 7. Reusable duration picker

**Decision**: Evolve the existing controlled picker to support a Custom option and an optional horizontal single-row layout. The numeric value remains the only stored state; `120+` stores 120, while exact values above 120 use Custom. No-photo completions always require a value; existing casual photo completions keep their duration requirement and point rule.

**Rationale**: One component keeps validation, accessibility, localization, and option labels consistent across Home and completion flows. A controlled interface lets the card and modal decide when to persist. An explicit save action prevents accidental writes while horizontally scrolling.

**Alternatives considered**:

- Separate card and modal pickers: rejected because behavior and validation would drift.
- Persist immediately on chip tap: rejected because horizontal gestures and exploratory taps could overwrite today's value.
- Treat 120+ as unbounded: rejected because aggregation requires a numeric value; this matches the existing picker convention.

## 8. Journal phase-out boundary

**Decision**: Remove journal rendering, navigation, data fetching, and mood analysis code from active screens only. Keep journal API routes, OpenAPI schemas, model, repository, service, migration, integration tests, client API module, constants, and component source.

**Rationale**: The request is an intentional frontend phase-out, not feature deletion. Retaining the dormant vertical slice avoids data loss and allows later reactivation. Removing active imports prevents unnecessary journal requests while making the user-facing state unambiguous.

**Alternatives considered**:

- Delete journal tables and endpoints: explicitly rejected by the feature requirement.
- Keep the Analyze route hidden behind a deep link: rejected because the journal must not display anywhere in the frontend.
- Reuse mood chart code directly: rejected because importing journal modules into the new insight would couple a live feature to a phased-out one. The visual pattern will be recreated in a neutral time-spent component.

## 9. Validation strategy

**Decision**: Combine pure service tests for period math and zero filling, mocked route tests for contract/auth behavior, migration/SQL validation against Docker PostgreSQL, Schemathesis against the merged OpenAPI spec, client typecheck/lint, and manual visual/accessibility scenarios.

**Rationale**: The current server test suite uses mocked database sessions for route integration tests, while aggregation correctness depends on PostgreSQL joins and constraints. Docker validation covers that gap. The client has no configured component-test framework, so adding a new framework is outside scope; type checks and focused device validation match current practice.

**Alternatives considered**:

- Add a new client test framework in this feature: rejected as unrelated setup overhead.
- Test only through screenshots: rejected because arithmetic and authorization require deterministic server checks.
- Test only repository SQL: rejected because date-boundary and zero-fill logic lives at the service layer.
