from __future__ import annotations

import io
import json
from pathlib import Path

import pytest
from PIL import Image

from contracts import AgentBoughtEvent, AgentTrace, CrowdConfig, ListingConfig, StageEnterEvent, StageTrace
from sim.browser_use_driver import BrowserUseAgenticDriver, _Journey, _clean_reason, _clean_sentiment
from sim.runner import RunState, build_cohort, run_simulation
from sim.screenshots import THUMB_SIZE, save_thumbnail, thumbnail_paths

ROOT = Path(__file__).resolve().parents[2]


def load_listing() -> ListingConfig:
    return ListingConfig.model_validate(json.loads((ROOT / "fixtures/listing.sample.json").read_text()))


def test_save_thumbnail_writes_dashboard_jpeg_and_returns_static_url() -> None:
    raw = io.BytesIO()
    Image.new("RGB", (1280, 800), (10, 20, 30)).save(raw, format="PNG")
    url = save_thumbnail(raw.getvalue(), "budget_1", "photos")

    assert url.startswith("/static/shots/budget_1/photos.jpg?v=")
    fs_path, _ = thumbnail_paths("budget_1", "photos")
    with Image.open(fs_path) as out:
        assert out.size == THUMB_SIZE
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
    listing = load_listing()
    driver = BrowserUseAgenticDriver(listing)
    task = driver._task("Farhan", "budget", driver.listing, "http://localhost:8080/?listing=x")

    assert "Farhan" in task and "Budget-tight" in task
    assert "scrutinize every dollar" in task  # persona blurb from sim.agents
    assert f"S${listing.price:.2f}" in task and f"S${listing.base_price:.2f}" in task  # listing facts surfaced
    assert "Over budget liao, next." in task  # objection style example from the pool


def test_page_url_scopes_browser_session_per_agent() -> None:
    driver = BrowserUseAgenticDriver(load_listing(), base_url="http://localhost:5174")
    url = driver._page_url(
        driver.listing.id,
        driver.listing,
        agent_id="budget_1",
        run_id="run_abc",
        archetype="budget",
    )

    assert url.startswith(f"http://localhost:5174/shopee/{driver.listing.id}?")
    assert "agent_id=budget_1" in url
    assert "run_id=run_abc" in url
    assert "persona=budget" in url
    assert "config=" in url


def test_search_url_starts_agents_from_matin_kim_results() -> None:
    driver = BrowserUseAgenticDriver(load_listing(), base_url="http://localhost:5174")
    url = driver._search_url(agent_id="budget_1", run_id="run_abc", archetype="budget")

    assert url.startswith("http://localhost:5174/search?")
    assert "keyword=matin+kim+beanie" in url
    assert "agent_id=budget_1" in url
    assert "run_id=run_abc" in url
    assert "persona=budget" in url


def test_objection_examples_handle_bare_string_entries() -> None:
    # xmm's price objection in agents.py is a bare string (no trailing comma);
    # it must not be iterated character-by-character.
    examples = BrowserUseAgenticDriver._objection_examples("xmm")
    assert "Cute, but this price must really look premium." in examples
    assert all(len(e) > 2 for e in examples)


# ── reasoning capture (Layer 1 + Layer 2) ────────────────────────────────────


def test_clean_sentiment_and_reason_coerce() -> None:
    assert _clean_sentiment("LOVE ") == "love"
    assert _clean_sentiment("meh") == "neutral"
    assert _clean_sentiment(None) == "neutral"
    # a valid specific reason is honored (incl. shipping, which has no stage default);
    # "other"/junk/None falls back to the stage-derived reason.
    assert _clean_reason("shipping", "price") == "shipping"
    assert _clean_reason("other", "photos") == "visual_photos"
    assert _clean_reason(None, "checkout") == "trust_authenticity"


def test_journey_trace_carries_reasoning_fields() -> None:
    async def _noop(_event):  # pragma: no cover - trivial
        return None

    ctx = _Journey(run_id="r", agent_id="budget_1", name="Farhan", archetype="budget", listing=load_listing(), emit=_noop)
    ctx.record("photos", "/s/p.jpg", sentiment="dislike", comment="Photos plain leh")
    ctx.outcome = "bought"
    ctx.purchase_reason = "Okay lah, checkout."
    trace = ctx.trace()

    assert trace.stage_trace[0].sentiment == "dislike"
    assert trace.stage_trace[0].comment == "Photos plain leh"
    assert trace.outcome == "bought" and trace.purchase_reason == "Okay lah, checkout."
    assert trace.bail_reason is None  # buyers have no bail reason


@pytest.mark.asyncio
async def test_on_step_hook_emits_agent_thought() -> None:
    events: list = []

    async def capture(event):
        events.append(event)

    driver = BrowserUseAgenticDriver(load_listing())
    ctx = _Journey(run_id="r", agent_id="budget_1", name="Farhan", archetype="budget", listing=driver.listing, emit=capture)
    ctx.current_gate = "photos"

    class FakeBrain:
        thinking = "These photos look cheap, not feeling it."
        evaluation_previous_goal = "Opened the gallery."
        next_goal = "Read the reviews next."

    class FakeHistory:
        def model_thoughts(self):
            return [FakeBrain()]

    class FakeAgent:
        history = FakeHistory()

    hook = driver._on_step(ctx)
    await hook(FakeAgent())

    thoughts = [e for e in events if getattr(e, "type", None) == "agent_thought"]
    assert len(thoughts) == 1
    assert thoughts[0].stage == "photos"
    assert "cheap" in thoughts[0].thinking
    assert thoughts[0].next_goal == "Read the reviews next."


@pytest.mark.asyncio
async def test_mock_run_populates_sentiment_diagnostics_and_dropoff() -> None:
    crowd = CrowdConfig(personas=["xmm", "budget", "insecure"], crowd_size=12, speed=4, seed=11)
    run = RunState(
        run_id="run_mock", seed=11, listing=load_listing(), crowd=crowd, mode="mock",
        cohort=build_cohort(crowd.personas, crowd.crowd_size, 11),
    )
    await run_simulation(run)

    assert "stage_sentiment" in [e["type"] for e in run.events]
    for agent in run.agents:
        for trace in agent.stage_trace:
            assert trace.sentiment is not None and trace.comment

    report = run.report
    assert report is not None
    assert report.comments
    assert any(row.get("sentiment_arc") for row in report.archetypes)
    assert "engagement_rate" in report.diagnostics and "review_read_rate" in report.diagnostics
    assert report.diagnostics["click_rate"] is None  # honest until Tier-2 impression stage
    if any(a.outcome == "bailed" for a in run.agents):
        assert report.dropoff_reasons
        assert all(0.0 <= row["share"] <= 1.0 for row in report.dropoff_reasons)
