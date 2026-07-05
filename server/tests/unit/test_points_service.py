import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from app.services import points


def _activity(cost_indicator="free", is_partner_content=False, effort_tier="casual"):
    return SimpleNamespace(
        cost_indicator=cost_indicator,
        is_partner_content=is_partner_content,
        effort_tier=effort_tier,
    )


def _challenge(is_featured=False):
    return SimpleNamespace(is_featured=is_featured)


def _completion(status="verified", duration_minutes=60):
    return SimpleNamespace(
        id=uuid.uuid4(),
        family_id=uuid.uuid4(),
        challenge_activity_id=uuid.uuid4(),
        status=status,
        duration_minutes=duration_minutes,
    )


class TestResolveTier:
    def test_casual(self):
        assert points.resolve_tier(_activity()) == "casual"

    def test_dedicated(self):
        assert points.resolve_tier(_activity(effort_tier="dedicated")) == "dedicated"

    def test_paid_is_marketplace(self):
        assert points.resolve_tier(_activity(cost_indicator="paid")) == "marketplace"

    def test_partner_content_is_marketplace(self):
        # partner content wins even when the stored tier says dedicated
        assert points.resolve_tier(_activity(is_partner_content=True, effort_tier="dedicated")) == "marketplace"


class TestComputePoints:
    def test_casual_at_gate(self):
        assert points.compute_points(_activity(), _challenge(), 30) == (3, 0)

    def test_casual_above_gate(self):
        assert points.compute_points(_activity(), _challenge(), 90) == (3, 0)

    def test_casual_under_30_minutes_earns_zero(self):
        assert points.compute_points(_activity(), _challenge(), 29) == (0, 0)

    def test_casual_without_duration_earns_zero(self):
        assert points.compute_points(_activity(), _challenge(), None) == (0, 0)

    def test_dedicated_ignores_duration(self):
        assert points.compute_points(_activity(effort_tier="dedicated"), _challenge(), None) == (6, 0)

    def test_marketplace(self):
        assert points.compute_points(_activity(cost_indicator="paid"), _challenge(), None) == (15, 0)

    def test_featured_bonus(self):
        assert points.compute_points(_activity(effort_tier="dedicated"), _challenge(is_featured=True), None) == (6, 5)

    def test_featured_bonus_applies_even_at_zero_base(self):
        assert points.compute_points(_activity(), _challenge(is_featured=True), 10) == (0, 5)


class TestAwardPoints:
    async def test_awards_base_plus_bonus(self, monkeypatch):
        monkeypatch.setattr(
            points,
            "get_completion_context",
            AsyncMock(return_value=(_activity(effort_tier="dedicated"), _challenge(is_featured=True))),
        )
        repo = MagicMock()
        repo.create_ledger_entry = AsyncMock(return_value=True)
        monkeypatch.setattr(points, "RewardsRepository", lambda session: repo)

        awarded = await points.award_points(AsyncMock(), _completion())
        assert awarded == 11
        repo.create_ledger_entry.assert_awaited_once()

    async def test_duplicate_award_is_idempotent(self, monkeypatch):
        """A completion whose ledger entry already exists awards nothing."""
        monkeypatch.setattr(
            points,
            "get_completion_context",
            AsyncMock(return_value=(_activity(effort_tier="dedicated"), _challenge())),
        )
        repo = MagicMock()
        # unique constraint on completion_id hit → repository reports no insert
        repo.create_ledger_entry = AsyncMock(return_value=False)
        monkeypatch.setattr(points, "RewardsRepository", lambda session: repo)

        assert await points.award_points(AsyncMock(), _completion()) == 0

    async def test_self_reported_never_earns(self, monkeypatch):
        context = AsyncMock()
        monkeypatch.setattr(points, "get_completion_context", context)

        assert await points.award_points(AsyncMock(), _completion(status="self_reported")) == 0
        context.assert_not_awaited()
