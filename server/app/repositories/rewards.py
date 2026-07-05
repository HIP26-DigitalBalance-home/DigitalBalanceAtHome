import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.models.challenge import Challenge, ChallengeActivity
from app.models.completion import Completion
from app.models.family import Family
from app.models.rewards import PhotoVerification, PointLedgerEntry, Redemption, RewardLevel


class RewardsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── Point ledger ─────────────────────────────────────────────

    async def create_ledger_entry(
        self,
        family_id: uuid.UUID,
        completion_id: uuid.UUID,
        base_points: int,
        bonus_points: int,
        awarded_at: datetime,
    ) -> bool:
        """Insert a ledger entry for a completion. Returns False if the completion
        already has one (idempotency via the unique constraint on completion_id)."""
        stmt = (
            pg_insert(PointLedgerEntry)
            .values(
                id=uuid.uuid4(),
                family_id=family_id,
                completion_id=completion_id,
                base_points=base_points,
                bonus_points=bonus_points,
                awarded_at=awarded_at,
            )
            .on_conflict_do_nothing(constraint="uq_ledger_completion")
        )
        result = await self.session.execute(stmt)
        return bool(result.rowcount)  # type: ignore[attr-defined]

    async def get_quarter_balance(self, family_id: uuid.UUID, quarter_start: datetime, quarter_end: datetime) -> int:
        result = await self.session.execute(
            select(func.coalesce(func.sum(PointLedgerEntry.base_points + PointLedgerEntry.bonus_points), 0)).where(
                PointLedgerEntry.family_id == family_id,
                PointLedgerEntry.awarded_at >= quarter_start,
                PointLedgerEntry.awarded_at < quarter_end,
            )
        )
        return int(result.scalar_one())

    async def list_quarter_ledger(
        self, family_id: uuid.UUID, quarter_start: datetime, quarter_end: datetime
    ) -> list[PointLedgerEntry]:
        result = await self.session.execute(
            select(PointLedgerEntry)
            .where(
                PointLedgerEntry.family_id == family_id,
                PointLedgerEntry.awarded_at >= quarter_start,
                PointLedgerEntry.awarded_at < quarter_end,
            )
            .order_by(PointLedgerEntry.awarded_at.desc())
        )
        return list(result.scalars().all())

    # ── Verification queue + audit ───────────────────────────────

    async def list_pending_verifications(
        self, group_id: uuid.UUID, limit: int = 20, offset: int = 0
    ) -> tuple[list[tuple[Completion, str, str | None, str | None]], int]:
        """Return ((Completion, activity_title, activity_title_en, family_name), total)
        for pending_verification completions in the group's challenges."""
        base_where = (
            Challenge.group_id == group_id,
            Completion.status == "pending_verification",
        )
        stmt = (
            select(Completion, Activity.title, Activity.title_en, Family.name)
            .join(ChallengeActivity, Completion.challenge_activity_id == ChallengeActivity.id)
            .join(Challenge, ChallengeActivity.challenge_id == Challenge.id)
            .join(Activity, ChallengeActivity.activity_id == Activity.id)
            .join(Family, Completion.family_id == Family.id)
            .where(*base_where)
            .order_by(Completion.completed_at.asc())
            .limit(limit)
            .offset(offset)
        )
        count_stmt = (
            select(func.count())
            .select_from(Completion)
            .join(ChallengeActivity, Completion.challenge_activity_id == ChallengeActivity.id)
            .join(Challenge, ChallengeActivity.challenge_id == Challenge.id)
            .where(*base_where)
        )
        rows = list((await self.session.execute(stmt)).tuples().all())
        total = int((await self.session.execute(count_stmt)).scalar_one())
        return rows, total

    async def list_overdue_personal_pending(self, cutoff: datetime) -> list[Completion]:
        """pending_verification completions on personal challenges (no group) whose
        photo was submitted at or before the cutoff — candidates for timed auto-approval."""
        result = await self.session.execute(
            select(Completion)
            .join(ChallengeActivity, Completion.challenge_activity_id == ChallengeActivity.id)
            .join(Challenge, ChallengeActivity.challenge_id == Challenge.id)
            .where(
                Challenge.group_id.is_(None),
                Completion.status == "pending_verification",
                Completion.completed_at <= cutoff,
            )
        )
        return list(result.scalars().all())

    async def create_photo_verification(
        self,
        completion_id: uuid.UUID,
        reviewer_user_id: uuid.UUID | None,
        action: str,
        policy_type: str,
        rejection_reason: str | None = None,
        reviewed_at: datetime | None = None,
    ) -> PhotoVerification:
        record = PhotoVerification(
            completion_id=completion_id,
            reviewer_user_id=reviewer_user_id,
            action=action,
            rejection_reason=rejection_reason,
            policy_type=policy_type,
            reviewed_at=reviewed_at or datetime.now(timezone.utc),
        )
        self.session.add(record)
        await self.session.flush()
        return record

    async def get_latest_rejection_reasons(self, completion_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
        """Map completion_id -> most recent rejection reason, for the given completions."""
        if not completion_ids:
            return {}
        result = await self.session.execute(
            select(PhotoVerification.completion_id, PhotoVerification.rejection_reason)
            .where(
                PhotoVerification.completion_id.in_(completion_ids),
                PhotoVerification.action == "rejected",
            )
            .order_by(PhotoVerification.completion_id, PhotoVerification.reviewed_at.asc())
        )
        reasons: dict[uuid.UUID, str] = {}
        for completion_id, reason in result.tuples().all():
            if reason is not None:
                reasons[completion_id] = reason  # later rows overwrite: latest wins
        return reasons

    # ── Reward levels + redemptions ──────────────────────────────

    async def list_reward_levels(self) -> list[RewardLevel]:
        result = await self.session.execute(select(RewardLevel).order_by(RewardLevel.level_number.asc()))
        return list(result.scalars().all())

    async def get_reward_level(self, level_id: uuid.UUID) -> RewardLevel | None:
        result = await self.session.execute(select(RewardLevel).where(RewardLevel.id == level_id))
        return result.scalar_one_or_none()

    async def list_family_redemptions_quarter(self, family_id: uuid.UUID, quarter_key: str) -> list[Redemption]:
        result = await self.session.execute(
            select(Redemption).where(
                Redemption.family_id == family_id,
                Redemption.quarter_key == quarter_key,
            )
        )
        return list(result.scalars().all())

    async def count_family_redemptions_year(
        self, family_id: uuid.UUID, reward_level_id: uuid.UUID, year_start: datetime, year_end: datetime
    ) -> int:
        result = await self.session.execute(
            select(func.count())
            .select_from(Redemption)
            .where(
                Redemption.family_id == family_id,
                Redemption.reward_level_id == reward_level_id,
                Redemption.redeemed_at >= year_start,
                Redemption.redeemed_at < year_end,
            )
        )
        return int(result.scalar_one())

    async def create_redemption(
        self,
        family_id: uuid.UUID,
        reward_level_id: uuid.UUID,
        quarter_key: str,
        chosen_option: str | None,
        points_at_redemption: int,
        voucher_code: str,
        redeemed_at: datetime,
    ) -> Redemption:
        redemption = Redemption(
            family_id=family_id,
            reward_level_id=reward_level_id,
            quarter_key=quarter_key,
            chosen_option=chosen_option,
            points_at_redemption=points_at_redemption,
            voucher_code=voucher_code,
            redeemed_at=redeemed_at,
        )
        self.session.add(redemption)
        await self.session.flush()
        return redemption
