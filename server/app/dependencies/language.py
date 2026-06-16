from typing import Optional

from fastapi import Header

SUPPORTED = ("de", "en")
DEFAULT = "de"


def get_request_language(accept_language: Optional[str] = Header(default=None, alias="Accept-Language")) -> str:
    """Resolve the preferred content language from the Accept-Language header.

    Recognises only "de" and "en" (the app's two supported languages). Parsing is
    deliberately simple: the first supported tag found in the header wins;
    anything else falls back to German.
    """
    if not accept_language:
        return DEFAULT
    for part in accept_language.split(","):
        tag = part.split(";")[0].strip().lower()
        primary = tag.split("-")[0]
        if primary in SUPPORTED:
            return primary
    return DEFAULT
