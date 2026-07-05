# Research: Family Points & Reward Levels (Demo Scope)

**Feature**: `specs/003-rewards-system`
**Date**: 2026-07-04

All Technical Context fields in `plan.md` were derivable directly from the existing codebase and CLAUDE.md (Python 3.12/FastAPI/SQLAlchemy async server, Expo/TypeScript client, PostgreSQL 16, layered architecture) — no NEEDS CLARIFICATION markers remained. Research below covers the design decisions specific to this feature.

---

## Decision: Ledger-derived quarter balance instead of a stored running balance

**Decision**: A family's point balance is never stored. It is computed at query time as `SUM(base_points + bonus_points)` over `point_ledger_entries` rows whose `awarded_at` falls in the current calendar quarter.

**Rationale**: The business model requires a quarterly reset with no carryover (`docs/reward-point-system.md` §4). A stored running balance would need a scheduled reset job and would risk drift if a reset run is missed or double-run. Deriving the balance from an immutable, timestamped ledger makes the "reset" free — it's just a `WHERE` clause on the aggregate query — and gives the family a point history for free (FR-018), which the original Rev 1 spec deferred as OD-003. This also sidesteps all the read-then-write balance-mutation hazards the Rev 1 spec had to guard against with `UPDATE ... WHERE balance >= cost` semantics.

**Alternatives considered**:
- *Stored balance + quarterly cron reset* (closer to a literal reading of "points reset every quarter"): rejected because it needs a scheduled job (the project has no worker infrastructure beyond the existing asyncio lifespan tasks) and a snapshot/history table anyway if any point history is desired.
- *Event-sourced ledger with periodic balance snapshots for performance*: unnecessary at demo scale (O(1000s) of families, O(10k) completions); a plain aggregate query is fast enough and simpler.

---

## Decision: Reward levels are milestones (unlock), not a spend-down currency

**Decision**: Reaching a level's point threshold in the current quarter makes it redeemable; redemption creates a record and returns a voucher code but does **not** debit the balance.

**Rationale**: `docs/reward-point-system.md` describes points "accumulating toward" levels, consistent with typical loyalty-tier language (`docs/business-model.md` calls it "airline miles or credit card points" but describes tiers, not a shop). The Rev 1 spec's `FR-023`/`SC-005` atomic-debit and out-of-stock machinery only makes sense for a spend-down shop with finite voucher inventory — that entire concurrency class is unnecessary for a milestone ladder. This also matches the fixed reward list (exactly 4 levels, 5 named rewards) rather than an open-ended admin-managed catalog.

**Alternatives considered**:
- *Spend-down shop* (Rev 1 design): rejected for the demo — it requires voucher inventory management, atomic balance debits, and `SELECT FOR UPDATE SKIP LOCKED`, none of which the business documents actually describe and none of which fit a 3-day budget.
- *Hybrid (levels debit a running total but redemption doesn't require inventory)*: rejected as unnecessary complexity; the business docs give no indication that reaching Level 1 should reduce eligibility for Level 2 within the same quarter.

---

## Decision: Fixed system-wide point tiers, not admin-configurable

**Decision**: Point values (3/6/15, +5 bonus) and level thresholds (50/100/150/250) are hardcoded constants (levels also seeded as rows for display flexibility); there is no admin UI to change them per group.

**Rationale**: The business model treats these numbers as carefully budget-modeled constants (`docs/business-model.md` §4.4 — the entire rewards-budget-as-percent-of-license-fee calculation assumes these exact values). Per-group admin configurability (Rev 1's `FR-006`–`FR-009`) would let group admins silently break the budget model the business team built pricing around. For a demo, fixed constants are also simply less to build.

**Alternatives considered**:
- *Admin-configurable per group* (Rev 1): rejected — contradicts the budget model and adds an entire settings UI with no demo value.
- *Configurable via environment/config file only (no UI)*: considered as a lighter-weight compromise for future tuning; noted in the Evolution Path table in spec.md rather than built now.

---

## Decision: Marketplace tier is derived, not a third `effort_tier` value

**Decision**: `activities.effort_tier` only stores `casual | dedicated`. An activity counts as marketplace-tier for point purposes if `cost_indicator == "paid"` or `is_partner_content == true`, regardless of its `effort_tier`.

**Rationale**: `cost_indicator` and `is_partner_content` already exist on the `Activity` model and already capture exactly the distinction the business model's marketplace tier needs ("marketplace activities already generate real commission for BOND"). Adding a redundant third enum value would let the two fields disagree (e.g., an activity marked `effort_tier="marketplace"` but `cost_indicator="free"`), which is a data-integrity risk with no benefit.

**Alternatives considered**:
- *Three-value `effort_tier` enum (`casual | dedicated | marketplace`)*: rejected — redundant with existing fields, invites inconsistency.

---

## Decision: Verification policy branches on `challenge.group_id`, not a per-group setting

**Decision**: Group challenges use `NeverAutoApprovePolicy` (manual admin queue); personal/family challenges (`group_id IS NULL`) use `TimedVerificationPolicy(hours=24)`, since there's no group admin to review them. This replaces Rev 1's per-group `auto_approve_days` configuration.

**Rationale**: Rev 1 assumed every challenge belongs to a group with an admin who sets an auto-approve threshold. But `challenges.group_id` is nullable — personal/family challenges have no admin at all, so Rev 1's design left them with no verification path (FR-009 in Rev 1 implicitly assumed rewards only exist inside groups). Since the revised spec awards points family-globally regardless of which challenge a completion belongs to, personal challenges must have *some* approval path. A fixed system-wide auto-approval window is the simplest fix and needs no new configuration surface.

**Alternatives considered**:
- *Personal challenges never earn points*: rejected — the business model doesn't distinguish where an activity happens, only what kind of activity it is; excluding personal challenges would silently shrink the earning surface in a way neither business doc calls for.
- *Per-family configurable auto-approve window*: unnecessary complexity for a system-wide constant.

---

## Decision: UTC quarter boundaries for v1 (OD-102)

**Decision**: "Current quarter" is computed using UTC month/day boundaries (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec in UTC).

**Rationale**: The project already stores all timestamps as UTC `TIMESTAMPTZ` (CLAUDE.md hard constraint) and has no existing per-user timezone concept. Using UTC avoids introducing timezone-conversion logic for a boundary effect (1–2 hours at exact midnight on 4 days a year) that is invisible to the vast majority of usage. Flagged explicitly as OD-102 for pilot-readiness review (Germany is UTC+1/+2).

**Alternatives considered**:
- *Europe/Berlin quarter boundaries*: more "correct" for a German-market product but requires a timezone library decision and testing for a marginal, rarely-observed edge case; deferred past the demo.

---

## Decision: Placeholder voucher codes, no inventory table

**Decision**: Redemption generates a code in the form `BOND-XXXXXX` (random alphanumeric) at redemption time and stores it on the `redemptions` row. No `voucher_codes` table, no stock tracking, no out-of-stock state.

**Rationale**: No real reward partner has been committed (business doc §6/OD-006 in Rev 1). Building a voucher-inventory system before any partner integration exists is speculative. The `redemptions` table already captures everything a real voucher pool would need to join against later (family, level, quarter, timestamp), so swapping in real inventory is additive, not a rewrite (documented in spec.md's Evolution Path table).

**Alternatives considered**:
- *Reuse Rev 1's full `prizes`/`voucher_codes` inventory model but seed it with 4 fake prizes*: rejected — it's strictly more code for the same demo-visible outcome (a code appears on screen), and it re-adds the atomic-pop concurrency machinery that a milestone model doesn't need.
