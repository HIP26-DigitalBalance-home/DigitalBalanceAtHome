# Feature Specification: Group-Scoped Rewards System

**Feature Branch**: `003-rewards-system`

**Created**: 2026-06-28

**Status**: Draft

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Group Admin Enables and Configures Rewards (Priority: P1)

A group admin activates the rewards economy for their group and sets the default point value awarded per completed activity. They also override point values for specific activities in their group's challenges where the default does not reflect the activity's effort level.

**Why this priority**: Rewards cannot function without initial configuration. This story is the prerequisite for all other reward flows.

**Independent Test**: Can be fully tested by logging in as a group admin, enabling rewards for a group, setting a default point value, and verifying the setting persists and affects subsequent completions.

**Acceptance Scenarios**:

1. **Given** a group admin is viewing their group settings, **When** they enable rewards, **Then** rewards are activated for that group and a default point value is stored.
2. **Given** rewards are enabled, **When** the admin sets a per-activity point override for a specific challenge activity, **Then** completions of that activity earn the overridden amount instead of the default.
3. **Given** rewards are disabled for a group, **When** a family completes an activity in that group's challenge, **Then** no points are awarded regardless of verification outcome.
4. **Given** rewards are enabled, **When** the admin sets `auto_approve_days` to null, **Then** photos are never automatically approved and must be reviewed manually.
5. **Given** rewards are enabled, **When** the admin sets `auto_approve_days` to 7, **Then** photos that have been in `pending_verification` for ≥ 7 days are automatically approved on the next system sweep.

---

### User Story 2 — Admin Reviews and Verifies Completion Photos (Priority: P1)

A group admin reviews photos submitted by families for challenge completions. They approve genuine photos (awarding points to the family) or reject photos that do not demonstrate the activity (providing a reason the family can see).

**Why this priority**: Human verification is the trust mechanism that underpins the entire rewards economy. Points cannot be earned without this flow.

**Independent Test**: Can be fully tested by submitting a photo completion as a family, then logging in as a group admin and approving or rejecting it, then verifying the family's point balance changes accordingly.

**Acceptance Scenarios**:

1. **Given** a family has uploaded a completion photo in a group's challenge, **When** the admin opens the verification queue, **Then** they see the pending completion with family name (no child names), activity title, photo, and submission date.
2. **Given** the admin approves a photo, **Then** the completion status changes to `verified`, the family's balance is credited with the activity's point value, and an audit record is created.
3. **Given** the admin rejects a photo and enters a rejection reason, **Then** the completion status changes to `rejected`, no points are awarded, and the rejection reason is stored and visible to the family.
4. **Given** a `verified` completion exists, **When** the family re-uploads a photo, **Then** only the photo is updated; the status remains `verified` and no points change.
5. **Given** a `rejected` completion exists, **When** the family re-uploads a photo, **Then** the status resets to `pending_verification` and the rejection reason is cleared.

---

### User Story 3 — Family Views Balance and Redeems a Prize (Priority: P2)

A parent views their family's current point balance within a group and browses the group's prize catalog. They redeem a prize they can afford; the app shows the voucher code immediately.

**Why this priority**: Redemption is the culmination of the rewards loop. Without it, points have no tangible value and motivation collapses.

**Independent Test**: Can be fully tested by verifying a completion (earning points), then opening the prize catalog, redeeming a prize, and confirming the voucher code is shown and the balance is debited.

**Acceptance Scenarios**:

1. **Given** a family has a non-zero balance in a group, **When** they open the group's prize section, **Then** they see their current balance and a list of available prizes with point costs.
2. **Given** a family's balance ≥ the prize's point cost and voucher stock is available, **When** they redeem a prize, **Then** the balance is atomically debited, a unique voucher code is returned and displayed, and a redemption record is created.
3. **Given** a family's balance < the prize's point cost, **When** they attempt redemption, **Then** the action is blocked with a message indicating insufficient points.
4. **Given** a prize has no remaining voucher codes, **When** a family attempts redemption, **Then** the redemption is blocked and the prize is shown as out of stock.
5. **Given** a prize with `available = false` or a past `expires_at`, **Then** it is hidden from the family's prize catalog.

---

### User Story 4 — Admin Manages the Prize Catalog and Voucher Inventory (Priority: P2)

A group admin creates prizes in their group's catalog, sets point costs, and uploads batches of voucher codes for each prize. They can also check remaining stock per prize.

**Why this priority**: The prize catalog must exist before families can redeem. Admin tooling for voucher management is required for any live deployment.

**Independent Test**: Can be fully tested by creating a prize, uploading a set of codes, and verifying the stock count, then redeeming one and verifying the count decreases.

**Acceptance Scenarios**:

1. **Given** a group admin creates a prize with a title, description, point cost, and category, **Then** the prize appears in the admin's catalog view.
2. **Given** an existing prize, **When** the admin uploads a batch of voucher codes (newline-separated text), **Then** each code is stored as a separate, unused voucher record linked to that prize.
3. **Given** an existing prize, **When** the admin views remaining stock, **Then** they see the count of unused (unredeemed) voucher codes.
4. **Given** the admin marks a prize as unavailable, **Then** it disappears from the family-facing catalog but remains visible in the admin view.

---

### User Story 5 — Family Views Completion Status in the Collage (Priority: P1)

A parent can see the verification state of each completion slot in the group collage, understand why a photo was rejected, and re-upload a corrected photo.

**Why this priority**: The collage is the primary UI surface for completions. Families need clear feedback on photo status to trust the system.

**Independent Test**: Can be fully tested by submitting a photo, viewing it in the collage with a pending badge, having an admin reject it with a reason, verifying the rejected visual state and reason display, and re-uploading successfully.

**Acceptance Scenarios**:

1. **Given** a completion in `pending_verification`, **When** the family views the collage, **Then** the slot shows the photo with a clock/pending indicator.
2. **Given** a completion in `verified`, **Then** the slot shows the photo with a green checkmark badge.
3. **Given** a completion in `rejected`, **Then** the slot shows the photo with a red/warning indicator; tapping it reveals the rejection reason and a re-upload action.
4. **Given** the family completes photo upload, **When** the upload pipeline finishes, **Then** the client resolves polling for any status other than `processing` (including `pending_verification`, `verified`, and `rejected`).

---

### Edge Cases

- What happens if two admins approve and reject the same photo simultaneously?
  - Last write wins on status; both actions create audit records. The service must handle concurrent updates safely.
- What if a group is deleted while a redemption is in flight?
  - Redemption must complete atomically or fail entirely; partial debit without code delivery is not permitted.
- What if all voucher codes for a prize are redeemed concurrently?
  - `SELECT FOR UPDATE SKIP LOCKED` ensures only one redeemer receives each code; others receive an out-of-stock error.
- What if `auto_approve_days` is changed after some photos are already pending?
  - The new value applies on the next sweep; already-pending photos are evaluated against the updated threshold.
- What if a family belongs to two groups both with rewards enabled?
  - Each group maintains a fully independent balance and point economy; earning or redeeming in one group has no effect on the other.

---

## Requirements *(mandatory)*

### Functional Requirements

**Completion Status Machine**

- **FR-001**: The system MUST replace the existing `ready` completion status with a two-stage verification pipeline: `pending_verification` → `verified` or `rejected`.
- **FR-002**: `self_reported` completions MUST continue to fill collage slots but MUST NOT earn points under any circumstance.
- **FR-003**: Client-side completion polling MUST resolve when status transitions out of `processing` to any of `pending_verification`, `verified`, or `rejected`.
- **FR-004**: A `verified` status MUST be a sticky terminal state with respect to points: re-uploading a photo on a `verified` completion MUST update only the stored photo; status and points MUST remain unchanged.
- **FR-005**: A `rejected` completion MUST allow the family to re-upload a photo, which MUST reset the status to `pending_verification` and clear the rejection reason.

**Group Rewards Configuration**

- **FR-006**: Each group MUST have a `rewards_enabled` flag (default off) controllable only by a group admin.
- **FR-007**: When rewards are enabled, the group MUST have a configurable `default_activity_points` value applied to all activities without an explicit override.
- **FR-008**: Group admins MUST be able to set per-activity point overrides for any challenge activity within their group.
- **FR-009**: Each group MUST support an `auto_approve_days` setting. When set to a positive integer, photos that remain in `pending_verification` for at least that many days MUST be automatically approved by a background process. When null, no automatic approval occurs.

**Photo Verification**

- **FR-010**: Group admins MUST have access to a paginated verification queue listing all `pending_verification` completions across their group's challenges.
- **FR-011**: Each queue entry MUST display: family name (no child names or child-identifiable data), activity title, submitted photo, and submission timestamp.
- **FR-012**: Admins MUST be able to approve a photo, immediately crediting the family's balance with the applicable point value and recording an audit entry.
- **FR-013**: Admins MUST be able to reject a photo by providing a mandatory reason string. Rejection MUST NOT award points and MUST store the reason for the family to read.
- **FR-014**: Every verification action (approve, reject, auto-approve) MUST create an immutable audit record in `photo_verifications` capturing the reviewer identity (or null for auto), the action type, the policy type, and the timestamp.
- **FR-015**: The auto-approval mechanism MUST be implemented behind a policy abstraction that supports future replacement (e.g., LLM-based review) without restructuring the verification pipeline.

**Family Point Balance**

- **FR-016**: Each family MUST maintain a separate, isolated point balance per group they belong to.
- **FR-017**: Point balance credit (on approval) and debit (on redemption) MUST be atomic operations; partial state MUST NOT be observable.
- **FR-018**: A family's balance in a group MUST never go below zero.

**Prize Catalog and Redemption**

- **FR-019**: Group admins MUST be able to create prizes with: title (German), optional English title, optional descriptions, point cost, category (collage_printing | experience | activity_voucher | goods), availability flag, and optional expiry date.
- **FR-020**: Group admins MUST be able to upload batches of voucher codes for a prize (provided as a list of strings). Each code MUST be stored individually and redeemed at most once.
- **FR-021**: Group admins MUST be able to view the remaining (unredeemed) voucher stock count per prize.
- **FR-022**: The prize catalog shown to group members MUST include only prizes with `available = true` and a non-past `expires_at` (or no expiry).
- **FR-023**: Redemption MUST be atomic: check balance ≥ cost, lock and pop exactly one unused voucher code, debit the balance, create a redemption record, and return the code to the requesting family — all within a single transaction.
- **FR-024**: If no voucher codes remain, the redemption attempt MUST fail with an out-of-stock error and leave the family's balance unchanged.
- **FR-025**: The voucher code MUST be surfaced to the family immediately in the app at redemption time.

**Group Isolation**

- **FR-026**: A family's prize catalog, balance, and points earned MUST be fully scoped to a single group. No cross-group aggregation or visibility is permitted.

### Key Entities

- **GroupRewardsConfig** (extends Group): Rewards-enabled flag, default point value, and auto-approve threshold per group.
- **GroupActivityPoints**: A per-activity point override within a group, taking precedence over the group default.
- **FamilyGroupPoints**: The running point balance for a family within a specific group. One record per (family, group) pair.
- **Prize**: A redeemable reward offered by a group admin, backed by a pool of voucher codes.
- **VoucherCode**: A single-use redemption code associated with a prize. Redeemed atomically to avoid double-use.
- **Redemption**: An immutable audit record of a family redeeming a prize, capturing the point cost at the time of redemption.
- **PhotoVerification**: An immutable audit record of every verification action (manual or automatic) taken on a completion photo.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A group admin can configure rewards settings (enable/disable, default points, auto-approve threshold) in under 2 minutes from any device.
- **SC-002**: A group admin can review and approve or reject a photo in the verification queue with no more than 3 taps or clicks per item.
- **SC-003**: A family's point balance reflects a verified completion within 5 seconds of admin approval.
- **SC-004**: Prize redemption completes (balance debited, voucher code displayed) in under 3 seconds under normal conditions.
- **SC-005**: Two concurrent redemption attempts for the same last voucher code result in exactly one success and one out-of-stock error — no code is issued twice and no balance is incorrectly debited.
- **SC-006**: Auto-approval processes all eligible pending photos within 2 hours of their crossing the configured age threshold.
- **SC-007**: A family's balance in one group is never affected by activity in another group, verifiable by operating the same family across two groups simultaneously.
- **SC-008**: Zero point-related data is visible to other families in any group view (no leaderboard, no per-family balance disclosure).

---

## Constraints

- **Non-competitive**: Point balances MUST be private to each family. No rankings, leaderboards, or cross-family point comparisons are permitted anywhere in the product.
- **Admin-mediated trust**: Points are only awarded after human or policy-based photo verification. Self-reported completions are explicitly excluded from earning points.
- **Group isolation**: Each group operates as an independent economy. A family in multiple groups has multiple independent balances.
- **GDPR**:
  - Voucher codes MUST NOT contain or transmit personally identifiable information to partners.
  - Redemption records MUST be hard-deleted (CASCADE) when a family is deleted.
  - `photo_verifications` records MUST be anonymised (reviewer set to null or cascade-deleted) when a family or the reviewer account is deleted.
  - Child names and identifiers MUST NOT appear in the admin verification queue.
  - If point expiry is introduced in future, German consumer protection law requires 30-day advance notice and opportunity to use accumulated points before expiry.
- **Spec-driven development**: All API changes MUST follow the mandatory sequence: update `docs/openapi.yaml` first, run codegen second, implement third.
- **No sequential integer PKs**: All new entity PKs MUST use UUID (`gen_random_uuid()`).
- **UTC timestamps**: All `TIMESTAMPTZ` columns MUST store UTC.

---

## Open Decisions

- **OD-001 — Voucher upload UX**: Should admins upload codes as a newline-separated text paste or as a `.csv` file? Both are equivalent server-side; CSV is more practical for large partner batches.
- **OD-002 — Admin notification of pending queue**: Admins currently have no push or in-app signal when a new photo enters their verification queue. A badge count on the group screen or a periodic email digest should be considered for v2.
- **OD-003 — Points history / ledger**: The current design stores only a running balance. If families need a transaction history for trust or GDPR data export purposes, a `point_ledger_entries` table must be added. Deferred to v2.
- **OD-004 — Voucher delivery via email**: Voucher codes are shown in-app only. Sending codes by email would require confirming that the parent's email address (available via Google OAuth) is stored on the `users` table and consented to for this purpose.
- **OD-005 — Cross-group prize discovery**: Families only see prizes in groups they belong to. A global prize discovery screen to incentivise group joining is deferred to v2.
- **OD-006 — First partner**: No partner has been committed. The voucher-pool model is partner-agnostic; the first implementation candidate is a collage-printing service (e.g., Pixum), which requires only per-redemption discount codes.

---

## Assumptions

- Group admin identity and permissions continue to be tracked in the existing `group_admins` table and enforced server-side on all admin endpoints.
- The existing `completions` table and photo upload pipeline remain the source of record; this feature extends their status machine rather than replacing the pipeline.
- `self_reported` completions are already handled correctly by the existing pipeline and require no status machine changes beyond ensuring they never enter the verification flow.
- The background auto-approval runner operates within the FastAPI process (asyncio task launched at lifespan startup) for v1; migration to a standalone job or k8s CronJob is a future concern.
- Balance atomicity requirements can be met with a single-counter `UPDATE … WHERE balance >= cost` approach (no event-sourced ledger required for v1).
- The family's email address from Google OAuth is stored on `users.email`; this assumption is relevant only to OD-004 and does not affect the core feature scope.
- Mobile app support for all new screens is in scope for this feature (no web-only or deferred-platform assumption).
