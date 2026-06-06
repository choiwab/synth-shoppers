from __future__ import annotations

import io
import json
from pathlib import Path

import pytest
from PIL import Image

from contracts import AgentBoughtEvent, AgentTrace, CrowdConfig, ListingConfig, StageEnterEvent, StageTrace
from sim.browser_use_driver import BrowserUseAgenticDriver
from sim.runner import RunState, build_cohort, run_simulation
from sim.screenshots import save_thumbnail, thumbnail_paths

ROOT = Path(__file__).resolve().parents[2]


def load_listing() -> ListingConfig:
    return ListingConfig.model_validate(json.loads((ROOT / "fixtures/listing.sample.json").read_text()))


def test_save_thumbnail_writes_160x120_jpeg_and_returns_static_url() -> None:
    raw = io.BytesIO()
    Image.new("RGB", (1280, 800), (10, 20, 30)).save(raw, format="PNG")
    url = save_thumbnail(raw.getvalue(), "budget_1", "photos")

    assert url == "/static/shots/budget_1/photos.jpg"
    fs_path, _ = thumbnail_paths("budget_1", "photos")
    with Image.open(fs_path) as out:
        assert out.size == (160, 120)
        assert out.format == "JPEG"


@pytest.mark.asyncio
async def test_runner_streams_live_for_emit_aware_driver_without_replay() -> None:
    class FakeEmitDriver:
        async def run_journey(self, *, listing_url, agent_id, name, archetype, listing, seed, run_id, emit):
            await emit(StageEnterEvent(run_id=run_id, ts=1, agent_id=agent_id, stage="land", thumbnail_url="/x.jpg"))
            await emit(AgentBoughtEvent(run_id=run_id, ts=2, agent_id=agent_id, retention_time_s=1.0))
            return AgentTrace(
                agent_id=agent_id, name=name, archetype=archetype, outcome="bought",
                retention_time_s=1.0, stage_trace=[StageTrace(stage="land", time_s=1.0)],
            )

    crowd = CrowdConfig(personas=["high_spender"], crowd_size=1, speed=4, seed=7)
    run = RunState(
        run_id="run_live", seed=7, listing=load_listing(), crowd=crowd, mode="real",
        cohort=build_cohort(crowd.personas, crowd.crowd_size, 7),
    )
    await run_simulation(run, driver=FakeEmitDriver())

    types = [e["type"] for e in run.events]
    # The driver streamed exactly one stage_enter; the runner must NOT replay a
    # second one from the returned trace.
    assert types.count("stage_enter") == 1
    assert types.count("agent_bought") == 1
    assert run.agents[0].outcome == "bought"


def test_task_prompt_reuses_persona_blurb_facts_and_objection_pool() -> None:
    driver = BrowserUseAgenticDriver(load_listing())
    task = driver._task("Farhan", "budget", driver.listing, "http://localhost:8080/?listing=x")

    assert "Farhan" in task and "Budget-tight" in task
    assert "scrutinize every dollar" in task  # persona blurb from sim.agents
    assert "S$36.90" in task and "S$29.90" in task  # listing facts surfaced
    assert "Over budget liao, next." in task  # objection style example from the pool


def test_objection_examples_handle_bare_string_entries() -> None:
    # xmm's price objection in agents.py is a bare string (no trailing comma);
    # it must not be iterated character-by-character.
    examples = BrowserUseAgenticDriver._objection_examples("xmm")
    assert "Cute, but this price must really look premium." in examples
    assert all(len(e) > 2 for e in examples)
