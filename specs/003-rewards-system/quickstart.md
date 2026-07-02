# Quickstart & Validation Guide: Group-Scoped Rewards System

**Feature**: `specs/003-rewards-system`
**Date**: 2026-06-28

This guide describes how to validate the rewards system end-to-end once implemented. It does not include implementation code — see [`tasks.md`](tasks.md) for that.

---

## Prerequisites

- Docker Compose stack running (`docker compose -f server/docker-compose.yml up`)
- Seed data loaded (`POST /dev/seed` or `python scripts/seed_dev.py`)
- At least one group with at least one family member (provided by seed)
- At least one group admin user (provided by seed)
- Dev server: `cd client && npx expo start`

---

## Scenario 1 — Enable rewards and configure points

**Goal**: Verify that a group admin can enable rewards and set point values.

```bash
# 1. Authenticate as group admin (obtain JWT token)
TOKEN=$(curl -s -X POST http://localhost:8000/auth/... | jq -r .access_token)

# 2. Enable rewards with default 10 points and 7-day auto-approve
curl -s -X PATCH http://localhost:8000/groups/<group_id>/rewards/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rewards_enabled": true, "default_activity_points": 10, "auto_approve_days": 7}' | jq

# Expected: 200 with the updated settings echoed back

# 3. Set a per-activity override
curl -s -X PATCH \
  "http://localhost:8000/groups/<group_id>/rewards/activity-points/<challenge_activity_id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"points": 25}' | jq

# Expected: 200 with the override reflected
```

---

## Scenario 2 — Photo submission enters pending_verification

**Goal**: Verify that the status machine change is in effect.

```bash
# Submit a photo completion as a family member (existing upload flow)
# ... (use existing photo upload endpoint)

# Poll the completion until status != "processing"
curl -s http://localhost:8000/completions/<completion_id> \
  -H "Authorization: Bearer $FAMILY_TOKEN" | jq .status

# Expected: "pending_verification" (NOT "ready")
```

**Client**: After upload, the collage slot should show the photo with a clock/pending badge (not the plain photo it would show for the old `ready` status).

---

## Scenario 3 — Admin approves photo and points are credited

**Goal**: Verify the approval flow and balance update.

```bash
# 1. As admin: view the verification queue
curl -s http://localhost:8000/groups/<group_id>/admin/verifications \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

# Expected: the pending completion appears in items[]

# 2. Approve it
curl -s -X POST \
  "http://localhost:8000/groups/<group_id>/admin/verifications/<completion_id>/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

# Expected: 200 with points_awarded: 10 (or the override value)

# 3. Check family balance
curl -s "http://localhost:8000/groups/<group_id>/rewards/balance" \
  -H "Authorization: Bearer $FAMILY_TOKEN" | jq .balance

# Expected: 10 (or the activity's point value)

# 4. Check photo_verifications audit record exists (internal/psql):
# SELECT * FROM photo_verifications WHERE completion_id = '<completion_id>';
# Expected: one row with action='approved', policy_type='manual', reviewer_user_id set
```

**Client**: The collage slot should now show a green checkmark badge.

---

## Scenario 4 — Admin rejects photo; family re-uploads

**Goal**: Verify the rejection and re-upload flows.

```bash
# 1. Submit another photo completion (new activity or reset)

# 2. Admin rejects
curl -s -X POST \
  "http://localhost:8000/groups/<group_id>/admin/verifications/<completion_id>/reject" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Photo does not show the activity clearly"}' | jq

# Expected: 200

# 3. Family checks collage — slot shows rejected indicator + reason
# In client: tap the slot → see "Photo does not show the activity clearly" + re-upload button

# 4. Family re-uploads
curl -s -X PATCH "http://localhost:8000/completions/<completion_id>/photo" \
  -H "Authorization: Bearer $FAMILY_TOKEN" \
  -F "photo=@/path/to/new_photo.jpg" | jq .status

# Expected: "processing" → transitions to "pending_verification" after compression
```

---

## Scenario 5 — Re-upload on a verified completion keeps points

**Goal**: Verify the sticky `verified` state.

```bash
# 1. Approve a completion (balance now has points)
# 2. Family re-uploads a new photo
curl -s -X PATCH "http://localhost:8000/completions/<completion_id>/photo" \
  -H "Authorization: Bearer $FAMILY_TOKEN" \
  -F "photo=@/path/to/new_photo.jpg" | jq

# Expected: status returns "verified" (no reset to pending_verification)

# 3. Check balance
curl -s "http://localhost:8000/groups/<group_id>/rewards/balance" \
  -H "Authorization: Bearer $FAMILY_TOKEN" | jq .balance

# Expected: unchanged (no double award)
```

---

## Scenario 6 — Create prize, upload vouchers, redeem

**Goal**: Verify the full redemption path.

```bash
# 1. Admin creates a prize
PRIZE=$(curl -s -X POST "http://localhost:8000/groups/<group_id>/prizes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Gratis Collage-Druck",
    "point_cost": 5,
    "category": "collage_printing",
    "available": true
  }' | jq -r .id)

# 2. Admin uploads voucher codes
curl -s -X POST "http://localhost:8000/groups/<group_id>/prizes/$PRIZE/vouchers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"codes": ["PIXUM-AAA1", "PIXUM-BBB2", "PIXUM-CCC3"]}' | jq .inserted

# Expected: 3

# 3. Admin checks stock
curl -s "http://localhost:8000/groups/<group_id>/prizes/$PRIZE/vouchers/remaining" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .remaining

# Expected: 3

# 4. Family sees prize in catalog (balance must be >= 5)
curl -s "http://localhost:8000/groups/<group_id>/prizes" \
  -H "Authorization: Bearer $FAMILY_TOKEN" | jq

# Expected: prize appears with available: true

# 5. Family redeems
curl -s -X POST "http://localhost:8000/groups/<group_id>/prizes/$PRIZE/redeem" \
  -H "Authorization: Bearer $FAMILY_TOKEN" | jq

# Expected: { redemption_id: ..., voucher_code: "PIXUM-AAA1", points_spent: 5, ... }

# 6. Balance decremented
curl -s "http://localhost:8000/groups/<group_id>/rewards/balance" \
  -H "Authorization: Bearer $FAMILY_TOKEN" | jq .balance

# Expected: previous balance - 5

# 7. Stock decremented
curl -s "http://localhost:8000/groups/<group_id>/prizes/$PRIZE/vouchers/remaining" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .remaining

# Expected: 2
```

---

## Scenario 7 — Concurrent redemption (last voucher)

**Goal**: Verify exactly one redeemer gets the last code.

This is best validated with a script that fires two simultaneous `POST /redeem` requests:

```bash
# Assuming balance = 5 for two families and stock = 1
curl -s -X POST ".../prizes/$PRIZE/redeem" -H "Authorization: Bearer $FAMILY1_TOKEN" &
curl -s -X POST ".../prizes/$PRIZE/redeem" -H "Authorization: Bearer $FAMILY2_TOKEN" &
wait

# Expected: one response has voucher_code, the other returns 409 (out of stock)
# Expected: stock = 0 after both settle
```

---

## Scenario 8 — Auto-approval sweep (manual trigger)

**Goal**: Verify the timed policy approves photos after the threshold.

Since waiting 7 days is impractical, set `auto_approve_days = 0` (or adjust the threshold in a test group) and trigger the sweep via the admin or a direct service call in integration tests.

```bash
# Set to immediate auto-approve for testing
curl -s -X PATCH "http://localhost:8000/groups/<group_id>/rewards/settings" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rewards_enabled": true, "auto_approve_days": 0, "default_activity_points": 10}' | jq

# Wait for the next hourly sweep (or trigger directly in integration tests via
# calling verification_service.run_auto_approvals() in a test fixture)

# After sweep: check status
curl -s "http://localhost:8000/completions/<completion_id>" \
  -H "Authorization: Bearer $FAMILY_TOKEN" | jq .status

# Expected: "verified"
# Audit: photo_verifications row with action='auto_approved', reviewer_user_id=null, policy_type='timed'
```

---

## Scenario 9 — Group isolation

**Goal**: Verify that points earned in Group A do not appear in Group B.

```bash
# Family earns points in group A via approval
# Check balance in group B
curl -s "http://localhost:8000/groups/<group_b_id>/rewards/balance" \
  -H "Authorization: Bearer $FAMILY_TOKEN" | jq .balance

# Expected: 0 (or unchanged from prior activity in group B)
```

---

## Client smoke tests (manual)

| Screen | Check |
|---|---|
| Collage grid | `pending_verification` slot shows clock badge; `verified` shows checkmark; `rejected` shows red/warning indicator |
| Rejected slot tap | Shows rejection reason + "Neues Foto hochladen" button |
| Group detail | Points balance chip visible (when rewards enabled for group) |
| Prize catalog | Lists available prizes with point costs and family balance |
| Redemption | Voucher code shown immediately after confirm tap |
| Admin panel | Verification queue lists pending photos with family name, activity, submission date |
| Admin approve | Queue item disappears; family balance updates on next refresh |
| Admin reject | Rejection reason required; submit blocked if empty |
| Admin prizes | Create prize form, voucher code upload, stock count |

---

## Database checks (via psql)

```sql
-- Verify status machine is in effect (no 'ready' rows after migration)
SELECT status, COUNT(*) FROM completions GROUP BY status;

-- Check audit trail completeness
SELECT action, policy_type, COUNT(*) FROM photo_verifications GROUP BY action, policy_type;

-- Verify balance atomicity (no negative balances possible)
SELECT * FROM family_group_points WHERE balance < 0;

-- Verify no code was redeemed twice
SELECT code, COUNT(*) FROM voucher_codes WHERE redeemed_at IS NOT NULL
GROUP BY code HAVING COUNT(*) > 1;
```
