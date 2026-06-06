from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from contracts import CrowdConfig, ListingConfig
from contracts import AgentTrace, StageTrace
from sim.patching import apply_config_patch
from sim.runner import RunState, SimulationRegistry, build_cohort, run_simulation


ROOT = Path(__file__).resolve().parents[2]


def load_listing() -> ListingConfig:
    return ListingConfig.model_validate(json.loads((ROOT / "fixtures/listing.sample.json").read_text()))


@pytest.mark.asyncio
async def test_runner_emits_buffered_events_and_report() -> None:
    crowd = CrowdConfig(personas=["xmm", "budget", "high_spender"], crowd_size=9, speed=4, seed=42)
    run = RunState(
        run_id="run_test",
        seed=42,
        listing=load_listing(),
        crowd=crowd,
        mode="mock",
        cohort=build_cohort(crowd.personas, crowd.crowd_size, 42),
    )
    await run_simulation(run)

    assert run.complete
    assert run.report is not None
    assert run.report.browsing_metrics["unique_buyers"] == sum(1 for agent in run.agents if agent.outcome == "bought")
    assert run.report.browsing_metrics["click_rate"] >= run.report.browsing_metrics["read_rate"]
    assert run.report.browsing_metrics["dropoff_reason_distribution"]
    assert len(run.report.agent_trace_reports) == len(run.agents)
    first_trace_report = run.report.agent_trace_reports[0]
    assert first_trace_report["agent_id"]
    assert first_trace_report["summary"]
    assert first_trace_report["stage_path"]
    assert "retention_time_s" in first_trace_report["metrics"]
    assert "run_metrics_context" in first_trace_report
    assert run.events[0]["type"] == "run_started"
    assert run.events[0]["competitors"]
    assert run.events[-1]["type"] == "run_complete"

    replay = await run.subscribe()
    replayed = []
    while True:
        event = await replay.get()
        if event is None:
            break
        replayed.append(event)
    assert replayed == run.events


@pytest.mark.asyncio
async def test_rerun_patch_can_improve_budget_outcome_deterministically() -> None:
    listing = load_listing()
    patch = [{"op": "replace", "path": "/price", "value": listing.base_price}]
    patched = apply_config_patch(listing, patch)
    assert patched.price == listing.base_price

    crowd = CrowdConfig(personas=["budget"], crowd_size=12, speed=4, seed=9)
    cohort = build_cohort(crowd.personas, crowd.crowd_size, 9)
    baseline = RunState("run_base", 9, listing, crowd, "mock", cohort=cohort)
    await run_simulation(baseline)
    rerun = RunState(
        "run_rerun",
        9,
        patched,
        crowd,
        "mock",
        parent_run_id="run_base",
        cohort=cohort,
        parent_report=baseline.report,
    )
    await run_simulation(rerun)
    assert baseline.report is not None
    assert rerun.report is not None
    assert len(baseline.agents) == len(rerun.agents)
    assert rerun.report.browsing_metrics["buyer_uplift"] is not None
    assert rerun.report.browsing_metrics["order_uplift"] is not None
    assert rerun.report.browsing_metrics["per_persona_uplift"] is not None


@pytest.mark.asyncio
async def test_runner_accepts_agentic_journey_driver() -> None:
    class FakeAgenticDriver:
        async def run_journey(self, listing_url, agent_id, name, archetype, listing, seed):
            return AgentTrace(
                agent_id=agent_id,
                name=name,
                archetype=archetype,
                outcome="bailed",
                bail_stage="photos",
                objection="Photos not clear enough.",
                retention_time_s=4.2,
                stage_trace=[
                    StageTrace(stage="land", time_s=1.0, screenshot_url="/shot/land.png"),
                    StageTrace(stage="photos", time_s=4.2, screenshot_url="/shot/photos.png"),
                ],
            )

    crowd = CrowdConfig(personas=["xmm"], crowd_size=1, speed=4, seed=101)
    run = RunState(
        run_id="run_agentic",
        seed=101,
        listing=load_listing(),
        crowd=crowd,
        mode="real",
        cohort=build_cohort(crowd.personas, crowd.crowd_size, 101),
    )
    await run_simulation(run, driver=FakeAgenticDriver())
    assert run.report is not None
    assert run.agents[0].outcome == "bailed"
    assert [event["type"] for event in run.events].count("stage_enter") == 2


@pytest.mark.asyncio
async def test_registry_real_mode_uses_registered_driver_factory() -> None:
    class FakeAgenticDriver:
        async def run_journey(self, listing_url, agent_id, name, archetype, listing, seed):
            return AgentTrace(
                agent_id=agent_id,
                name=name,
                archetype=archetype,
                outcome="bought",
                retention_time_s=3.0,
                stage_trace=[StageTrace(stage="land", time_s=1.0), StageTrace(stage="checkout", time_s=3.0)],
            )

    registry = SimulationRegistry()
    registry.set_real_driver_factory(lambda listing: FakeAgenticDriver())
    crowd = CrowdConfig(personas=["high_spender"], crowd_size=1, speed=4, seed=202)
    response = await registry.start(load_listing(), crowd, mode="real")
    run = registry.get(response.run_id)
    assert run is not None
    while not run.complete:
        await asyncio.sleep(0)
    assert run.report is not None
    assert run.report.agents[0].outcome == "bought"
