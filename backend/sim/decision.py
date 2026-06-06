from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass

from contracts import GateStage, ListingConfig, PersonaId
from sim.agents import PERSONAS, stage_objections


@dataclass(frozen=True)
class Decision:
    action: str
    stage: GateStage
    objection: str | None
    probability: float
    threshold: float


def stable_threshold(seed: int, agent_id: str, stage: GateStage) -> float:
    key = f"{seed}:{agent_id}:{stage}".encode("utf-8")
    digest = hashlib.sha256(key).hexdigest()
    return int(digest[:12], 16) / float(0xFFFFFFFFFFFF)


def objection_for(seed: int, agent_id: str, persona_id: PersonaId, stage: GateStage) -> str:
    persona = PERSONAS[persona_id]
    choices = stage_objections(persona, stage)
    rng = random.Random(f"{seed}:{agent_id}:{stage}:objection")
    return choices[rng.randrange(len(choices))]


def effective_bail_probability(persona_id: PersonaId, stage: GateStage, listing: ListingConfig) -> float:
    persona = PERSONAS[persona_id]
    prob = persona.bail_prob[stage]

    price_ratio = listing.price / listing.base_price
    shipping_ratio = listing.shipping.fee / max(listing.price, 1)
    lifestyle_count = sum(1 for photo in listing.photos if photo.type == "lifestyle")
    closeup_count = sum(1 for photo in listing.photos if photo.type == "closeup")
    authenticity_score = sum(
        [
            listing.authenticity.certificate,
            listing.authenticity.serial,
            listing.authenticity.unboxing,
        ]
    )

    if stage == "photos":
        if lifestyle_count == 0 and persona_id in {"xmm", "geek"}:
            prob += 0.20
        if closeup_count == 0 and persona_id in {"geek", "nerd"}:
            prob += 0.14
        if len(listing.photos) < 4:
            prob += 0.08

    if stage == "reviews":
        if listing.rating.count < 50:
            prob += 0.06
        if listing.rating.score < 4.5:
            prob += 0.05
        if listing.seller.response_rate < 70 and persona_id in {"auntie", "insecure"}:
            prob += 0.08
        if authenticity_score == 0 and persona_id == "insecure":
            prob += 0.05

    if stage == "price":
        if price_ratio > 1.10:
            prob += 0.28 * min(price_ratio - 1.0, 1.0)
        if persona_id == "budget":
            prob += max(0.0, price_ratio - 1.0) * 0.60
            prob += min(shipping_ratio * 1.4, 0.20)
        elif persona_id in {"auntie", "nerd", "geek"}:
            prob += max(0.0, price_ratio - 1.0) * 0.40

    if stage == "cart" and shipping_ratio > 0.10:
        prob += 0.10 if persona_id == "budget" else 0.04

    if stage == "checkout":
        if authenticity_score == 0 and persona_id == "insecure":
            prob += 0.25
        if not listing.seller.verified and persona_id in {"auntie", "insecure"}:
            prob += 0.12

    if persona_id == "high_spender":
        prob *= 0.65

    return max(0.0, min(prob, 0.95))


def decide(seed: int, agent_id: str, persona_id: PersonaId, stage: GateStage, listing: ListingConfig) -> Decision:
    probability = effective_bail_probability(persona_id, stage, listing)
    threshold = stable_threshold(seed, agent_id, stage)
    if threshold < probability:
        return Decision(
            action="bail",
            stage=stage,
            objection=objection_for(seed, agent_id, persona_id, stage),
            probability=probability,
            threshold=threshold,
        )
    return Decision(action="continue", stage=stage, objection=None, probability=probability, threshold=threshold)
