import uuid
from unittest.mock import MagicMock


def _fake_preset(name: str, sort_order: int) -> MagicMock:
    p = MagicMock()
    p.id = uuid.uuid4()
    p.name = name
    p.description = f"{name} description"
    p.name_en = None
    p.description_en = None
    p.activity_ids = [uuid.uuid4() for _ in range(9)]
    p.sort_order = sort_order
    return p


class TestListCollagePresets:
    async def test_requires_auth(self, client):
        response = await client.get("/collage-presets")
        assert response.status_code in (401, 403)

    async def test_returns_ordered_presets(self, auth_client, mocker):
        presets = [_fake_preset("Outdoor-Abenteuer", 0), _fake_preset("Kreative Familie", 1)]
        mocker.patch(
            "app.api.collage_presets.CollagePresetRepository.list_all",
            return_value=presets,
        )

        response = await auth_client.get("/collage-presets")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "Outdoor-Abenteuer"
        assert len(data[0]["activity_ids"]) == 9

    async def test_english_requested_returns_english(self, auth_client, mocker):
        p = _fake_preset("Outdoor-Abenteuer", 0)
        p.name_en = "Outdoor Adventures"
        p.description_en = "Get out into the fresh air."
        mocker.patch(
            "app.api.collage_presets.CollagePresetRepository.list_all",
            return_value=[p],
        )

        response = await auth_client.get("/collage-presets", headers={"Accept-Language": "en"})

        assert response.status_code == 200
        data = response.json()
        assert data[0]["name"] == "Outdoor Adventures"
        assert data[0]["description"] == "Get out into the fresh air."
