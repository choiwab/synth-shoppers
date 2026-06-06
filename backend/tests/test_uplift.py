from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from contracts import CrowdConfig, ListingConfig
from sim.patching import apply_config_patch
from sim.runner import RunState, build_cohort, run_simulation
from sim.uplift import compute_uplift

ROOT = Path(__file__).resolve().parents[2]


def load_listing() -> ListingConfig:
    return ListingConfig.model_validate(json.loads((ROOT / "fixtures/listing.sample.json").read_text()))


@pytest.mark.asyncio
async def test_price_fix_lifts_buyers_and_resolves_price_objection() -> None:
    """Control vs treatment over the SAME cohort+seed (as a rerun does), with a price
    fix. The deterministic mock makes lower bail probs monotonic, so buyers don't drop
    and the price-sensitive personas benefit."""
    listing = load_listing()
    patched = apply_config_patch(
        listing,
        [
            {"op": "replace", "path": "/price", "value": listing.base_price},
            {"op": "replace", "path": "/shipping/fee", "value": 0.0},
        ],
    )
    crowd = CrowdConfig(personas=["budget", "xmm", "auntie", "insecure"], crowd_size=24, speed=4, seed=5)
    cohort = build_cohort(crowd.personas, crowd.crowd_size, 5)
    control = RunState("run_c", 5, listing, crowd, "mock", cohort=cohort)
    treatment = RunState("run_t", 5, patched, crowd, "mock", parent_run_id="run_c", cohort=cohort)
    await asyncio.gather(run_simulation(control), run_simulation(treatment))

    assert control.report is not None and treatment.report is not None
    up = compute_uplift(control.report, treatment.report)

    # north stars: buyers don't drop; orders == buyers until multi-item carts (Tier 3)
    assert up.buyer_uplift["delta"] >= 0
    assert up.order_uplift == up.buyer_uplift

    # per-persona: budget (price-first) should not be worse off after a price cut
    budget = next(p for p in up.per_persona if p["archetype"] == "budget")
    assert budget["buy_rate_treatment"] >= budget["buy_rate_control"]

    # objection-resolution for the Price fix is computed and well-formed
    price_res = next(r for r in up.objection_resolution if r["field"] == "Price")
    assert price_res["targeted"] >= 0
    if price_res["rate"] is not None:
        assert 0.0 <= price_res["rate"] <= 1.0
        assert price_res["resolved"] <= price_res["targeted"]

    # funnel delta covers the funnel; dropoff shares form a distribution
    assert {row["stage"] for row in up.funnel_delta} >= {"land", "price", "checkout"}
    if control.report.dropoff_reasons:
        assert abs(sum(r["share"] for r in control.report.dropoff_reasons) - 1.0) < 0.02


@pytest.mark.asyncio
async def test_uplift_objection_resolution_targets_specific_field() -> None:
    listing = load_listing()
    crowd = CrowdConfig(personas=["budget"], crowd_size=8, speed=4, seed=3)
    cohort = build_cohort(crowd.personas, crowd.crowd_size, 3)
    control = RunState("run_c2", 3, listing, crowd, "mock", cohort=cohort)
    treatment = RunState("run_t2", 3, listing, crowd, "mock", parent_run_id="run_c2", cohort=cohort)
    await asyncio.gather(run_simulation(control), run_simulation(treatment))

    # explicit targeted_fields -> objection_resolution covers exactly those
    up = compute_uplift(control.report, treatment.report, targeted_fields=["Price"])
    assert [r["field"] for r in up.objection_resolution] == ["Price"]
    # identical listings -> nobody's objection is resolved
    assert up.objection_resolution[0]["resolved"] == 0
