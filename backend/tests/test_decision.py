from __future__ import annotations

import json
from pathlib import Path

from contracts import ListingConfig
from sim.decision import decide, effective_bail_probability, stable_threshold


ROOT = Path(__file__).resolve().parents[2]


def load_listing() -> ListingConfig:
    return ListingConfig.model_validate(json.loads((ROOT / "fixtures/listing.sample.json").read_text()))


def test_thresholds_are_stable() -> None:
    assert stable_threshold(123, "budget_1", "price") == stable_threshold(123, "budget_1", "price")
    assert stable_threshold(123, "budget_1", "price") != stable_threshold(123, "budget_1", "reviews")


def test_price_spike_increases_budget_price_bail_probability() -> None:
    listing = load_listing()
    cheaper = listing.model_copy(update={"price": listing.base_price})
    expensive = listing.model_copy(update={"price": listing.base_price * 1.6})
    assert effective_bail_probability("budget", "price", expensive) > effective_bail_probability("budget", "price", cheaper)


def test_decision_is_reproducible() -> None:
    listing = load_listing()
    first = decide(777, "xmm_1", "xmm", "photos", listing)
    second = decide(777, "xmm_1", "xmm", "photos", listing)
    assert first == second

