from __future__ import annotations

import time
from typing import Literal

from pydantic import BaseModel, Field

from contracts import GATE_ORDER, AgentTrace, GateStage, ListingConfig, PersonaId, StageTrace
from sim.agents import PERSONAS


class BrowserUseShopperOutput(BaseModel):
    outcome: Literal["bought", "bailed"]
    bail_stage: GateStage | None = None
    objection: str | None = None
    stages_seen: list[GateStage] = Field(default_factory=list)


class BrowserUseAgenticDriver:
    """Optional real-mode adapter for Browser Use Agent runs.

    This file intentionally imports browser-use lazily inside `__init__` so H4's
    deterministic mock runner, tests, and fixtures do not require Chromium or a
    Browser Use API key.
    """

    def __init__(self, browser: object | None = None, llm: object | None = None, max_steps: int = 30) -> None:
        try:
            from browser_use import Browser, ChatBrowserUse
        except ModuleNotFoundError as exc:
            raise RuntimeError("Install browser-use to use BrowserUseAgenticDriver") from exc

        self._agent_cls = self._load_agent()
        self.browser = browser or Browser()
        self.llm = llm or ChatBrowserUse()
        self.max_steps = max_steps

    @staticmethod
    def _load_agent() -> type:
        from browser_use import Agent

        return Agent

    async def run_journey(
        self,
        listing_url: str,
        agent_id: str,
        name: str,
        archetype: PersonaId,
        listing: ListingConfig,
        seed: int,
    ) -> AgentTrace:
        persona = PERSONAS[archetype]
        task = self._task(listing_url, name, persona.display, persona.blurb, listing)
        start = time.monotonic()
        agent = self._agent_cls(
            task=task,
            llm=self.llm,
            browser=self.browser,
            output_model_schema=BrowserUseShopperOutput,
            use_vision="auto",
            max_failures=2,
        )
        history = await agent.run(max_steps=self.max_steps)
        duration = round(time.monotonic() - start, 2)
        structured = getattr(history, "structured_output", None)
        output = structured if isinstance(structured, BrowserUseShopperOutput) else self._fallback_output(history)
        screenshot_paths = self._screenshot_paths(history)
        stages = output.stages_seen or (GATE_ORDER if output.outcome == "bought" else ["land", output.bail_stage or "checkout"])
        stage_trace = [
            StageTrace(
                stage=stage,
                time_s=round((index + 1) * duration / max(len(stages), 1), 2),
                screenshot_url=screenshot_paths[min(index, len(screenshot_paths) - 1)] if screenshot_paths else None,
            )
            for index, stage in enumerate(stages)
        ]
        return AgentTrace(
            agent_id=agent_id,
            name=name,
            archetype=archetype,
            outcome=output.outcome,
            bail_stage=output.bail_stage if output.outcome == "bailed" else None,
            objection=output.objection,
            retention_time_s=duration,
            stage_trace=stage_trace,
        )

    @staticmethod
    def _fallback_output(history: object) -> BrowserUseShopperOutput:
        final_result = ""
        if hasattr(history, "final_result"):
            final_result = str(history.final_result() or "")
        lower = final_result.lower()
        outcome = "bought" if "bought" in lower or "purchase" in lower or "checkout complete" in lower else "bailed"
        return BrowserUseShopperOutput(
            outcome=outcome,
            bail_stage=None if outcome == "bought" else "checkout",
            objection=None if outcome == "bought" else final_result[:240] or "Browser Use agent did not return a clear objection.",
            stages_seen=list(GATE_ORDER) if outcome == "bought" else ["land", "photos", "reviews", "price", "cart", "checkout"],
        )

    @staticmethod
    def _screenshot_paths(history: object) -> list[str]:
        if hasattr(history, "screenshot_paths"):
            return [path for path in history.screenshot_paths() if path]
        return []

    @staticmethod
    def _task(listing_url: str, name: str, persona: str, blurb: str, listing: ListingConfig) -> str:
        return f"""
You are {name}, a {persona} Singapore shopper.
{blurb}

Browse this local Shopee-style listing: {listing_url}
Listing context: {listing.title}, seller {listing.seller.name}, price S${listing.price:.2f}, shipping S${listing.shipping.fee:.2f}.

Move through these shopping stages in order when possible:
land, photos, reviews, price, cart, checkout.

At the end, return structured output only:
- outcome: "bought" or "bailed"
- bail_stage: one of land/photos/reviews/price/cart/checkout, or null if bought
- objection: exact in-character objection if bailed
- stages_seen: stages you actually reached
"""

