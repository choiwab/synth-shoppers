"""Pure, browser-free shopper-choice policy for real-mode storefront journeys.

Real-mode agents start at the storefront home, search "beanie", and then freely
pick a product from the results. This module decides — deterministically, per
``(seed, agent_id, persona)`` — which listing a shopper opens, biased toward (but
not guaranteed to land on) the tracked Matin Kim listing. It also produces the
in-character objection used when a shopper buys a competitor instead.

No Playwright / browser-use imports: the driver scrapes the visible search cards
into ``CandidateListing`` views and calls in here, so the whole policy is unit
testable without Chromium. The tracked product's metrics never depend on this —
this only governs WHICH product a free-browsing agent opens; whether that product
is ours determines ``bought`` vs ``chose_competitor``.
"""

from __future__ import annotations

from dataclasses import dataclass

from contracts import PersonaId
from sim.decision import stable_threshold

# Below this price a beanie reads as cheap/likely-unbranded on a Shopee card. The
# committed catalog runs $3.50–$8.90 for unbranded vs $22.90+ for branded, and the
# tracked Matin Kim listing sits at $45.90 — so ~$15 cleanly splits the two tiers.
_CHEAP_PRICE = 15.0

# Every persona gets a pull toward the tracked listing: they searched for it, it
# ranks top, and its card is highlighted. Budget shoppers can still be lured away
# by a much cheaper card; trust-wary ones avoid the suspiciously cheap fakes.
_TARGET_BONUS = 1.0

# How much each dollar above the cheapest visible card hurts a persona's score.
_PRICE_SENSITIVITY: dict[PersonaId, float] = {
    "budget": 0.10,
    "auntie": 0.035,
    "nerd": 0.045,
    "xmm": 0.02,
    "insecure": 0.02,
    "geek": 0.015,
    "high_spender": 0.004,
}

# Diminishing returns: a $40 gap and a $55 gap read about the same to a shopper.
_PRICE_GAP_CAP = 30.0

# How strongly a persona is repelled by a suspiciously-cheap (likely fake) listing.
# Budget is mildly ATTRACTED to cheap (negative = bonus); auntie distrusts the fakes.
_CHEAP_AVERSION: dict[PersonaId, float] = {
    "insecure": 1.6,
    "high_spender": 1.3,
    "geek": 1.2,
    "nerd": 1.0,
    "xmm": 1.0,
    "auntie": 1.0,
    "budget": -0.25,
}


@dataclass(frozen=True)
class CandidateListing:
    """What a shopper can see about one product on the search-results grid."""

    id: str
    title: str
    price: float
    is_target: bool

    @property
    def is_cheap(self) -> bool:
        return self.price < _CHEAP_PRICE


def _jitter(seed: int, agent_id: str, key: str) -> float:
    """Deterministic per-(agent, candidate) noise in [-0.25, 0.25] for variety."""
    return (stable_threshold(seed, agent_id, key) - 0.5) * 0.5  # type: ignore[arg-type]


def _score(seed: int, agent_id: str, persona_id: PersonaId, cand: CandidateListing, cheapest: float) -> float:
    score = _TARGET_BONUS if cand.is_target else 0.0
    score -= _PRICE_SENSITIVITY[persona_id] * min(max(0.0, cand.price - cheapest), _PRICE_GAP_CAP)
    if cand.is_cheap:
        score -= _CHEAP_AVERSION[persona_id]
    score += _jitter(seed, agent_id, f"pick:{cand.id}")
    return score


def choose_listing(
    seed: int,
    agent_id: str,
    persona_id: PersonaId,
    candidates: list[CandidateListing],
) -> str | None:
    """Pick which listing this shopper opens from the search results. Returns the
    chosen listing id (often the tracked target, sometimes a competitor), or None
    if there are no candidates."""
    if not candidates:
        return None
    cheapest = min(c.price for c in candidates)
    best = max(candidates, key=lambda c: _score(seed, agent_id, persona_id, c, cheapest))
    return best.id


def cheaper_alternative(
    seed: int,
    agent_id: str,
    persona_id: PersonaId,
    target_price: float,
    candidates: list[CandidateListing],
) -> CandidateListing | None:
    """A competitor a price-sensitive shopper might jump to mid-funnel (e.g. budget
    sees the tracked listing is pricey and bails to a clearly cheaper card). Returns
    None for personas that don't comparison-bail, when nothing is meaningfully
    cheaper, or — deterministically — most of the time even when one exists."""
    if persona_id not in {"budget", "auntie", "nerd"}:
        return None
    alts = [c for c in candidates if not c.is_target and c.price <= target_price - 5.0]
    if persona_id != "budget":  # auntie/nerd won't trust the suspiciously-cheap fakes
        alts = [c for c in alts if not c.is_cheap]
    if not alts:
        return None
    if stable_threshold(seed, agent_id, "divert:price") > 0.5:  # type: ignore[arg-type]
        return None
    return min(alts, key=lambda c: c.price)


def competitor_objection(persona_id: PersonaId, competitor: CandidateListing) -> str:
    """In-character line for a shopper who buys a competitor instead of the target."""
    title = competitor.title.strip()
    price = f"${competitor.price:.2f}"
    if competitor.is_cheap:
        if persona_id == "budget":
            return f"Cheaper one also can lah — {price} for '{title}', why pay so much more."
        return f"This '{title}' damn cheap at {price}, just grab that one."
    return f"'{title}' at {price} looks like the better buy — going with that instead."
