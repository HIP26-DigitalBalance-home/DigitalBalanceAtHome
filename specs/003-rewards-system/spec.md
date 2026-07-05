# Feature Specification: Family Points & Reward Levels (Demo Scope)

**Feature Branch**: `003-rewards-system`

**Created**: 2026-06-28

**Revised**: 2026-07-04 — Rev 2. Realigned with `docs/business-model.md` and `docs/reward-point-system.md` (BOND points system). Scoped for a ~3-day demo build that can evolve into the full planned program. See [Deprecated from Rev 1](#deprecated-from-rev-1) for what was removed and why.

**Status**: Draft

---

## Summary

Families earn points for photo-verified activity completions according to a **fixed tier system** (3 pts casual with a 30-minute gate, 6 pts dedicated, 15 pts marketplace, +5 pts community-challenge bonus). Points accumulate on a **single family-level balance per calendar quarter** (no carryover) and unlock **four fixed reward levels** (50/100/150/250 pts) — a milestone ladder, not a spend-down shop. Photo trust is provided by the `pending_verification → verified | rejected` status machine with a group-admin review queue and a policy abstraction that later admits AI validation.

Out of scope (business-plan features explicitly deferred): marketplace booking/payments, real reward fulfillment and voucher inventory, AI photo validation, automated quarter-reset jobs, institutional licensing concerns.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Family Sees Completion Verification Status in the Collage (Priority: P1)

A parent can see the verification state of each completion slot in the collage, understand why a photo was rejected, and re-upload a corrected photo.

**Why this priority**: The collage is the primary UI surface for completions, and the status machine is the foundation every point-earning flow builds on. Nothing else in this feature works without it.

**Independent Test**: Submit a photo, view it in the collage with a pending badge, have an admin reject it with a reason, verify the rejected visual state and reason display, and re-upload successfully.

**Acceptance Scenarios**:

1. **Given** a completion in `pending_verification`, **When** the family views the collage, **Then** the slot shows the photo with a clock/pending indicator.
2. **Given** a completion in `verified`, **Then** the slot shows the photo with a green checkmark badge.
3. **Given** a completion in `rejected`, **Then** the slot shows the photo with a red/warning indicator; tapping it reveals the rejection reason and a re-upload action.
4. **Given** the family completes photo upload, **When** the upload pipeline finishes, **Then** the client resolves polling for any status other than `processing` (including `pending_verification`, `verified`, and `rejected`).

---

### User Story 2 — Admin Reviews and Verifies Completion Photos (Priority: P1)

A group admin reviews photos submitted by families for their group's challenge completions. They approve genuine photos (triggering the point award) or reject photos that do not demonstrate the activity (providing a reason the family can see).

**Why this priority**: Human verification is the trust mechanism that underpins point earning. The business plan targets AI validation; the manual queue is its demo-stage stand-in behind the same policy abstraction.

**Independent Test**: Submit a photo completion as a family in a group challenge, then log in as the group admin, approve or reject it, and verify the family's point balance changes accordingly.

**Acceptance Scenarios**:

1. **Given** a family has uploaded a completion photo in a group's challenge, **When** the admin opens the verification queue, **Then** they see the pending completion with family name (no child names), activity title, photo, submitted duration, and submission date.
2. **Given** the admin approves a photo, **Then** the completion status changes to `verified`, the applicable points are credited to the family's ledger, and an audit record is created.
3. **Given** the admin rejects a photo and enters a rejection reason, **Then** the completion status changes to `rejected`, no points are awarded, and the rejection reason is stored and visible to the family.
4. **Given** a `verified` completion exists, **When** the family re-uploads a photo, **Then** only the photo is updated; the status remains `verified` and no points change.
5. **Given** a `rejected` completion exists, **When** the family re-uploads a photo, **Then** the status resets to `pending_verification` and the rejection reason is cleared.
6. **Given** a completion in a personal/family challenge (no group, hence no admin), **When** it has been in `pending_verification` for at least the system auto-approval window, **Then** it is automatically approved by the background sweep and points are credited (`policy_type = "timed"`).

---

### User Story 3 — Family Earns Points by Fixed Activity Tiers (Priority: P1)

A parent completes an activity with photo proof and, on verification, the family earns points determined by the activity's tier: 3 pts for casual/free activities (only if the reported duration is ≥ 30 minutes), 6 pts for dedicated activities, 15 pts for marketplace (paid/partner) activities, plus a +5 pt bonus when the challenge is a featured community challenge.

**Why this priority**: Point earning is the core loop of the business model. Fixed tiers replace all admin point configuration from Rev 1.

**Independent Test**: Complete one activity of each tier (casual ≥ 30 min, casual < 30 min, dedicated, marketplace, and one inside a featured challenge), verify each, and confirm the ledger shows 3 / 0 / 6 / 15 / base+5 points respectively.

**Acceptance Scenarios**:

1. **Given** a casual-tier activity, **When** the parent uploads photo proof, **Then** they must select a duration from a dropdown before the upload is accepted.
2. **Given** a casual-tier completion with duration ≥ 30 minutes is verified, **Then** the family's ledger is credited 3 points.
3. **Given** a casual-tier completion with duration < 30 minutes is verified, **Then** the completion still fills its collage slot but earns 0 points, and the UI communicates why.
4. **Given** a dedicated-tier completion is verified, **Then** the family's ledger is credited 6 points (no duration condition).
5. **Given** a marketplace-tier completion (activity with `cost_indicator = "paid"` or `is_partner_content = true`) is verified, **Then** the family's ledger is credited 15 points.
6. **Given** a verified completion whose challenge is flagged as a featured community challenge, **Then** +5 points are added on top of the base tier points.
7. **Given** a `self_reported` completion (no photo), **Then** it fills its collage slot but never earns points.

---

### User Story 4 — Family Views Quarter Balance, Level Progress, and Redeems Rewards (Priority: P2)

A parent opens the rewards screen and sees the family's current-quarter point balance and progress toward the four reward levels. When the balance reaches a level's threshold, that level's reward becomes redeemable; redeeming shows a voucher code immediately. Redeeming does not reduce the balance — levels are milestones, not purchases.

**Why this priority**: The reward ladder is the payoff of the loop and the demo's centerpiece, but it requires US1–US3 to produce points first.

**Independent Test**: Earn ≥ 50 points in the current quarter, open the rewards screen, confirm Level 1 shows as unlocked and Levels 2–4 show progress, redeem Level 1, and confirm a voucher code is displayed and a redemption record exists.

**Acceptance Scenarios**:

1. **Given** a family with current-quarter points, **When** a parent opens the rewards screen, **Then** they see the quarter balance and all four levels with thresholds (50/100/150/250), each marked locked, unlocked, or already redeemed this quarter.
2. **Given** the family's quarter balance ≥ a level's threshold and that level has not been redeemed this quarter, **When** the parent redeems it, **Then** a redemption record is created, a voucher code is displayed immediately, and the point balance is unchanged.
3. **Given** Level 3 is being redeemed, **Then** the parent must choose one of its two reward options (supermarket voucher or streaming month) and the choice is stored on the redemption record.
4. **Given** a level already redeemed by the family in the current quarter, **When** redemption is attempted again, **Then** it is blocked with a clear message.
5. **Given** a family that has already redeemed Level 4 three times in the current calendar year, **When** they attempt a fourth Level 4 redemption, **Then** it is blocked with a message explaining the annual cap.
6. **Given** a new calendar quarter begins, **Then** the displayed balance derives only from ledger entries in the new quarter (previous-quarter points do not carry over), and all levels become redeemable again (subject to the Level 4 annual cap).

---

### Edge Cases

- What happens if two admins approve and reject the same photo simultaneously?
  - Last write wins on status; both actions create audit records. The service must handle concurrent updates safely. Points are credited at most once per completion (the ledger entry is keyed to the completion).
- What if a completion is verified in the final minutes of a quarter?
  - The ledger entry's timestamp determines its quarter. Points land in the quarter in which verification occurs, not upload.
- What if a family attempts to redeem the same level twice concurrently?
  - A uniqueness guarantee on (family, level, quarter) ensures exactly one redemption succeeds.
- What if a casual activity photo is uploaded without a duration?
  - The upload is rejected with a validation error (client prevents it; server enforces it).
- What if a family belongs to multiple groups?
  - The point economy is family-global: all verified completions feed one ledger. Verification authority is challenge-scoped — the admin of the group owning the challenge reviews its photos.
- What if an activity's tier is reclassified after completions were already verified?
  - Ledger entries are immutable snapshots of points at award time; reclassification affects only future awards.
- Can a family earn points repeatedly for the same casual activity?
  - Only once per `(family, challenge_activity)` — the existing completion uniqueness constraint stands. This intentionally diverges from the business doc's implied daily repeatability; see OD-103.

---

## Requirements *(mandatory)*

### Functional Requirements

**Completion Status Machine**

- **FR-001**: The system MUST replace the existing `ready` completion status with a two-stage verification pipeline: `pending_verification` → `verified` or `rejected`.
- **FR-002**: `self_reported` completions MUST continue to fill collage slots but MUST NOT earn points under any circumstance.
- **FR-003**: Client-side completion polling MUST resolve when status transitions out of `processing` to any of `pending_verification`, `verified`, or `rejected`.
- **FR-004**: A `verified` status MUST be sticky with respect to points: re-uploading a photo on a `verified` completion MUST update only the stored photo; status and points MUST remain unchanged.
- **FR-005**: A `rejected` completion MUST allow the family to re-upload a photo, which MUST reset the status to `pending_verification` and clear the rejection reason.
- **FR-006**: Photo uploads MUST accept a `duration_minutes` value selected from a fixed dropdown. It is REQUIRED for casual-tier activities and OPTIONAL otherwise, enforced server-side.

**Photo Verification**

- **FR-007**: Group admins MUST have access to a paginated verification queue listing all `pending_verification` completions across their group's challenges.
- **FR-008**: Each queue entry MUST display: family name (no child names or child-identifiable data), activity title, submitted photo, reported duration, and submission timestamp.
- **FR-009**: Admins MUST be able to approve a photo, which sets status `verified` and triggers the point award (FR-012–FR-016), recording an audit entry.
- **FR-010**: Admins MUST be able to reject a photo by providing a mandatory reason string. Rejection MUST NOT award points and MUST store the reason for the family to read.
- **FR-011**: Every verification action (approve, reject, auto-approve) MUST create an immutable audit record in `photo_verifications` capturing the reviewer identity (or null for auto), the action type, the policy type, and the timestamp. The verification mechanism MUST sit behind a policy abstraction (`manual | timed | llm`) so AI validation can replace or augment the manual queue without restructuring the pipeline.
- **FR-011a**: Completions in personal/family challenges (`group_id` null) MUST be auto-approved by a background timed policy after a fixed system-wide window (default: 24 hours), since no group admin exists to review them.

**Point Earning (Fixed Tiers)**

- **FR-012**: Each activity MUST carry an effort tier, `casual` or `dedicated` (new `activities.effort_tier` column, seeded for the existing 30 activities). Marketplace classification is derived: an activity with `cost_indicator = "paid"` OR `is_partner_content = true` is marketplace-tier regardless of `effort_tier`.
- **FR-013**: On verification (manual or auto), points MUST be awarded per tier: casual = 3 (only if `duration_minutes ≥ 30`, else 0), dedicated = 6, marketplace = 15. Point values are fixed system-wide constants — there is no admin configuration of point values.
- **FR-014**: Challenges MUST support an `is_featured` flag (community challenge). Verified completions in a featured challenge earn +5 bonus points on top of the base tier award.
- **FR-015**: Every point award MUST be recorded as an immutable entry in a `point_ledger_entries` table (family, completion, base points, bonus points, awarded-at timestamp). At most one ledger entry may exist per completion.
- **FR-016**: A casual completion below the 30-minute gate MUST still be verifiable (photo trust is independent of points) and MUST produce either no ledger entry or a zero-point entry, deterministically.

**Quarterly Accounting**

- **FR-017**: A family's point balance MUST be computed as the sum of its ledger entries whose award timestamp falls within the current calendar quarter (UTC). No stored running balance; no carryover between quarters; no reset job required.
- **FR-018**: The rewards screen MUST display the current-quarter balance and, for transparency, the family's point history (ledger entries) for the current quarter.
- **FR-019**: The existing `users.points_balance` field MUST NOT be used for this feature. The profile screen's points display MUST be repointed to the family's current-quarter balance (or removed).

**Reward Levels & Redemption**

- **FR-020**: The system MUST ship four seeded, system-wide reward levels: Level 1 = 50 pts (BOND marketplace activity credit), Level 2 = 100 pts (cinema tickets), Level 3 = 150 pts (choice: supermarket voucher OR Disney+/Netflix month), Level 4 = 250 pts (LEGO set or music/ceramics class). Levels are global — not per group, not admin-editable.
- **FR-021**: A level is *unlocked* for a family when its current-quarter balance ≥ the level's threshold. Redemption MUST NOT debit the balance (milestone model, not spend-down).
- **FR-022**: Each level MUST be redeemable at most once per family per calendar quarter, enforced atomically (unique on family + level + quarter).
- **FR-023**: Level 4 MUST additionally be capped at 3 redemptions per family per calendar year, checked against redemption records at redemption time.
- **FR-024**: Level 3 redemption MUST require the family to select exactly one of its two reward options; the choice is stored on the redemption record.
- **FR-025**: Redemption MUST create an immutable redemption record (family, level, quarter, points-at-redemption snapshot, chosen option if any, timestamp) and MUST immediately display a voucher code in the app. For the demo, the code is a system-generated placeholder (e.g., `BOND-XXXXXX`); real voucher inventory is an evolution-path concern.

**Privacy & Isolation**

- **FR-026**: Point balances, ledgers, level progress, and redemptions MUST be visible only to members of the owning family. No leaderboards, rankings, or cross-family point disclosure anywhere.

### Key Entities

- **PointLedgerEntry** *(new)*: Immutable record of one point award — family, completion (unique), base points, bonus points, awarded-at. The quarter balance is derived from these at query time.
- **RewardLevel** *(new, seeded)*: One of the four global levels — threshold, title (de/en), description, optional choice options, annual redemption cap (null except Level 4).
- **Redemption** *(new)*: Immutable record of a family redeeming a level in a quarter — family, level, quarter key, chosen option, snapshot of points, generated voucher code.
- **PhotoVerification** *(new)*: Immutable audit record of every verification action (manual or automatic) on a completion photo — reviewer (nullable), action, policy type, rejection reason, timestamp.
- **Activity** *(modified)*: gains `effort_tier` (`casual | dedicated`).
- **Challenge** *(modified)*: gains `is_featured` flag.
- **Completion** *(modified)*: status machine change (`ready` removed; `pending_verification`, `verified`, `rejected` added) and new `duration_minutes` (nullable).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A group admin can review and approve or reject a photo in the verification queue with no more than 3 taps or clicks per item.
- **SC-002**: A family's quarter balance reflects a verified completion within 5 seconds of admin approval.
- **SC-003**: Completing one activity of each tier produces exactly 3 / 6 / 15 points (plus +5 in a featured challenge), and a casual completion reported under 30 minutes produces 0 points — verifiable from the ledger.
- **SC-004**: Redemption completes (record created, voucher code displayed) in under 3 seconds; the balance is unchanged afterwards.
- **SC-005**: A fourth Level 4 redemption attempt within one calendar year is blocked; a second redemption of any level within one quarter is blocked — including under concurrent attempts (exactly one success).
- **SC-006**: Auto-approval processes all eligible personal-challenge photos within 2 hours of crossing the window.
- **SC-007**: Ledger entries from a previous quarter contribute nothing to the current-quarter balance (verifiable by manipulating entry timestamps in a test).
- **SC-008**: Zero point-related data is visible to other families in any view (no leaderboard, no per-family disclosure).

---

## Constraints

- **Non-competitive**: Point balances MUST be private to each family. No rankings, leaderboards, or cross-family comparisons anywhere in the product.
- **Verified trust**: Points are only awarded after policy-mediated photo verification (manual admin or timed auto-approval; AI later). Self-reported completions never earn points.
- **Fixed economics**: Point values, level thresholds, and rewards are system constants defined by the business model — no per-group or admin configuration in this revision.
- **GDPR**:
  - Redemption and ledger records MUST be hard-deleted (CASCADE) when a family is deleted.
  - `photo_verifications` reviewer identity MUST be SET NULL when the reviewer account is deleted; records cascade-delete with the completion/family.
  - Child names and identifiers MUST NOT appear in the admin verification queue.
  - Voucher codes MUST NOT contain personally identifiable information.
  - If real point expiry messaging is introduced later, German consumer protection law requires 30-day advance notice; the quarterly reset MUST be clearly communicated in-app from day one.
- **Spec-driven development**: All API changes MUST follow the mandatory sequence: update `docs/openapi.yaml` first, run codegen second, implement third.
- **No sequential integer PKs**: All new entity PKs MUST use UUID (`gen_random_uuid()`).
- **UTC timestamps**: All `TIMESTAMPTZ` columns MUST store UTC. Quarter boundaries are computed in UTC (see OD-102).

---

## Evolution Path (Demo → Planned BOND Program)

| Demo implementation | Planned end state | How the demo design accommodates it |
|---|---|---|
| Manual admin queue + timed auto-approval | AI photo validation (no children's faces, EU processing) | `VerificationPolicy` abstraction with `llm` policy type reserved; swap the policy, keep the pipeline and audit log |
| Generated placeholder voucher codes | Real bulk-bought voucher inventory per reward | Redemption records already snapshot level + choice; a voucher pool table can be joined in without schema breakage |
| Quarter balance derived from ledger at query time | Same, plus notifications at quarter rollover | Ledger already quarter-aware; add a scheduled job only for messaging, not accounting |
| Marketplace activities as data (`cost_indicator`/partner flag → 15 pts) | In-app booking and payment (commission model) | Tier derivation is independent of booking; booking adds new surfaces, not point changes |
| Fixed system-wide constants for points/levels | Recalibration from pilot data (thresholds, caps, segments) | Constants centralised; RewardLevel rows seeded, so threshold changes are data changes |
| Single family-global economy | Possibly institution-scoped reporting for B2B customers | Ledger entries retain challenge/group provenance via the completion, so scoped aggregation is a query, not a migration |

---

## Deprecated from Rev 1

Removed to match the business model and the 3-day demo budget. Recoverable later if the business direction changes:

- **Per-group point economies** (`family_group_points`, group isolation FRs): the business model defines one family-level, BOND-wide balance.
- **Admin-configured point values** (`default_activity_points`, `group_activity_points` overrides, `rewards_enabled` toggle, `auto_approve_days` per group): replaced by fixed tiers; auto-approval window is a system constant applied to personal challenges only.
- **Per-group prize catalog with admin CRUD and voucher inventory** (`prizes`, `voucher_codes`, stock management, out-of-stock semantics, `FOR UPDATE SKIP LOCKED` pop): replaced by four seeded global levels with milestone-unlock semantics and generated placeholder codes.
- **Spend-down redemption with atomic balance debit**: the business doc's ladder accumulates toward levels; redemption no longer debits, eliminating the balance-debit concurrency class entirely.

---

## Open Decisions

- **OD-101 — Casual/dedicated seeding**: The 30 seed activities need an `effort_tier` classification. Proposed default: activities with `estimated_duration_minutes ≥ 45` or structured character (board game night, cooking project, bike outing) → `dedicated`; rest → `casual`. Needs a quick pass with the business team.
- **OD-102 — Quarter timezone**: Quarters computed in UTC for v1. Germany is UTC+1/+2, so the boundary is off by 1–2 hours at midnight on quarter rollover. Acceptable for the demo; decide Europe/Berlin vs UTC before pilot.
- **OD-103 — Repeatable earning**: The completion uniqueness constraint `(family, challenge_activity)` means a casual activity earns at most once per challenge, while the business doc implies daily repeatability ("happen every day"). Demo keeps the constraint (natural anti-farming). Business team must decide whether repeat completions become a requirement — that is a structural change to completions, not just points.
- **OD-104 — Who flags featured/community challenges**: For the demo, `is_featured` is set at challenge creation or via seed data. Whether this becomes a BOND-curated monthly program (as the business doc implies) is a content-ops decision.
- **OD-105 — Duration dropdown options**: Proposed: 15 / 30 / 45 / 60 / 90 / 120+ minutes. Confirm with UX.
- **OD-106 — Sub-30-minute ledger representation**: Zero-point ledger entry (visible "didn't count" feedback in history) vs no entry at all. Proposed: zero-point entry, since visible feedback supports the positive-reinforcement principle better than silence.
- **OD-107 — Level 4 reward choice**: The business doc lists "LEGO set or music/ceramics class" — treated here as a single reward description, not a stored choice like Level 3. Confirm whether Level 4 also needs an explicit choice at redemption.

---

## Assumptions

- Group admin identity and permissions continue to be tracked in the existing `group_admins` table and enforced server-side on all admin endpoints. Verification authority is challenge-scoped: the admin of the group owning the challenge reviews its completions.
- The existing `completions` table and photo upload pipeline remain the source of record; this feature extends the status machine and adds `duration_minutes` rather than replacing the pipeline.
- `self_reported` completions are already handled correctly by the existing pipeline and never enter the verification flow.
- The background auto-approval runner (personal challenges) operates within the FastAPI process (asyncio task at lifespan startup) for v1.
- Point-award idempotency is guaranteed by the one-ledger-entry-per-completion uniqueness constraint, not by application-level locking.
- The existing `users.points_balance` column and its profile display predate this feature; they are superseded (FR-019) and can be dropped in a later cleanup migration.
- Mobile app support for all new screens is in scope (no web-only or deferred-platform assumption).
