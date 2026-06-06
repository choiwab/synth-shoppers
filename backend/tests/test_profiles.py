from __future__ import annotations

import json
import random
from pathlib import Path

import pytest

from contracts import CrowdConfig, ListingConfig
from sim.agents import generate_profile, profile_bail_multiplier
from sim.decision import effective_bail_probability
from sim.patching import apply_config_patch
from sim.runner import RunState, build_cohort, run_simulation

ROOT = Path(__file__).resolve().parents[2]


def load_listing() -> ListingConfig:
    return ListingConfig.model_validate(json.loads((ROOT / "fixtures/listing.sample.json").read_text()))


def test_generate_profile_is_deterministic_per_seed() -> None:
    a = generate_profile(random.Random("7:budget_1"))
    b = generate_profile(random.Random("7:budget_1"))
    c = generate_profile(random.Random("7:budget_2"))
    assert a == b  # same seed → identical profile (keeps reruns 1:1)
    assert a != c or a.blurb != c.blurb  # different agent → (almost surely) different


def test_build_cohort_assigns_distinct_profiles() -> None:
    cohort = build_cohort(["budget", "xmm"], 8, seed=11)
    assert all(agent.profile is not None for agent in cohort)
    blurbs = {agent.profile.blurb for agent in cohort}
    assert len(blurbs) >= 6  # 8 agents → mostly distinct life-profiles


def test_affluent_bails_less_than_tight_on_price() -> None:
    listing = load_listing()
    tight = generate_profile(random.Random("x"))
    affluent = tight.model_copy(update={"income": "affluent", "housing": "condo"})
    tight = tight.model_copy(update={"income": "tight", "housing": "HDB"})
    p_tight = effective_bail_probability("budget", "price", listing, tight)
    p_affluent = effective_bail_probability("budget", "price", listing, affluent)
    assert p_affluent < p_tight


def test_multiplier_neutral_when_no_profile() -> None:
    assert profile_bail_multiplier(None, "budget", "price") == 1.0


@pytest.mark.asyncio
async def test_listing_improvement_lifts_buyers_across_population() -> None:
    """The whole point: with 21 varied agents, an improved listing (lower price, real
    authenticity proof, responsive seller) must convert MORE of the crowd than the weak
    baseline — a visible, deterministic delta."""
    import asyncio

    listing = load_listing()  # weak: price over base, no authenticity, low response rate
    improved = apply_config_patch(
        listing,
        [
            {"op": "replace", "path": "/price", "value": round(listing.base_price * 0.9, 2)},
            {"op": "replace", "path": "/authenticity/certificate", "value": True},
            {"op": "replace", "path": "/authenticity/unboxing", "value": True},
            {"op": "replace", "path": "/seller/response_rate", "value": 95},
        ],
    )
    crowd = CrowdConfig(personas=["budget", "auntie", "insecure"], crowd_size=21, speed=4, seed=42)
    cohort = build_cohort(crowd.personas, crowd.crowd_size, 42)

    control = RunState("run_c", 42, listing, crowd, "mock", cohort=cohort)
    treatment = RunState("run_t", 42, improved, crowd, "mock", cohort=cohort)
    await asyncio.gather(run_simulation(control), run_simulation(treatment))

    control_bought = sum(1 for a in control.agents if a.outcome == "bought")
    treatment_bought = sum(1 for a in treatment.agents if a.outcome == "bought")
    assert treatment_bought > control_bought  # improved listing converts more of the crowd
    # profiles are carried onto the traces and are identical across the rerun (1:1)
    by_id_c = {a.agent_id: a.profile for a in control.agents}
    by_id_t = {a.agent_id: a.profile for a in treatment.agents}
    assert all(by_id_c[k] == by_id_t[k] for k in by_id_c)
