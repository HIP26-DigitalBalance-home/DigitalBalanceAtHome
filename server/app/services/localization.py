"""Helpers for serving curated content in the requested language.

Content has a base title/description (German for curated/seeded data, or whatever
the user typed for their own content) plus optional English columns. When English
is requested and a translation exists, it wins; otherwise we fall back to the base.
"""


def pick(base: str | None, english: str | None, language: str) -> str | None:
    if language == "en" and english:
        return english
    return base
