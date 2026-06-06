"""Guards the baseline fixture against silently drifting back to an all-perfect
listing. The simulation's metrics are only meaningful if the tracked listing's
own fields actually move bail probability — so each funnel lever must be live at
baseline for the personas it targets."""

from __future__ import annotations

import json
from pathlib import Path

from contracts import ListingConfig
from sim.agents import PERSONAS
from sim.decision import effective_bail_probability

ROOT = Path(__file__).resolve().parents[2]


def load_listing() -> ListingConfig:
    return ListingConfig.model_validate(json.loads((ROOT / "fixtures/listing.sample.json").read_text()))


def base(persona: str, stage: str) -> float:
    return PERSONAS[persona].bail_prob[stage]  # type: ignore[index]


def test_photos_gap_raises_bail_for_visual_personas() -> None:
    listing = load_listing()
    for persona in ("xmm", "geek"):
        assert effective_bail_probability(persona, "photos", listing) > base(persona, "photos")


def test_price_markup_raises_bail_for_price_sensitive_personas() -> None:
    listing = load_listing()
    assert listing.price > listing.base_price  # a markup keeps price a live lever
    for persona in ("budget", "nerd", "auntie"):
        assert effective_bail_probability(persona, "price", listing) > base(persona, "price")


def test_thin_reviews_and_low_response_raise_review_bail() -> None:
    listing = load_listing()
    assert effective_bail_probability("auntie", "reviews", listing) > base("auntie", "reviews")
    assert effective_bail_probability("insecure", "reviews", listing) > base("insecure", "reviews")


def test_missing_authenticity_raises_insecure_checkout_bail() -> None:
    listing = load_listing()
    assert effective_bail_probability("insecure", "checkout", listing) > base("insecure", "checkout")


def test_baseline_levers_are_live_not_perfect() -> None:
    listing = load_listing()
    assert listing.rating.count < 50  # a new listing has few reviews
    assert listing.seller.response_rate < 70
    auth = listing.authenticity
    assert sum([auth.certificate, auth.serial, auth.unboxing]) == 0  # authenticity is a lever
    assert listing.price > listing.base_price  # priced above its own anchor
