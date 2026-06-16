from app.dependencies.language import get_request_language
from app.services.localization import pick


class TestGetRequestLanguage:
    def test_none_defaults_to_de(self):
        assert get_request_language(None) == "de"

    def test_plain_en(self):
        assert get_request_language("en") == "en"

    def test_region_tag(self):
        assert get_request_language("en-US") == "en"

    def test_weighted_list_first_supported_wins(self):
        assert get_request_language("en,de;q=0.9") == "en"

    def test_unsupported_falls_back_to_de(self):
        assert get_request_language("fr-FR,fr;q=0.8") == "de"


class TestPick:
    def test_english_when_available(self):
        assert pick("Hallo", "Hello", "en") == "Hello"

    def test_english_falls_back_to_base_when_missing(self):
        assert pick("Hallo", None, "en") == "Hallo"

    def test_german_always_base(self):
        assert pick("Hallo", "Hello", "de") == "Hallo"
