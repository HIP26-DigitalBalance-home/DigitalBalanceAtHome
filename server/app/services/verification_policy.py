"""Pluggable auto-approval policies for photo verification.

Group challenges are always manually reviewed by a group admin; personal/family
challenges (no group, hence no admin) auto-approve after a timed window. The
policy abstraction exists so the planned LLM-validation policy ("llm" in
PhotoVerification.policy_type) can slot in without touching the service layer.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.challenge import Challenge
from app.models.completion import Completion


class VerificationPolicy(ABC):
    policy_type: str

    @abstractmethod
    async def should_auto_approve(
        self, completion: Completion, challenge: Challenge, session: AsyncSession
    ) -> bool: ...


class TimedVerificationPolicy(VerificationPolicy):
    """Auto-approve once the photo has sat unreviewed for a fixed window."""

    policy_type = "timed"

    def __init__(self, hours: int = 24) -> None:
        self.hours = hours

    @property
    def window(self) -> timedelta:
        return timedelta(hours=self.hours)

    async def should_auto_approve(self, completion: Completion, challenge: Challenge, session: AsyncSession) -> bool:
        return completion.completed_at + self.window <= datetime.now(timezone.utc)


class NeverAutoApprovePolicy(VerificationPolicy):
    """Group challenges: only an explicit admin action resolves the photo."""

    policy_type = "manual"

    async def should_auto_approve(self, completion: Completion, challenge: Challenge, session: AsyncSession) -> bool:
        return False


def get_policy(challenge: Challenge) -> VerificationPolicy:
    if challenge.group_id is None:
        return TimedVerificationPolicy(hours=24)
    return NeverAutoApprovePolicy()
