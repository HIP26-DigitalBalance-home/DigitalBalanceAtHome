import uuid
from unittest.mock import MagicMock


def _fake_preset(name: str, sort_order: int) -> MagicMock:
    p = MagicMock()
    p.id = uuid.uuid4()
    p.name = name
    p.description = f"{name} description"
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
