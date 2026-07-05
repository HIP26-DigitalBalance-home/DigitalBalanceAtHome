import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.models.activity import Activity
from app.models.challenge import Challenge
from app.models.completion import Completion
from app.repositories.challenge import ChallengeRepository
from app.schemas.generated import CreateChallengeRequest
from app.services.exceptions import (
    ActivityNotFound,
    ChallengeNotFound,
    NoFamilyError,
    NotGroupMember,
)
from app.services.family import get_user_family
from app.services.localization import pick


def _activity_dict(a: Activity, language: str = "de") -> dict:
    return {
        "id": a.id,
        "title": pick(a.title, a.title_en, language),
        "description": pick(a.description, a.description_en, language),
        "estimated_duration_minutes": a.estimated_duration_minutes,
        "age_min": a.age_min,
        "age_max": a.age_max,
        "cost_indicator": a.cost_indicator,
        "season_relevance": a.season_relevance,
        "weather_suitability": a.weather_suitability,
        "is_partner_content": a.is_partner_content,
        "effort_tier": a.effort_tier,
        "language": a.language,
    }


def _completion_dict(c: Completion) -> dict:
    photo_url = None
    if c.status in ("pending_verification", "verified", "rejected") and c.photo_key:
        try:
            photo_url = storage.generate_presigned_url(c.photo_key, expires=900)
        except Exception:
            pass
    return {
        "id": c.id,
        "challenge_activity_id": c.challenge_activity_id,
        "family_id": c.family_id,
        "completed_by_user_id": c.completed_by_user_id,
        "status": c.status,
        "photo_url": photo_url,
        "caption": c.caption,
        "duration_minutes": c.duration_minutes,
        "shared_to_feed": c.shared_to_feed,
        "completed_at": c.completed_at,
        "updated_at": c.updated_at,
    }


def _challenge_summary_dict(c: Challenge, all_slots_filled: bool = False, language: str = "de") -> dict:
    # Challenges have no dates: active until every slot is filled, then completed.
    return {
        "id": c.id,
        "title": pick(c.title, c.title_en, language),
        "description": pick(c.description, c.description_en, language),
        "group_id": c.group_id,
        "display_mode": c.display_mode,
        "status": "completed" if all_slots_filled else "active",
        "is_private": c.is_private,
        "is_featured": c.is_featured,
        "created_at": c.created_at,
    }


def _participant_dict(p, display_name: str) -> dict:
    return {
        "user_id": p.user_id,
        "display_name": display_name,
        "family_id": p.family_id,
        "invited_by_user_id": p.invited_by_user_id,
        "created_at": p.created_at,
    }


async def _build_challenge_with_progress(
    repo: ChallengeRepository,
    challenge: Challenge,
    family_id: uuid.UUID,
    language: str = "de",
) -> dict:
    ca_list = await repo.get_challenge_activities(challenge.id)
    ca_ids = [ca.id for ca in ca_list]
    activity_ids = [ca.activity_id for ca in ca_list]

    activities = await repo.get_activities_by_ids(activity_ids)
    activity_map = {a.id: a for a in activities}

    # Invited friends fill the collage together with the creating family:
    # completions from every collaborating family count towards the same grid.
    collaborator_ids = {challenge.created_by_family_id, *(await repo.get_participant_family_ids(challenge.id))}
    if family_id not in collaborator_ids:
        collaborator_ids = {family_id}
    completions = await repo.get_completions_for_families(list(collaborator_ids), ca_ids)
    # Earliest completion wins the slot if two families completed it
    completion_map: dict = {}
    for c in sorted(completions, key=lambda c: c.completed_at):
        completion_map.setdefault(c.challenge_activity_id, c)

    count_map = await repo.get_families_completed_count_per_slot(ca_ids)

    group_families_count = None
    if challenge.group_id:
        group_families_count = await repo.get_group_family_count(challenge.group_id)

    slots = []
    for ca in ca_list:
        activity = activity_map.get(ca.activity_id)
        completion = completion_map.get(ca.id)
        slot: dict = {
            "id": ca.id,
            "activity_id": ca.activity_id,
            "activity": _activity_dict(activity, language) if activity else {},
            "grid_position": ca.grid_position,
            "completion": _completion_dict(completion) if completion else None,
            "families_completed_count": count_map.get(ca.id, 0) if challenge.group_id else None,
        }
        slots.append(slot)

    all_slots_filled = len(ca_list) > 0 and all(ca.id in completion_map for ca in ca_list)

    return {
        **_challenge_summary_dict(challenge, all_slots_filled=all_slots_filled, language=language),
        "activities": slots,
        "group_families_count": group_families_count,
        "shared_group_ids": await repo.get_shared_group_ids(challenge.id),
    }


async def create_challenge(
    session: AsyncSession, user_id: uuid.UUID, req: CreateChallengeRequest, language: str = "de"
) -> dict:
    fm = await get_user_family(session, user_id)
    if not fm:
        raise NoFamilyError("You must create or join a family before creating a challenge")

    from app.repositories.group import GroupRepository

    group_repo = GroupRepository(session)

    if req.group_id:
        gm = await group_repo.get_membership(req.group_id, fm.family_id)
        if not gm:
            raise NotGroupMember("Your family is not a member of this group")

    # Photos may only be shared to feeds of groups the family belongs to
    shared_group_ids = [uuid.UUID(str(gid)) for gid in req.shared_group_ids or []]
    for gid in shared_group_ids:
        if not await group_repo.get_membership(gid, fm.family_id):
            raise NotGroupMember("Your family is not a member of this group")

    # Validate all activity IDs exist
    repo = ChallengeRepository(session)
    activity_ids = [uuid.UUID(str(aid)) for aid in req.activity_ids]
    activities = await repo.get_activities_by_ids(activity_ids)
    found_ids = {a.id for a in activities}
    missing = [aid for aid in activity_ids if aid not in found_ids]
    if missing:
        raise ActivityNotFound(f"Activities not found: {missing}")

    challenge = await repo.create(
        title=req.title,
        description=req.description,
        group_id=uuid.UUID(str(req.group_id)) if req.group_id else None,
        created_by_family_id=fm.family_id,
        activity_ids=activity_ids,
        is_private=req.is_private if req.is_private is not None else True,
        shared_group_ids=shared_group_ids,
    )
    await session.commit()
    await session.refresh(challenge)

    return await _build_challenge_with_progress(repo, challenge, fm.family_id, language)


async def get_active_challenges(session: AsyncSession, user_id: uuid.UUID, language: str = "de") -> list[dict]:
    fm = await get_user_family(session, user_id)
    if not fm:
        return []

    repo = ChallengeRepository(session)
    challenges = await repo.get_all_for_family(fm.family_id)
    built = [await _build_challenge_with_progress(repo, c, fm.family_id, language) for c in challenges]
    return [b for b in built if b["status"] == "active"]


async def get_my_challenges(
    session: AsyncSession, user_id: uuid.UUID, status_filter: str | None, language: str = "de"
) -> list[dict]:
    fm = await get_user_family(session, user_id)
    if not fm:
        return []

    repo = ChallengeRepository(session)
    challenges = await repo.get_all_for_family(fm.family_id)
    result = []
    for c in challenges:
        collaborator_ids = {c.created_by_family_id, *(await repo.get_participant_family_ids(c.id))}
        if fm.family_id not in collaborator_ids:
            collaborator_ids = {fm.family_id}
        all_filled = await repo.is_fully_completed_by_families(c.id, list(collaborator_ids))
        summary = _challenge_summary_dict(c, all_slots_filled=all_filled, language=language)
        if status_filter in ("active", "completed") and summary["status"] != status_filter:
            continue
        result.append(summary)
    return result


async def delete_challenge(session: AsyncSession, user_id: uuid.UUID, challenge_id: uuid.UUID) -> None:
    fm = await get_user_family(session, user_id)
    if not fm:
        raise ChallengeNotFound("Challenge not found")

    repo = ChallengeRepository(session)
    challenge = await repo.get_by_id(challenge_id)
    if not challenge:
        raise ChallengeNotFound(f"Challenge {challenge_id} not found")

    # Only the family that created the challenge can delete it
    if challenge.created_by_family_id != fm.family_id:
        raise ChallengeNotFound("Challenge not found")

    await session.delete(challenge)
    await session.commit()


async def get_challenge(
    session: AsyncSession, user_id: uuid.UUID, challenge_id: uuid.UUID, language: str = "de"
) -> dict:
    fm = await get_user_family(session, user_id)
    if not fm:
        raise ChallengeNotFound("Challenge not found")

    repo = ChallengeRepository(session)
    challenge = await repo.get_by_id(challenge_id)
    if not challenge:
        raise ChallengeNotFound(f"Challenge {challenge_id} not found")

    accessible = await repo.is_accessible(challenge, fm.family_id)
    if not accessible:
        raise ChallengeNotFound("Challenge not found")

    return await _build_challenge_with_progress(repo, challenge, fm.family_id, language)


async def _get_accessible_challenge(
    session: AsyncSession, user_id: uuid.UUID, challenge_id: uuid.UUID
) -> tuple[ChallengeRepository, Challenge, uuid.UUID]:
    fm = await get_user_family(session, user_id)
    if not fm:
        raise ChallengeNotFound("Challenge not found")

    repo = ChallengeRepository(session)
    challenge = await repo.get_by_id(challenge_id)
    if not challenge or not await repo.is_accessible(challenge, fm.family_id):
        raise ChallengeNotFound("Challenge not found")
    return repo, challenge, fm.family_id


async def update_challenge(
    session: AsyncSession,
    user_id: uuid.UUID,
    challenge_id: uuid.UUID,
    is_private: bool | None,
    language: str = "de",
) -> dict:
    repo, challenge, family_id = await _get_accessible_challenge(session, user_id, challenge_id)

    if is_private is not None:
        challenge.is_private = is_private
        await session.commit()
        await session.refresh(challenge)

    return await _build_challenge_with_progress(repo, challenge, family_id, language)


async def get_participants(session: AsyncSession, user_id: uuid.UUID, challenge_id: uuid.UUID) -> list[dict]:
    repo, challenge, _ = await _get_accessible_challenge(session, user_id, challenge_id)
    rows = await repo.get_participants_with_users(challenge.id)
    return [_participant_dict(p, display_name) for p, display_name in rows]


async def invite_participant(
    session: AsyncSession, user_id: uuid.UUID, challenge_id: uuid.UUID, target_user_id: uuid.UUID
) -> dict:
    from app.repositories.group import GroupRepository
    from app.repositories.notification import NotificationRepository
    from app.repositories.user import UserRepository
    from app.services.exceptions import AlreadyParticipant, NotFriend, UserNotFound

    repo, challenge, family_id = await _get_accessible_challenge(session, user_id, challenge_id)

    target_user = await UserRepository(session).get_by_id(target_user_id)
    if not target_user:
        raise UserNotFound("User not found")

    target_fm = await get_user_family(session, target_user_id)
    if not target_fm:
        raise NotFriend("This parent has no family yet and cannot be invited")

    if target_fm.family_id == challenge.created_by_family_id or target_fm.family_id == family_id:
        raise AlreadyParticipant("This parent's family already has access to this collage")

    # Only parents who share at least one group with the inviter count as friends
    group_repo = GroupRepository(session)
    if not await group_repo.families_share_group(family_id, target_fm.family_id):
        raise NotFriend("You can only invite parents who share a group with you")

    if await repo.get_participant(challenge.id, target_user_id):
        raise AlreadyParticipant("This parent has already been invited")

    participant = await repo.add_participant(
        challenge_id=challenge.id,
        user_id=target_user_id,
        family_id=target_fm.family_id,
        invited_by_user_id=user_id,
    )
    await NotificationRepository(session).create(
        user_id=target_user_id,
        type="challenge_invite",
        actor_user_id=user_id,
        challenge_id=challenge.id,
    )
    await session.commit()

    return _participant_dict(participant, target_user.display_name)
