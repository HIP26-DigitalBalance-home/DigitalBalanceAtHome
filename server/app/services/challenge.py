import uuid
from datetime import date, datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.models.challenge import Challenge, ChallengeActivity
from app.models.completion import Completion
from app.repositories.challenge import ChallengeRepository, _status_from_dates
from app.schemas.generated import CreateChallengeRequest
from app.services.exceptions import (
    ActivityNotFound,
    ChallengeNotFound,
    InvalidDateRange,
    NoFamilyError,
    NotGroupMember,
)
from app.core import storage
from app.services.family import get_user_family


def _activity_dict(a: Activity) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "description": a.description,
        "estimated_duration_minutes": a.estimated_duration_minutes,
        "age_min": a.age_min,
        "age_max": a.age_max,
        "cost_indicator": a.cost_indicator,
        "season_relevance": a.season_relevance,
        "weather_suitability": a.weather_suitability,
        "is_partner_content": a.is_partner_content,
    }


def _completion_dict(c: Completion) -> dict:
    photo_url = None
    if c.status == "ready" and c.photo_key:
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
        "shared_to_feed": c.shared_to_feed,
        "completed_at": c.completed_at,
        "updated_at": c.updated_at,
    }


def _challenge_summary_dict(c: Challenge, today: date, all_slots_filled: bool = False) -> dict:
    if all_slots_filled:
        status = "completed"
    elif c.start_date > today:
        status = "upcoming"
    else:
        status = "active"
    return {
        "id": c.id,
        "title": c.title,
        "description": c.description,
        "group_id": c.group_id,
        "start_date": c.start_date.isoformat(),
        "end_date": c.end_date.isoformat(),
        "display_mode": c.display_mode,
        "status": status,
        "created_at": c.created_at,
    }


async def _build_challenge_with_progress(
    repo: ChallengeRepository,
    challenge: Challenge,
    family_id: uuid.UUID,
) -> dict:
    today = date.today()
    ca_list = await repo.get_challenge_activities(challenge.id)
    ca_ids = [ca.id for ca in ca_list]
    activity_ids = [ca.activity_id for ca in ca_list]

    activities = await repo.get_activities_by_ids(activity_ids)
    activity_map = {a.id: a for a in activities}

    completions = await repo.get_completions_for_family(family_id, ca_ids)
    completion_map = {c.challenge_activity_id: c for c in completions}

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
            "activity": _activity_dict(activity) if activity else {},
            "grid_position": ca.grid_position,
            "completion": _completion_dict(completion) if completion else None,
            "families_completed_count": count_map.get(ca.id, 0) if challenge.group_id else None,
        }
        slots.append(slot)

    all_slots_filled = len(ca_list) > 0 and all(
        ca.id in completion_map for ca in ca_list
    )

    return {
        **_challenge_summary_dict(challenge, today, all_slots_filled=all_slots_filled),
        "activities": slots,
        "group_families_count": group_families_count,
    }


async def create_challenge(
    session: AsyncSession, user_id: uuid.UUID, req: CreateChallengeRequest
) -> dict:
    fm = await get_user_family(session, user_id)
    if not fm:
        raise NoFamilyError("You must create or join a family before creating a challenge")

    start = date.fromisoformat(str(req.start_date))
    end = date.fromisoformat(str(req.end_date))
    if end < start:
        raise InvalidDateRange("end_date must be on or after start_date")

    if req.group_id:
        from app.repositories.group import GroupRepository
        group_repo = GroupRepository(session)
        gm = await group_repo.get_membership(req.group_id, fm.family_id)
        if not gm:
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
        start_date=start,
        end_date=end,
        activity_ids=activity_ids,
    )
    await session.commit()
    await session.refresh(challenge)

    return await _build_challenge_with_progress(repo, challenge, fm.family_id)


async def get_active_challenges(session: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    fm = await get_user_family(session, user_id)
    if not fm:
        return []

    repo = ChallengeRepository(session)
    challenges = await repo.get_all_for_family(fm.family_id, "active")
    return [await _build_challenge_with_progress(repo, c, fm.family_id) for c in challenges]


async def get_my_challenges(
    session: AsyncSession, user_id: uuid.UUID, status_filter: str | None
) -> list[dict]:
    fm = await get_user_family(session, user_id)
    if not fm:
        return []

    repo = ChallengeRepository(session)
    challenges = await repo.get_all_for_family(fm.family_id, status_filter)
    today = date.today()
    result = []
    for c in challenges:
        all_filled = await repo.is_fully_completed_by_family(c.id, fm.family_id)
        summary = _challenge_summary_dict(c, today, all_slots_filled=all_filled)
        if status_filter in ("active", "completed") and summary["status"] != status_filter:
            continue
        result.append(summary)
    return result


async def delete_challenge(
    session: AsyncSession, user_id: uuid.UUID, challenge_id: uuid.UUID
) -> None:
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
    session: AsyncSession, user_id: uuid.UUID, challenge_id: uuid.UUID
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

    return await _build_challenge_with_progress(repo, challenge, fm.family_id)
