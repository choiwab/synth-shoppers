from __future__ import annotations

from contracts import Recommendation


async def polish_objection(text: str) -> str:
    return text


async def generate_recommendations_fallback(recommendations: list[Recommendation]) -> list[Recommendation]:
    return recommendations

