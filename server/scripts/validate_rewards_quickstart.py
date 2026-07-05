"""One-shot API-level validation of specs/003-rewards-system/quickstart.md.

Run inside the api container:
    docker compose exec api sh -c "PYTHONPATH=/app python /app/scripts/validate_rewards_quickstart.py"

Creates its own fixture challenges/slots against seeded users, drives the six
quickstart scenarios over HTTP (auth via directly-minted JWTs), and reports
PASS/FAIL per check. Fixture data is left in place — reset via seed scripts.
"""

import asyncio
import io
import sys
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from PIL import Image
from sqlalchemy import func, select

from app.core.database import AsyncSessionLocal
from app.models.activity import Activity
from app.models.challenge import Challenge, ChallengeActivity
from app.models.completion import Completion
from app.models.family import FamilyMembership
from app.models.group import GroupAdmin, GroupMembership
from app.models.rewards import PhotoVerification, PointLedgerEntry, Redemption, RewardLevel
from app.models.user import User
from app.services.auth import create_access_token
from app.services.verification import run_auto_approvals

BASE = "http://localhost:8000"
RESULTS: list[tuple[bool, str]] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    RESULTS.append((cond, name))
    print(f"  {'✅' if cond else '❌'} {name}" + (f"  [{detail}]" if detail and not cond else ""))


def jpeg_bytes(color=(200, 120, 80)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (320, 240), color).save(buf, format="JPEG")
    return buf.getvalue()


async def upload_photo(client, token, slot_id, duration=None, color=(200, 120, 80)):
    data = {"challenge_activity_id": str(slot_id), "shared_to_feed": "false"}
    if duration is not None:
        data["duration_minutes"] = str(duration)
    r = await client.post(
        "/photos",
        data=data,
        files={"image": ("photo.jpg", jpeg_bytes(color), "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )
    return r


async def poll_status(client, token, completion_id, timeout=30):
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        r = await client.get(f"/completions/{completion_id}", headers={"Authorization": f"Bearer {token}"})
        if r.status_code == 200 and r.json()["status"] != "processing":
            return r.json()
        await asyncio.sleep(0.5)
    return r.json() if r.status_code == 200 else {"status": f"http {r.status_code}"}


async def main() -> None:
    async with AsyncSessionLocal() as session:
        # ── Discover seeded actors ────────────────────────────────
        admin_row = (
            (
                await session.execute(
                    select(GroupAdmin, User).join(User, GroupAdmin.user_id == User.id).limit(1)
                )
            )
            .tuples()
            .first()
        )
        if not admin_row:
            print("No seeded group admin found — run seed_dev.py first.")
            sys.exit(1)
        group_admin, admin_user = admin_row
        group_id = group_admin.group_id

        # actor = a parent from a *different* member family of the same group
        actor = (
            await session.execute(
                select(User)
                .join(FamilyMembership, FamilyMembership.user_id == User.id)
                .join(GroupMembership, GroupMembership.family_id == FamilyMembership.family_id)
                .where(GroupMembership.group_id == group_id, User.id != admin_user.id)
                .limit(1)
            )
        ).scalar_one()
        actor_family_id = (
            await session.execute(
                select(FamilyMembership.family_id).where(FamilyMembership.user_id == actor.id)
            )
        ).scalar_one()
        # a user from a third family (privacy checks)
        other = (
            await session.execute(
                select(User)
                .join(FamilyMembership, FamilyMembership.user_id == User.id)
                .where(
                    User.id.notin_([admin_user.id, actor.id]),
                    FamilyMembership.family_id != actor_family_id,
                )
                .limit(1)
            )
        ).scalar_one()

        # ── Fixture activities ────────────────────────────────────
        casual = (
            await session.execute(
                select(Activity)
                .where(
                    Activity.effort_tier == "casual",
                    Activity.cost_indicator != "paid",
                    Activity.is_partner_content.is_(False),
                )
                .limit(1)
            )
        ).scalar_one()
        dedicated = (
            await session.execute(
                select(Activity).where(Activity.effort_tier == "dedicated").limit(1)
            )
        ).scalar_one()
        marketplace = Activity(
            title="[QV] Partner-Workshop",
            description="Validation fixture",
            estimated_duration_minutes=60,
            age_min=3,
            age_max=12,
            cost_indicator="paid",
            is_partner_content=True,
            effort_tier="casual",
            language="de",
        )
        session.add(marketplace)
        await session.flush()

        def make_challenge(title, group, featured=False):
            return Challenge(
                title=title,
                description="Quickstart validation fixture",
                group_id=group,
                created_by_family_id=actor_family_id,
                display_mode="collage",
                is_featured=featured,
            )

        ch_group = make_challenge("[QV] Gruppen-Challenge", group_id)
        ch_feat = make_challenge("[QV] Featured-Challenge", group_id, featured=True)
        ch_personal = make_challenge("[QV] Familien-Challenge", None)
        session.add_all([ch_group, ch_feat, ch_personal])
        await session.flush()

        def slot(ch, act, pos):
            s = ChallengeActivity(challenge_id=ch.id, activity_id=act.id, grid_position=pos)
            session.add(s)
            return s

        # group challenge slots: casual x4 (gate/points/reject/synthetic), dedicated, marketplace
        s_casual_low = slot(ch_group, casual, 0)
        s_casual_ok = slot(ch_group, casual, 1)
        s_reject = slot(ch_group, casual, 2)
        s_dedicated = slot(ch_group, dedicated, 3)
        s_market = slot(ch_group, marketplace, 4)
        s_synth1 = slot(ch_group, casual, 5)
        s_synth2 = slot(ch_group, casual, 6)
        s_featured = slot(ch_feat, casual, 0)
        s_personal = slot(ch_personal, casual, 0)
        await session.flush()
        slot_ids = {
            "casual_low": s_casual_low.id,
            "casual_ok": s_casual_ok.id,
            "reject": s_reject.id,
            "dedicated": s_dedicated.id,
            "market": s_market.id,
            "synth1": s_synth1.id,
            "synth2": s_synth2.id,
            "featured": s_featured.id,
            "personal": s_personal.id,
        }
        level_ids = {
            lv.level_number: (lv.id, lv.points_threshold)
            for lv in (await session.execute(select(RewardLevel))).scalars()
        }

        # the consent gate on /photos requires a current-version consent record
        from app.models.consent import ConsentRecord
        from app.services.consent import CURRENT_POLICY_VERSION, get_consent

        for u in (actor, admin_user, other):
            record = await get_consent(session, u.id)
            if record is None or record.policy_version != CURRENT_POLICY_VERSION:
                session.add(
                    ConsentRecord(
                        user_id=u.id,
                        policy_version=CURRENT_POLICY_VERSION,
                        consented_at=datetime.now(timezone.utc),
                        data_storage_consent=True,
                        photo_processing_consent=True,
                        location_consent=False,
                    )
                )
        await session.commit()
        actor_id, admin_id, other_id = actor.id, admin_user.id, other.id

    actor_tok = create_access_token(actor_id)
    admin_tok = create_access_token(admin_id)
    other_tok = create_access_token(other_id)

    async with httpx.AsyncClient(base_url=BASE, timeout=30) as client:
        # ══ Scenario 1 — verification pipeline ══════════════════════
        print("\nScenario 1 — verification pipeline (US1 + US2)")
        r = await upload_photo(client, actor_tok, slot_ids["casual_low"], duration=15)
        check("upload accepted (202)", r.status_code == 202, str(r.status_code))
        c_low = r.json()["completion_id"]
        st = await poll_status(client, actor_tok, c_low)
        check("status lands in pending_verification", st["status"] == "pending_verification", st["status"])

        r = await client.get(
            f"/groups/{group_id}/verification-queue", headers={"Authorization": f"Bearer {admin_tok}"}
        )
        queue = r.json()
        item = next((i for i in queue.get("items", []) if i["completion_id"] == c_low), None)
        check("queue lists the completion", item is not None, str(queue)[:200])
        if item:
            check("queue item has family name + duration 15",
                  bool(item["family_name"]) and item["duration_minutes"] == 15,
                  str(item))
            check("queue item has photo url", bool(item["photo_url"]))

        r = await client.post(
            f"/groups/{group_id}/verification-queue/{c_low}/approve",
            headers={"Authorization": f"Bearer {admin_tok}"},
        )
        check("approve under-30-min casual → 0 points",
              r.status_code == 200 and r.json()["points_awarded"] == 0, r.text[:200])

        r = await upload_photo(client, actor_tok, slot_ids["casual_ok"], duration=45)
        c_ok = r.json()["completion_id"]
        await poll_status(client, actor_tok, c_ok)
        r = await client.post(
            f"/groups/{group_id}/verification-queue/{c_ok}/approve",
            headers={"Authorization": f"Bearer {admin_tok}"},
        )
        check("approve 45-min casual → 3 points",
              r.status_code == 200 and r.json()["points_awarded"] == 3, r.text[:200])

        # duration gate at upload time
        r = await upload_photo(client, actor_tok, slot_ids["synth1"], duration=None)
        check("casual upload without duration rejected (400 duration_required)",
              r.status_code == 400 and r.json().get("code") == "duration_required", r.text[:200])

        # reject + re-upload cycle
        r = await upload_photo(client, actor_tok, slot_ids["reject"], duration=45)
        c_rej = r.json()["completion_id"]
        await poll_status(client, actor_tok, c_rej)
        r = await client.post(
            f"/groups/{group_id}/verification-queue/{c_rej}/reject",
            json={"reason": "Foto zeigt die Aktivität nicht"},
            headers={"Authorization": f"Bearer {admin_tok}"},
        )
        check("reject succeeds with reason", r.status_code == 200 and r.json()["status"] == "rejected", r.text[:200])
        r = await client.get(f"/completions/{c_rej}", headers={"Authorization": f"Bearer {actor_tok}"})
        check("rejected completion exposes rejection_reason",
              r.json().get("rejection_reason") == "Foto zeigt die Aktivität nicht", r.text[:200])

        r = await client.patch(
            f"/completions/{c_rej}/photo",
            files={"image": ("photo.jpg", jpeg_bytes((80, 160, 220)), "image/jpeg")},
            headers={"Authorization": f"Bearer {actor_tok}"},
        )
        check("re-upload on rejected accepted (202)", r.status_code == 202, r.text[:200])
        st = await poll_status(client, actor_tok, c_rej)
        check("re-upload returns to pending_verification, reason cleared",
              st["status"] == "pending_verification" and st.get("rejection_reason") in (None, ""),
              str(st)[:200])

        # re-upload on a verified completion: photo swap, status + ledger unchanged
        async with AsyncSessionLocal() as session:
            ledger_before = (
                await session.execute(select(func.count()).select_from(PointLedgerEntry))
            ).scalar_one()
        r = await client.patch(
            f"/completions/{c_ok}/photo",
            files={"image": ("photo.jpg", jpeg_bytes((40, 200, 120)), "image/jpeg")},
            headers={"Authorization": f"Bearer {actor_tok}"},
        )
        check("re-upload on verified keeps status verified",
              r.status_code == 202 and r.json()["status"] == "verified", r.text[:200])
        async with AsyncSessionLocal() as session:
            ledger_after = (
                await session.execute(select(func.count()).select_from(PointLedgerEntry))
            ).scalar_one()
        check("verified re-upload does not touch the ledger", ledger_before == ledger_after)

        # ══ Scenario 2 — personal challenge auto-approval ═══════════
        print("\nScenario 2 — timed auto-approval on personal challenge")
        r = await upload_photo(client, actor_tok, slot_ids["personal"], duration=45)
        c_pers = r.json()["completion_id"]
        st = await poll_status(client, actor_tok, c_pers)
        check("personal completion pending", st["status"] == "pending_verification", st["status"])
        async with AsyncSessionLocal() as session:
            comp = (
                await session.execute(select(Completion).where(Completion.id == uuid.UUID(c_pers)))
            ).scalar_one()
            comp.completed_at = datetime.now(timezone.utc) - timedelta(hours=25)
            await session.commit()
        async with AsyncSessionLocal() as session:
            approved = await run_auto_approvals(session)
        check("auto-approval sweep approved it", approved >= 1, str(approved))
        async with AsyncSessionLocal() as session:
            comp = (
                await session.execute(select(Completion).where(Completion.id == uuid.UUID(c_pers)))
            ).scalar_one()
            audit = (
                await session.execute(
                    select(PhotoVerification).where(PhotoVerification.completion_id == uuid.UUID(c_pers))
                )
            ).scalar_one()
            pts = (
                await session.execute(
                    select(PointLedgerEntry).where(PointLedgerEntry.completion_id == uuid.UUID(c_pers))
                )
            ).scalar_one_or_none()
        check("status now verified", comp.status == "verified", comp.status)
        check("audit row: auto_approved / timed / no reviewer",
              audit.action == "auto_approved" and audit.policy_type == "timed" and audit.reviewer_user_id is None)
        check("points credited (3)", pts is not None and pts.base_points == 3)

        # ══ Scenario 3 — fixed tiers ════════════════════════════════
        print("\nScenario 3 — fixed point tiers")
        expectations = [
            ("dedicated", slot_ids["dedicated"], None, 6, 0),
            ("market", slot_ids["market"], 15, 15, 0),  # marketplace ignores duration
            ("featured", slot_ids["featured"], 45, 3, 5),
        ]
        for name, sid, dur, base_exp, bonus_exp in expectations:
            r = await upload_photo(client, actor_tok, sid, duration=dur)
            if r.status_code != 202:
                check(f"{name}: upload", False, r.text[:200])
                continue
            cid = r.json()["completion_id"]
            await poll_status(client, actor_tok, cid)
            r = await client.post(
                f"/groups/{group_id}/verification-queue/{cid}/approve",
                headers={"Authorization": f"Bearer {admin_tok}"},
            )
            ok = r.status_code == 200 and r.json()["points_awarded"] == base_exp + bonus_exp
            check(f"{name}: awards {base_exp}+{bonus_exp}", ok, r.text[:200])
            async with AsyncSessionLocal() as session:
                rows = (
                    await session.execute(
                        select(PointLedgerEntry).where(PointLedgerEntry.completion_id == uuid.UUID(cid))
                    )
                ).scalars().all()
            check(
                f"{name}: exactly one ledger row (base {base_exp}, bonus {bonus_exp})",
                len(rows) == 1 and rows[0].base_points == base_exp and rows[0].bonus_points == bonus_exp,
            )
            # replayed approval must not duplicate the ledger row
            r = await client.post(
                f"/groups/{group_id}/verification-queue/{cid}/approve",
                headers={"Authorization": f"Bearer {admin_tok}"},
            )
            async with AsyncSessionLocal() as session:
                n = (
                    await session.execute(
                        select(func.count())
                        .select_from(PointLedgerEntry)
                        .where(PointLedgerEntry.completion_id == uuid.UUID(cid))
                    )
                ).scalar_one()
            check(f"{name}: replayed approval rejected + no duplicate row", r.status_code == 409 and n == 1)

        # ══ Scenario 4 — balance, levels, redemption ════════════════
        print("\nScenario 4 — quarter balance and reward levels")
        r = await client.get("/rewards/balance", headers={"Authorization": f"Bearer {actor_tok}"})
        bal = r.json()
        now = datetime.now(timezone.utc)
        expected_key = f"{now.year}-Q{(now.month - 1) // 3 + 1}"
        # 0 + 3 (S1) + 3 (S2) + 6 + 15 + 8 (S3) = 35
        check("balance endpoint returns current quarter key", bal["quarter_key"] == expected_key, str(bal)[:150])
        check("balance sums the ledger (35)", bal["balance"] == 35, str(bal["balance"]))
        check("4 levels present", len(bal["levels"]) == 4)

        # boost past Level 4 threshold with a synthetic verified completion + ledger row
        async with AsyncSessionLocal() as session:
            synth = Completion(
                challenge_activity_id=slot_ids["synth1"],
                family_id=actor_family_id,
                completed_by_user_id=actor_id,
                status="self_reported",
                completed_on=now.date(),
                shared_to_feed=False,
                completed_at=now,
            )
            session.add(synth)
            await session.flush()
            session.add(
                PointLedgerEntry(
                    family_id=actor_family_id,
                    completion_id=synth.id,
                    base_points=220,
                    bonus_points=0,
                    awarded_at=now,
                )
            )
            await session.commit()

        r = await client.get("/rewards/balance", headers={"Authorization": f"Bearer {actor_tok}"})
        bal = r.json()
        check("boosted balance is 255", bal["balance"] == 255, str(bal["balance"]))
        states = {lv["level_number"]: lv["state"] for lv in bal["levels"]}
        check("all levels unlocked at 255", all(s == "unlocked" for s in states.values()), str(states))

        l1, _ = level_ids[1]
        r = await client.post(
            f"/rewards/levels/{l1}/redeem", json={}, headers={"Authorization": f"Bearer {actor_tok}"}
        )
        check("Level 1 redeems (201, BOND- code)",
              r.status_code == 201 and r.json()["voucher_code"].startswith("BOND-"), r.text[:200])
        r2 = await client.get("/rewards/balance", headers={"Authorization": f"Bearer {actor_tok}"})
        check("redemption does not debit the balance", r2.json()["balance"] == 255, str(r2.json()["balance"]))
        check("Level 1 now redeemed_this_quarter",
              next(lv["state"] for lv in r2.json()["levels"] if lv["level_number"] == 1) == "redeemed_this_quarter")
        r = await client.post(
            f"/rewards/levels/{l1}/redeem", json={}, headers={"Authorization": f"Bearer {actor_tok}"}
        )
        check("second Level 1 redemption blocked (409)",
              r.status_code == 409 and r.json().get("code") == "already_redeemed_this_quarter", r.text[:200])

        l3, _ = level_ids[3]
        r = await client.post(
            f"/rewards/levels/{l3}/redeem", json={}, headers={"Authorization": f"Bearer {actor_tok}"}
        )
        check("Level 3 without choice → 400 choice_required",
              r.status_code == 400 and r.json().get("code") == "choice_required", r.text[:200])
        r = await client.post(
            f"/rewards/levels/{l3}/redeem",
            json={"chosen_option": "supermarket_voucher"},
            headers={"Authorization": f"Bearer {actor_tok}"},
        )
        check("Level 3 with choice succeeds and echoes it",
              r.status_code == 201 and r.json()["chosen_option"] == "supermarket_voucher", r.text[:200])

        l4, _ = level_ids[4]
        async with AsyncSessionLocal() as session:
            for q in ("Q1", "Q2"):  # plus the live one below = 3, then 4th attempt fails
                session.add(
                    Redemption(
                        family_id=actor_family_id,
                        reward_level_id=l4,
                        quarter_key=f"{now.year}-{q}",
                        chosen_option=None,
                        points_at_redemption=255,
                        voucher_code="BOND-SEEDED",
                        redeemed_at=now.replace(month=1 if q == "Q1" else 4, day=15),
                    )
                )
            await session.commit()
        r = await client.post(
            f"/rewards/levels/{l4}/redeem", json={}, headers={"Authorization": f"Bearer {actor_tok}"}
        )
        check("Level 4 third redemption of the year succeeds", r.status_code == 201, r.text[:200])
        # 4th within the calendar year — different quarter uniqueness is not the blocker, the cap is
        async with AsyncSessionLocal() as session:
            live = (
                await session.execute(
                    select(Redemption).where(
                        Redemption.reward_level_id == l4,
                        Redemption.quarter_key == expected_key,
                    )
                )
            ).scalar_one()
            live.quarter_key = f"{now.year}-QX"  # free the quarter slot so only the annual cap can block
            await session.commit()
        r = await client.post(
            f"/rewards/levels/{l4}/redeem", json={}, headers={"Authorization": f"Bearer {actor_tok}"}
        )
        check("Level 4 fourth redemption in the year blocked (409 annual_cap)",
              r.status_code == 409 and r.json().get("code") == "annual_cap_reached", r.text[:200])

        # ══ Scenario 5 — quarter isolation ══════════════════════════
        print("\nScenario 5 — quarter isolation")
        async with AsyncSessionLocal() as session:
            synth2 = Completion(
                challenge_activity_id=slot_ids["synth2"],
                family_id=actor_family_id,
                completed_by_user_id=actor_id,
                status="self_reported",
                completed_on=now.date(),
                shared_to_feed=False,
                completed_at=now,
            )
            session.add(synth2)
            await session.flush()
            session.add(
                PointLedgerEntry(
                    family_id=actor_family_id,
                    completion_id=synth2.id,
                    base_points=500,
                    bonus_points=0,
                    awarded_at=now - timedelta(days=120),  # safely in a previous quarter
                )
            )
            await session.commit()
        r = await client.get("/rewards/balance", headers={"Authorization": f"Bearer {actor_tok}"})
        check("previous-quarter ledger entries do not count", r.json()["balance"] == 255, str(r.json()["balance"]))

        # ══ Scenario 6 — privacy ════════════════════════════════════
        print("\nScenario 6 — privacy")
        r = await client.get("/rewards/balance", headers={"Authorization": f"Bearer {other_tok}"})
        check("other family sees only its own balance (not 255)",
              r.status_code == 200 and r.json()["balance"] != 255, r.text[:150])
        r = await client.get(
            f"/groups/{group_id}/verification-queue", headers={"Authorization": f"Bearer {other_tok}"}
        )
        check("non-admin cannot read the verification queue (403)", r.status_code == 403, str(r.status_code))

    passed = sum(1 for ok, _ in RESULTS if ok)
    failed = [(name) for ok, name in RESULTS if not ok]
    print(f"\n{'=' * 60}\n{passed}/{len(RESULTS)} checks passed")
    if failed:
        print("FAILED:")
        for name in failed:
            print(f"  ❌ {name}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
