from __future__ import annotations

import json
from pathlib import Path

import pytest

import sim.analysis as analysis
from contracts import CrowdConfig, ListingConfig
from sim.analysis import analyze_run, path_allowed, _sanitize_patch
from sim.runner import RunState, build_cohort, run_simulation

ROOT = Path(__file__).resolve().parents[2]


def load_listing() -> ListingConfig:
    return ListingConfig.model_validate(json.loads((ROOT / "fixtures/listing.sample.json").read_text()))


async def build_report():
    listing = load_listing()
    crowd = CrowdConfig(personas=["budget", "xmm", "auntie", "insecure"], crowd_size=20, speed=4, seed=7)
    cohort = build_cohort(crowd.personas, crowd.crowd_size, 7)
    run = RunState("run_a", 7, listing, crowd, "mock", cohort=cohort)
    await run_simulation(run)
    assert run.report is not None
    return run.report, listing


def test_path_allowlist_scope() -> None:
    # in-scope text/numeric levers
    assert path_allowed("/title")
    assert path_allowed("/price")
    assert path_allowed("/description")
    assert path_allowed("/shipping/fee")
    assert path_allowed("/authenticity/certificate")
    assert path_allowed("/seller/response_rate")
    assert path_allowed("/variants/0/options/1")
    assert path_allowed("/variants/0/options/-")
    # out of scope — photos, reviews, ids, arbitrary
    assert not path_allowed("/photos/-")
    assert not path_allowed("/reviews/0/text")
    assert not path_allowed("/id")
    assert not path_allowed("/base_price")
    assert not path_allowed("/seller/name")


def test_sanitize_patch_drops_disallowed_and_strips_annotations() -> None:
    ops = [
        {"op": "replace", "path": "/price", "value": 29.9, "field": "Price", "reason": "cheaper"},
        {"op": "add", "path": "/photos/-", "value": {"url": "/x.jpg", "type": "lifestyle"}},  # dropped
        {"op": "remove", "path": "/title"},  # unsupported op -> dropped
    ]
    clean = _sanitize_patch(ops)
    assert clean == [{"op": "replace", "path": "/price", "value": 29.9}]


@pytest.mark.asyncio
async def test_heuristic_fallback_without_api_key(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    report, listing = await build_report()

    result = await analyze_run(report, listing)

    assert result.source == "heuristic"
    assert result.run_id == report.run_id
    # every proposed patch op stays within the allowlisted scope
    assert all(path_allowed(op["path"]) for op in result.config_patch)
    # proposed_listing is a valid ListingConfig with the patch applied
    assert isinstance(result.proposed_listing, ListingConfig)
    # proposed_changes line up 1:1 with the patch and carry a before value
    assert len(result.proposed_changes) == len(result.config_patch)


@pytest.mark.asyncio
async def test_llm_path_filters_out_of_scope_ops(monkeypatch) -> None:
    report, listing = await build_report()
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    async def fake_call(_report, _listing, _model):
        return {
            "narrative": "Budget shoppers balk at the price; trim it and add proof.",
            "per_persona": [
                {"archetype": "budget", "insight": "price too high", "what_to_fix": "lower price"},
                {"archetype": "ghost", "insight": "ignored", "what_to_fix": "n/a"},  # invalid -> dropped
            ],
            "expected_impact": "+8-12% buy rate",
            "config_patch": [
                {"op": "replace", "path": "/price", "value": 32.5, "field": "Price", "reason": "more affordable", "affected_archetypes": ["budget"]},
                {"op": "replace", "path": "/title", "value": "Matin Kim Beanie — SG Ready Stock", "field": "Title", "reason": "clarity"},
                {"op": "add", "path": "/photos/-", "value": {"url": "/y.jpg", "type": "lifestyle"}},  # out of scope -> dropped
            ],
        }

    monkeypatch.setattr(analysis, "_call_openai", fake_call)

    result = await analyze_run(report, listing)

    assert result.source == "llm"
    paths = [op["path"] for op in result.config_patch]
    assert "/price" in paths and "/title" in paths
    assert "/photos/-" not in paths  # filtered
    assert result.proposed_listing.price == 32.5
    assert result.proposed_listing.title == "Matin Kim Beanie — SG Ready Stock"
    # invalid archetype filtered from per_persona
    assert [p.archetype for p in result.per_persona] == ["budget"]
    # diff carries the original price as `current`
    price_change = next(c for c in result.proposed_changes if c.path == "/price")
    assert price_change.current == listing.price
    assert price_change.proposed == 32.5
    assert price_change.affected_archetypes == ["budget"]
