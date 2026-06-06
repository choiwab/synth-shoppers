from __future__ import annotations

import asyncio
import inspect
import random
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable

from contracts import (
    GATE_ORDER,
    REASON_BY_STAGE,
    AgentBailedEvent,
    AgentBoughtEvent,
    AgentEvent,
    AgentSpawnedEvent,
    AgentTrace,
    BrowserFrameEvent,
    CrowdConfig,
    ListingConfig,
    ObjectionEvent,
    PersonaId,
    RunCompleteEvent,
    RunProgressEvent,
    RunResponse,
    RunStartedEvent,
    StageEnterEvent,
    StageSentimentEvent,
    StageTrace,
    ViabilityReport,
)
from sim.agents import PERSONAS
from sim.decision import decide, synth_purchase_reason, synth_reaction
from sim.mock_driver import AgenticJourneyDriver, BrowserDriver, MockBrowserDriver
from sim.report import build_report


def now_ms() -> int:
    return int(time.time() * 1000)


def short_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


@dataclass(frozen=True)
class AgentProfile:
    agent_id: str
    name: str
    archetype: PersonaId


@dataclass
class RunState:
    run_id: str
    seed: int
    listing: ListingConfig
    crowd: CrowdConfig
    mode: str
    parent_run_id: str | None = None
    cohort: list[AgentProfile] = field(default_factory=list)
    events: list[dict[str, Any]] = field(default_factory=list)
    subscribers: list[asyncio.Queue[dict[str, Any] | None]] = field(default_factory=list)
    agents: list[AgentTrace] = field(default_factory=list)
    report: ViabilityReport | None = None
    complete: bool = False

    async def emit(self, event: AgentEvent) -> None:
        payload = event.model_dump(exclude_none=True)
        self.events.append(payload)
        for subscriber in list(self.subscribers):
            await subscriber.put(payload)

    async def subscribe(self) -> asyncio.Queue[dict[str, Any] | None]:
        queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        for event in self.events:
            await queue.put(event)
        if self.complete:
            await queue.put(None)
        else:
            self.subscribers.append(queue)
        return queue

    async def close_subscribers(self) -> None:
        for subscriber in list(self.subscribers):
            await subscriber.put(None)
        self.subscribers.clear()


class SimulationRegistry:
    def __init__(self) -> None:
        self.runs: dict[str, RunState] = {}
        self.real_driver_factory: Callable[[ListingConfig], BrowserDriver | AgenticJourneyDriver] | None = None

    def get(self, run_id: str) -> RunState | None:
        return self.runs.get(run_id)

    def set_real_driver_factory(self, factory: Callable[[ListingConfig], BrowserDriver | AgenticJourneyDriver]) -> None:
        self.real_driver_factory = factory

    async def start(self, listing: ListingConfig, crowd: CrowdConfig, mode: str = "mock") -> RunResponse:
        seed = crowd.seed if crowd.seed is not None else random.randrange(1, 2**31)
        crowd = crowd.model_copy(update={"seed": seed})
        run = RunState(
            run_id=short_id("run"),
            seed=seed,
            listing=listing,
            crowd=crowd,
            mode=mode,
            cohort=build_cohort(crowd.personas, crowd.crowd_size, seed),
        )
        self.runs[run.run_id] = run
        driver = self.real_driver_factory(listing) if mode == "real" and self.real_driver_factory else None
        asyncio.create_task(run_simulation(run, driver=driver))
        return RunResponse(run_id=run.run_id, seed=seed)

    async def rerun(self, parent: RunState, listing: ListingConfig) -> RunResponse:
        run = RunState(
            run_id=short_id("run"),
            seed=parent.seed,
            listing=listing,
            crowd=parent.crowd,
            mode=parent.mode,
            parent_run_id=parent.run_id,
            cohort=parent.cohort,
        )
        self.runs[run.run_id] = run
        driver = self.real_driver_factory(listing) if run.mode == "real" and self.real_driver_factory else None
        asyncio.create_task(run_simulation(run, driver=driver))
        return RunResponse(run_id=run.run_id, seed=run.seed, parent_run_id=parent.run_id)


def build_cohort(personas: list[PersonaId], crowd_size: int, seed: int) -> list[AgentProfile]:
    rng = random.Random(seed)
    counts: dict[PersonaId, int] = {persona: 0 for persona in personas}
    cohort: list[AgentProfile] = []
    for index in range(crowd_size):
        persona_id = personas[index % len(personas)]
        counts[persona_id] += 1
        persona = PERSONAS[persona_id]
        name = persona.names[(counts[persona_id] - 1) % len(persona.names)]
        suffix = counts[persona_id]
        # Shuffle only the final ordering; ids stay stable and readable.
        cohort.append(AgentProfile(agent_id=f"{persona_id}_{suffix}", name=name, archetype=persona_id))
    rng.shuffle(cohort)
    return cohort


async def run_simulation(run: RunState, driver: BrowserDriver | AgenticJourneyDriver | None = None) -> None:
    driver = driver or MockBrowserDriver(run.listing)
    await run.emit(
        RunStartedEvent(
            run_id=run.run_id,
            ts=now_ms(),
            listing={"title": run.listing.title, "price": run.listing.price, "seller": run.listing.seller.name},
            agents_total=len(run.cohort),
        )
    )

    for agent in run.cohort:
        await run.emit(AgentSpawnedEvent(run_id=run.run_id, ts=now_ms(), agent_id=agent.agent_id, name=agent.name, archetype=agent.archetype))

    bought = 0
    bailed = 0
    semaphore = asyncio.Semaphore(50 if run.mode == "mock" else 10)

    async def run_agent(agent: AgentProfile) -> AgentTrace:
        async with semaphore:
            if hasattr(driver, "run_journey"):
                accepts_emit = "emit" in inspect.signature(driver.run_journey).parameters  # type: ignore[attr-defined]
                if accepts_emit:
                    # H3 real driver streams events live (stage_enter+browser_frame+
                    # objection+agent_bailed/bought) from inside its custom actions,
                    # so the runner does not replay them post-hoc.
                    return await driver.run_journey(  # type: ignore[attr-defined]
                        listing_url=run.listing.id,
                        agent_id=agent.agent_id,
                        name=agent.name,
                        archetype=agent.archetype,
                        listing=run.listing,
                        seed=run.seed,
                        run_id=run.run_id,
                        emit=run.emit,
                    )
                # Legacy return-only drivers: replay the trace as events post-hoc.
                trace = await driver.run_journey(  # type: ignore[attr-defined]
                    listing_url=run.listing.id,
                    agent_id=agent.agent_id,
                    name=agent.name,
                    archetype=agent.archetype,
                    listing=run.listing,
                    seed=run.seed,
                )
                for stage in [item.stage for item in trace.stage_trace]:
                    await run.emit(StageEnterEvent(run_id=run.run_id, ts=now_ms(), agent_id=agent.agent_id, stage=stage))
                if trace.outcome == "bailed":
                    objection = trace.objection or "Not convinced enough to buy."
                    await run.emit(
                        ObjectionEvent(
                            run_id=run.run_id,
                            ts=now_ms(),
                            agent_id=agent.agent_id,
                            stage=trace.bail_stage or trace.stage_trace[-1].stage,
                            text=objection,
                        )
                    )
                    await run.emit(
                        AgentBailedEvent(
                            run_id=run.run_id,
                            ts=now_ms(),
                            agent_id=agent.agent_id,
                            stage=trace.bail_stage or trace.stage_trace[-1].stage,
                            objection=objection,
                            retention_time_s=trace.retention_time_s,
                            reason_category=trace.bail_reason,
                        )
                    )
                else:
                    await run.emit(
                        AgentBoughtEvent(
                            run_id=run.run_id,
                            ts=now_ms(),
                            agent_id=agent.agent_id,
                            retention_time_s=trace.retention_time_s,
                        )
                    )
                return trace

            session = await driver.open(run.listing.id, agent.agent_id)
            stage_trace: list[StageTrace] = []
            start = time.monotonic()
            try:
                for stage in GATE_ORDER:
                    page = await driver.goto_gate(session, stage)
                    elapsed = round(time.monotonic() - start + len(stage_trace) * 1.2, 2)
                    decision = decide(run.seed, agent.agent_id, agent.archetype, stage, run.listing)
                    bailing = decision.action == "bail"
                    if bailing:
                        comment = decision.objection or "Not convinced enough to buy."
                        sentiment = "reject"
                    else:
                        sentiment, comment = synth_reaction(agent.archetype, stage, decision.probability)

                    stage_trace.append(
                        StageTrace(stage=stage, time_s=elapsed, screenshot_url=page.screenshot_url, sentiment=sentiment, comment=comment)
                    )
                    await run.emit(
                        StageEnterEvent(
                            run_id=run.run_id,
                            ts=now_ms(),
                            agent_id=agent.agent_id,
                            stage=stage,
                            thumbnail_url=page.screenshot_url,
                        )
                    )
                    if page.screenshot_url:
                        await run.emit(
                            BrowserFrameEvent(
                                run_id=run.run_id,
                                ts=now_ms(),
                                agent_id=agent.agent_id,
                                thumbnail_url=page.screenshot_url,
                                scroll_pct=page.scroll_pct,
                            )
                        )
                    await run.emit(
                        StageSentimentEvent(run_id=run.run_id, ts=now_ms(), agent_id=agent.agent_id, stage=stage, sentiment=sentiment, comment=comment)
                    )

                    if bailing:
                        retention = round(time.monotonic() - start + len(stage_trace) * 1.2, 2)
                        reason = REASON_BY_STAGE.get(stage, "other")
                        await run.emit(ObjectionEvent(run_id=run.run_id, ts=now_ms(), agent_id=agent.agent_id, stage=stage, text=comment))
                        await run.emit(
                            AgentBailedEvent(
                                run_id=run.run_id,
                                ts=now_ms(),
                                agent_id=agent.agent_id,
                                stage=stage,
                                objection=comment,
                                retention_time_s=retention,
                                reason_category=reason,
                            )
                        )
                        return AgentTrace(
                            agent_id=agent.agent_id,
                            name=agent.name,
                            archetype=agent.archetype,
                            outcome="bailed",
                            bail_stage=stage,
                            objection=comment,
                            retention_time_s=retention,
                            stage_trace=stage_trace,
                            bail_reason=reason,
                        )
                    await asyncio.sleep(0 if run.crowd.speed == 4 else 0.05 / run.crowd.speed)

                retention = round(time.monotonic() - start + len(stage_trace) * 1.2, 2)
                reason = synth_purchase_reason(agent.archetype)
                await run.emit(
                    StageSentimentEvent(run_id=run.run_id, ts=now_ms(), agent_id=agent.agent_id, stage="checkout", sentiment="love", comment=reason)
                )
                await run.emit(AgentBoughtEvent(run_id=run.run_id, ts=now_ms(), agent_id=agent.agent_id, retention_time_s=retention))
                return AgentTrace(
                    agent_id=agent.agent_id,
                    name=agent.name,
                    archetype=agent.archetype,
                    outcome="bought",
                    retention_time_s=retention,
                    stage_trace=stage_trace,
                    purchase_reason=reason,
                )
            finally:
                await driver.close(session)

    tasks = [asyncio.create_task(run_agent(agent)) for agent in run.cohort]
    for task in asyncio.as_completed(tasks):
        trace = await task
        run.agents.append(trace)
        if trace.outcome == "bought":
            bought += 1
        else:
            bailed += 1
        await run.emit(
            RunProgressEvent(
                run_id=run.run_id,
                ts=now_ms(),
                active=len(run.cohort) - bought - bailed,
                bought=bought,
                bailed=bailed,
            )
        )

    run.report = build_report(run.run_id, sorted(run.agents, key=lambda a: a.agent_id), run.listing.base_price)
    run.complete = True
    await run.emit(
        RunCompleteEvent(
            run_id=run.run_id,
            ts=now_ms(),
            buy_rate=round(bought / len(run.cohort), 3) if run.cohort else 0,
            report_ready=True,
        )
    )
    await run.close_subscribers()


registry = SimulationRegistry()
