from __future__ import annotations

from contracts import PersonaId

SEARCH_QUERY = "matin kim beanie"

COMPETITORS: tuple[dict[str, str], ...] = (
    {"id": "supreme-ribbed-beanie", "name": "Supreme New Era Ribbed Beanie"},
    {"id": "carhartt-watch-beanie", "name": "Carhartt WIP Acrylic Watch Hat"},
    {"id": "stussy-stock-cuff-beanie", "name": "Stussy Stock Cuff Beanie"},
    {"id": "straykids-loverboy-beanie", "name": "Stray Kids Official Loverboy Beanie"},
    {"id": "lesserafim-chaewon-beanie", "name": "LE SSERAFIM Chaewon Beanie"},
    {"id": "basic-acrylic-beanie", "name": "Plain Solid Colour Knitted Beanie"},
    {"id": "wool-blend-cuff-beanie", "name": "Wool Blend Cuffed Beanie"},
)

_BY_ID = {item["id"]: item for item in COMPETITORS}

COMPETITOR_ANALYSIS_BY_PERSONA: dict[PersonaId, tuple[str, ...]] = {
    "xmm": ("lesserafim-chaewon-beanie", "stussy-stock-cuff-beanie"),
    "auntie": ("carhartt-watch-beanie", "basic-acrylic-beanie"),
    "nerd": ("carhartt-watch-beanie", "wool-blend-cuff-beanie"),
    "geek": ("stussy-stock-cuff-beanie", "carhartt-watch-beanie"),
    "insecure": ("carhartt-watch-beanie", "supreme-ribbed-beanie"),
    "budget": ("basic-acrylic-beanie", "wool-blend-cuff-beanie"),
}


def competitors_for_persona(persona: PersonaId) -> tuple[dict[str, str], ...]:
    return tuple(_BY_ID[id_] for id_ in COMPETITOR_ANALYSIS_BY_PERSONA.get(persona, ()))
