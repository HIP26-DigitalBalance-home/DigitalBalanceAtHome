import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import rewards
from app.services.exceptions import (
    AlreadyRedeemedThisQuarter,
    AnnualCapReached,
    ChoiceRequired,
    LevelLocked,
    RewardLevelNotFound,
)


def _dt(year, month, day):
    return datetime(year, month, day, 12, 0, tzinfo=timezone.utc)


class TestQuarterBounds:
    @pytest.mark.parametrize(
        ("now", "expected_key"),
        [
            (_dt(2026, 1, 1), "2026-Q1"),
            (_dt(2026, 3, 31), "2026-Q1"),
            (_dt(2026, 4, 1), "2026-Q2"),
            (_dt(2026, 7, 5), "2026-Q3"),
            (_dt(2026, 12, 31), "2026-Q4"),
        ],
    )
    def test_quarter_key(self, now, expected_key):
        _, _, key = rewards.quarter_bounds(now)
        assert key == expected_key

    def test_q3_bounds(self):
        start, end, _ = rewards.quarter_bounds(_dt(2026, 7, 5))
        assert start == datetime(2026, 7, 1, tzinfo=timezone.utc)
        assert end == datetime(2026, 10, 1, tzinfo=timezone.utc)

    def test_q4_end_rolls_into_next_year(self):
        start, end, _ = rewards.quarter_bounds(_dt(2026, 11, 15))
        assert start == datetime(2026, 10, 1, tzinfo=timezone.utc)
        assert end == datetime(2027, 1, 1, tzinfo=timezone.utc)

    def test_boundary_instant_belongs_to_new_quarter(self):
        start, _, key = rewards.quarter_bounds(datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc))
        assert key == "2026-Q2"
        assert start == datetime(2026, 4, 1, tzinfo=timezone.utc)

    def test_year_bounds(self):
        start, end = rewards.year_bounds(_dt(2026, 7, 5))
        assert start == datetime(2026, 1, 1, tzinfo=timezone.utc)
        assert end == datetime(2027, 1, 1, tzinfo=timezone.utc)


def _level(threshold=150, choice_options=None, annual_cap=None, level_number=3):
    return SimpleNamespace(
        id=uuid.uuid4(),
        level_number=level_number,
        points_threshold=threshold,
        title="Level",
        title_en=None,
        description=None,
        description_en=None,
        choice_options=choice_options,
        annual_redemption_cap=annual_cap,
    )


def _setup(monkeypatch, level, balance=200, quarter_redemptions=None, year_count=0):
    """Patch the family lookup and repository around rewards.redeem()."""
    monkeypatch.setattr(rewards, "get_user_family", AsyncMock(return_value=SimpleNamespace(family_id=uuid.uuid4())))
    repo = MagicMock()
    repo.get_reward_level = AsyncMock(return_value=level)
    repo.get_quarter_balance = AsyncMock(return_value=balance)
    repo.list_family_redemptions_quarter = AsyncMock(return_value=quarter_redemptions or [])
    repo.count_family_redemptions_year = AsyncMock(return_value=year_count)
    repo.create_redemption = AsyncMock(
        return_value=SimpleNamespace(
            id=uuid.uuid4(),
            reward_level_id=level.id if level else uuid.uuid4(),
            chosen_option=None,
            voucher_code="BOND-TEST42",
            redeemed_at=datetime.now(timezone.utc),
        )
    )
    monkeypatch.setattr(rewards, "RewardsRepository", lambda session: repo)
    return repo


class TestRedeem:
    async def test_unknown_level(self, monkeypatch):
        _setup(monkeypatch, level=None)
        with pytest.raises(RewardLevelNotFound):
            await rewards.redeem(AsyncMock(), uuid.uuid4(), uuid.uuid4())

    async def test_locked_level(self, monkeypatch):
        _setup(monkeypatch, _level(threshold=150), balance=100)
        with pytest.raises(LevelLocked):
            await rewards.redeem(AsyncMock(), uuid.uuid4(), uuid.uuid4())

    async def test_already_redeemed_this_quarter(self, monkeypatch):
        level = _level()
        _setup(
            monkeypatch,
            level,
            quarter_redemptions=[SimpleNamespace(reward_level_id=level.id)],
        )
        with pytest.raises(AlreadyRedeemedThisQuarter):
            await rewards.redeem(AsyncMock(), uuid.uuid4(), level.id)

    async def test_choice_required_when_level_has_options(self, monkeypatch):
        level = _level(choice_options=["supermarket_voucher", "streaming_month"])
        _setup(monkeypatch, level)
        with pytest.raises(ChoiceRequired):
            await rewards.redeem(AsyncMock(), uuid.uuid4(), level.id, chosen_option=None)

    async def test_invalid_choice_rejected(self, monkeypatch):
        level = _level(choice_options=["supermarket_voucher", "streaming_month"])
        _setup(monkeypatch, level)
        with pytest.raises(ChoiceRequired):
            await rewards.redeem(AsyncMock(), uuid.uuid4(), level.id, chosen_option="pony")

    async def test_valid_choice_redeems(self, monkeypatch):
        level = _level(choice_options=["supermarket_voucher", "streaming_month"])
        repo = _setup(monkeypatch, level)
        result = await rewards.redeem(AsyncMock(), uuid.uuid4(), level.id, chosen_option="streaming_month")
        assert result["voucher_code"] == "BOND-TEST42"
        assert repo.create_redemption.await_args.kwargs["chosen_option"] == "streaming_month"

    async def test_annual_cap_reached(self, monkeypatch):
        level = _level(annual_cap=3, level_number=4, threshold=250)
        _setup(monkeypatch, level, balance=300, year_count=3)
        with pytest.raises(AnnualCapReached):
            await rewards.redeem(AsyncMock(), uuid.uuid4(), level.id)

    async def test_under_annual_cap_redeems(self, monkeypatch):
        level = _level(annual_cap=3, level_number=4, threshold=250)
        repo = _setup(monkeypatch, level, balance=300, year_count=2)
        result = await rewards.redeem(AsyncMock(), uuid.uuid4(), level.id)
        assert result["voucher_code"] == "BOND-TEST42"
        repo.create_redemption.assert_awaited_once()

    async def test_chosen_option_ignored_without_options(self, monkeypatch):
        level = _level(choice_options=None)
        repo = _setup(monkeypatch, level)
        await rewards.redeem(AsyncMock(), uuid.uuid4(), level.id, chosen_option="whatever")
        assert repo.create_redemption.await_args.kwargs["chosen_option"] is None


class TestVoucherCode:
    def test_format(self):
        code = rewards._generate_voucher_code()
        assert code.startswith("BOND-")
        assert len(code) == 11
        assert all(c in rewards._VOUCHER_ALPHABET for c in code[5:])
