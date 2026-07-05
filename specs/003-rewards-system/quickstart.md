# Quickstart: Family Points & Reward Levels (Demo Scope)

**Feature**: `specs/003-rewards-system`

This is a validation guide, not implementation code. It assumes Phases A–E of `plan.md` are complete. Run against a local Docker Compose stack with seed data.

---

## Prerequisites

```bash
cd server
docker compose up --build
alembic upgrade head   # applies the rewards migration; seeds 4 reward_levels rows
```

Seed demo data if not already present:

```bash
docker compose exec api sh -c "PYTHONPATH=/app python /app/scripts/seed_dev.py"
```

You need: one group with a completed activity challenge, one family that is a member of that group, one user who is a group admin of that group, and one personal (non-group) challenge for the same family.

---

## Scenario 1 — Verification pipeline (US1 + US2)

1. As a family member, upload a photo completion for a **casual-tier** activity in the group's challenge, selecting `duration_minutes = 15` (below the 30-minute gate) from the duration dropdown.
2. Poll `GET /completions/{id}` (or the equivalent client polling call) until status leaves `processing`. **Expect**: status = `pending_verification` (not `ready`).
3. In the collage, confirm the slot shows a clock/pending badge.
4. As the group admin, call `GET /groups/{groupId}/verification-queue`. **Expect**: the completion appears with family name (no child name), activity title, photo, `duration_minutes: 15`, and a submission timestamp.
5. Approve it: `POST /groups/{groupId}/verification-queue/{completionId}/approve`. **Expect**: `status: verified`, `points_awarded: 0` (casual under 30 min).
6. Repeat steps 1–5 with `duration_minutes = 45`. **Expect**: `points_awarded: 3`.
7. Upload a second completion and **reject** it with a reason via `POST .../reject`. **Expect**: collage shows a red/warning badge; tapping reveals the rejection reason.
8. Re-upload a photo on the rejected completion. **Expect**: status resets to `pending_verification`, rejection reason clears.
9. Re-upload a photo on the verified completion from step 6. **Expect**: photo updates, status stays `verified`, no change in the family's ledger.

---

## Scenario 2 — Personal/family challenge auto-approval (US2, FR-011a)

1. Upload a photo completion in a **personal challenge** (`group_id` null) for the same family.
2. Confirm it lands in `pending_verification`.
3. Manually advance the completion's `completed_at` (or wait) past the 24-hour auto-approval window, then trigger (or wait for) the background sweep.
4. **Expect**: status becomes `verified`, a `photo_verifications` row is created with `reviewer_user_id = null` and `policy_type = "timed"`, and points are credited.

---

## Scenario 3 — Fixed point tiers (US3)

Complete and verify one activity of each kind, then inspect the ledger (`point_ledger_entries` for the family, or `GET /rewards/balance` history if exposed):

| Activity | Tier | Duration | Featured challenge? | Expected points |
|---|---|---|---|---|
| Casual, e.g. "Im Park spazieren" | casual | ≥ 30 min | no | 3 |
| Casual, same activity, different challenge | casual | < 30 min | no | 0 |
| Dedicated, e.g. "Spielabend" | dedicated | any | no | 6 |
| Marketplace (`cost_indicator=paid` or `is_partner_content=true`) | marketplace | any | no | 15 |
| Any activity | any | any | **yes** | base + 5 |

**Expect**: each verified completion produces exactly one `point_ledger_entries` row with `base_points`/`bonus_points` matching the table above, and a second approval attempt on the same completion (if replayed) does not create a duplicate row (unique constraint on `completion_id`).

---

## Scenario 4 — Quarter balance and reward levels (US4)

1. Ensure the family has accumulated ≥ 50 points in the current quarter (repeat Scenario 3 as needed across distinct activities).
2. Call `GET /rewards/balance`. **Expect**: `quarter_key` for the current quarter, `balance` matching the sum from Scenario 3, and `levels[]` with Level 1 `state: unlocked`, Levels 2–4 `state: locked` (or `unlocked` if the balance is higher).
3. Redeem Level 1: `POST /rewards/levels/{level1Id}/redeem`. **Expect**: 201 with a `voucher_code` (format `BOND-XXXXXX`); balance in a follow-up `GET /rewards/balance` call is **unchanged** (milestone model, not spend-down).
4. Attempt to redeem Level 1 again in the same quarter. **Expect**: 409 conflict, clear "already redeemed this quarter" message.
5. Reach Level 3 and redeem it **without** `chosen_option`. **Expect**: 400 validation error requiring a choice. Retry with `chosen_option: "supermarket_voucher"`. **Expect**: success, `chosen_option` echoed in the response.
6. Reach Level 4 and redeem it 3 times across 3 different quarters within the same calendar year (or simulate via direct DB inserts for speed). On the 4th attempt in the same year, **expect** a 409 with an annual-cap message.

---

## Scenario 5 — Quarter isolation (FR-017, SC-007)

1. Directly insert (or backdate) a `point_ledger_entries` row for the family with `awarded_at` in the *previous* quarter.
2. Call `GET /rewards/balance`. **Expect**: the backdated entry does **not** contribute to `balance` — only entries within the current quarter's boundaries count.

---

## Scenario 6 — Privacy (FR-026, SC-008)

1. As a second, unrelated family in the same group, attempt to view the first family's balance or ledger. **Expect**: no endpoint exposes another family's points — `/rewards/balance` is always scoped to the calling user's own family, and there is no group-level or cross-family aggregate endpoint.
2. Confirm no UI surface (group screen, feed, collage) displays another family's point total or redemption history.

---

## Definition of Done

- All 6 scenarios above pass manually against a local stack.
- `pytest` passes for new service/repository tests covering: tier resolution, the 30-minute gate, ledger idempotency (unique `completion_id`), quarter-boundary math, Level 3 choice requirement, and the Level 4 annual cap.
- `ruff check .` and `ruff format .` clean on all new/modified server files.
- Client: collage badges, duration picker, reupload modal, and the rewards screen visually verified via `preview_*` tools per CLAUDE.md's UI verification workflow.
