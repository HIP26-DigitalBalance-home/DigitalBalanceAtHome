"""Photo verification: admin queue, approve/reject actions, timed auto-approval.

Approval is the single place points are awarded (US2 → US3 wiring): a
completion earns its ledger entry the moment it flips to verified, whether by
an admin or by the timed policy on personal challenges.
"""

import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.models.challenge import Challenge, ChallengeActivity
from app.models.completion import Completion
from app.repositories.group import GroupRepository
from app.repositories.rewards import RewardsRepository
from app.services import points
from app.services.exceptions import (
    CompletionNotPending,
    GroupNotFound,
    NotGroupAdmin,
)
from app.services.localization import pick
from app.services.verification_policy import TimedVerificationPolicy, get_policy

logger = structlog.get_logger()


async def _require_group_admin(session: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID) -> None:
    repo = GroupRepository(session)
    group = await repo.get_by_id(group_id)
    if not group:
        raise GroupNotFound(f"Group {group_id} not found")
    admin = await repo.get_admin(group_id, user_id)
    if not admin:
        raise NotGroupAdmin("Only group admins can review completion photos")


async def _get_pending_group_completion(
    session: AsyncSession, group_id: uuid.UUID, completion_id: uuid.UUID
) -> Completion:
    """The completion must belong to one of the group's challenges and still be pending."""
    result = await session.execute(
        select(Completion)
        .join(ChallengeActivity, Completion.challenge_activity_id == ChallengeActivity.id)
        .join(Challenge, ChallengeActivity.challenge_id == Challenge.id)
        .where(Completion.id == completion_id, Challenge.group_id == group_id)
    )
    completion = result.scalar_one_or_none()
    if not completion:
        raise CompletionNotPending(f"Completion {completion_id} not found in this group's challenges")
    if completion.status != "pending_verification":
        raise CompletionNotPending("Only pending completions can be reviewed")
    return completion


async def get_queue(
    session: AsyncSession,
    admin_user_id: uuid.UUID,
    group_id: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
    language: str = "de",
) -> dict:
    await _require_group_admin(session, group_id, admin_user_id)

    repo = RewardsRepository(session)
    rows, total = await repo.list_pending_verifications(group_id, limit, offset)

    items = []
    for completion, title, title_en, family_name in rows:
        photo_url = None
        if completion.photo_key:
            try:
                photo_url = storage.generate_presigned_url(completion.photo_key, expires=900)
            except Exception:
                pass
        items.append(
            {
                "completion_id": completion.id,
                # Family.name is nullable; the queue schema requires a string
                "family_name": family_name or "Familie",
                "activity_title": pick(title, title_en, language),
                "photo_url": photo_url,
                "duration_minutes": completion.duration_minutes,
                "submitted_at": completion.completed_at,
            }
        )
    return {"items": items, "total": total}


async def approve(
    session: AsyncSession, admin_user_id: uuid.UUID, completion_id: uuid.UUID, group_id: uuid.UUID
) -> dict:
    await _require_group_admin(session, group_id, admin_user_id)
    completion = await _get_pending_group_completion(session, group_id, completion_id)

    completion.status = "verified"
    awarded = await points.award_points(session, completion)

    repo = RewardsRepository(session)
    await repo.create_photo_verification(
        completion_id=completion.id,
        reviewer_user_id=admin_user_id,
        action="approved",
        policy_type="manual",
    )
    await session.commit()
    return {"completion_id": completion.id, "status": "verified", "points_awarded": awarded}


async def reject(
    session: AsyncSession,
    admin_user_id: uuid.UUID,
    completion_id: uuid.UUID,
    group_id: uuid.UUID,
    reason: str | None,
) -> dict:
    # A reason is optional; whitespace-only collapses to "no reason given"
    reason = (reason or "").strip() or None

    await _require_group_admin(session, group_id, admin_user_id)
    completion = await _get_pending_group_completion(session, group_id, completion_id)

    completion.status = "rejected"
    repo = RewardsRepository(session)
    await repo.create_photo_verification(
        completion_id=completion.id,
        reviewer_user_id=admin_user_id,
        action="rejected",
        rejection_reason=reason,
        policy_type="manual",
    )
    await session.commit()
    return {"completion_id": completion.id, "status": "rejected", "points_awarded": None}


async def run_auto_approvals(session: AsyncSession) -> int:
    """Verify personal-challenge photos whose timed window has elapsed.

    Uses the timed policy's window as the query cutoff, then re-checks each
    candidate via the policy interface (keeps the policy the single source of
    truth if the factory ever varies per challenge). Returns approvals made.
    """
    policy = TimedVerificationPolicy(hours=24)
    cutoff = datetime.now(timezone.utc) - policy.window

    repo = RewardsRepository(session)
    candidates = await repo.list_overdue_personal_pending(cutoff)

    approved = 0
    for completion in candidates:
        _, challenge = await points.get_completion_context(session, completion)
        challenge_policy = get_policy(challenge)
        if not await challenge_policy.should_auto_approve(completion, challenge, session):
            continue
        completion.status = "verified"
        await points.award_points(session, completion)
        await repo.create_photo_verification(
            completion_id=completion.id,
            reviewer_user_id=None,
            action="auto_approved",
            policy_type=challenge_policy.policy_type,
        )
        approved += 1

    if approved:
        await session.commit()
        logger.info("auto_approvals_completed", count=approved)
    return approved
