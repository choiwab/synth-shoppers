"""H3 real-mode driver: autonomous browser-use agents, one per persona.

Design (agreed in the H3 grill-me session — diverges from the written PRD 03):

- Each agent is an autonomous ``browser_use.Agent`` driven by ``ChatOpenAI``.
- The persona is baked into the task prompt (sourced from ``sim.agents.PERSONAS``);
  the agent decides buy/bail/objection ITSELF. H4's probabilistic ``decide()`` is
  only used in mock mode.
- The agent navigates the listing NATURALLY (browser-use's own scroll/click) — we
  do NOT fight its element-clicking instinct with custom nav actions. Instead an
  ``on_step_end`` hook detects which funnel gate is in view (by scroll position)
  and emits the contract ``stage_enter`` + ``browser_frame`` events LIVE, with a
  per-gate thumbnail, so H1's strip updates as the agent moves.
- Only the two *decisions* are custom actions: ``bail(objection)`` and
  ``confirm_purchase``. The final ``AgentTrace`` is built from the gate log.
- One isolated headless browser per agent → one independent screenshot stream per
  agent → the "7 monitors" in the agent strip.

browser-use imports are kept inside methods so mock mode / tests / fixtures never
require Chromium or browser-use to be installed.

Verified against the installed browser-use 0.9.x: ``ChatOpenAI(model=...)``;
``Browser(headless=...)`` (alias of ``BrowserSession``) with ``.start()`` /
``.navigate_to(url)`` / ``.take_screenshot() -> bytes`` / ``.must_get_current_page()``;
``Page.get_elements_by_css_selector()`` + ``Element.click()``; ``Page.evaluate()``
(arrow-function form); ``Tools()`` + ``@tools.action`` (``browser_session`` is
injected by NAME and must stay UNANNOTATED); ``agent.run(on_step_end=...)``.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Awaitable, Callable

from contracts import (
    AgentBailedEvent,
    AgentBoughtEvent,
    AgentTrace,
    BrowserFrameEvent,
    GateStage,
    ListingConfig,
    ObjectionEvent,
    PersonaId,
    StageEnterEvent,
    StageTrace,
)
from sim.agents import DEFAULT_OBJECTIONS, PERSONAS
from sim.screenshots import save_thumbnail

EmitFn = Callable[[object], Awaitable[None]]

CONFIRM_ACTION = "confirm-order"
_GATE_INDEX: list[GateStage] = ["land", "photos", "reviews", "price", "cart", "checkout"]

# Arrow-function form is REQUIRED by browser-use's Page.evaluate. Returns the
# data-gate section currently most visible in the viewport.
_GATE_JS = (
    "() => { const s = [...document.querySelectorAll('[data-gate]')];"
    " const vh = window.innerHeight; let best = 'land', score = -1;"
    " for (const e of s) { const r = e.getBoundingClientRect();"
    " const v = Math.min(r.bottom, vh) - Math.max(r.top, 0);"
    " if (v > score) { score = v; best = e.getAttribute('data-gate'); } }"
    " return best; }"
)


def _now_ms() -> int:
    return int(time.time() * 1000)


def _scroll_pct(gate: GateStage) -> float:
    return _GATE_INDEX.index(gate) / (len(_GATE_INDEX) - 1) if gate in _GATE_INDEX else 1.0


@dataclass
class _Journey:
    """Per-agent mutable state; the gate log we build the AgentTrace from."""

    run_id: str
    agent_id: str
    name: str
    archetype: PersonaId
    listing: ListingConfig
    emit: EmitFn
    _start: float = field(default_factory=time.monotonic)
    current_gate: GateStage | None = None
    outcome: str | None = None  # None until the agent buys/bails
    bail_stage: GateStage | None = None
    objection: str | None = None
    _traces: list[StageTrace] = field(default_factory=list)

    def elapsed(self) -> float:
        return round(time.monotonic() - self._start, 2)

    def record(self, gate: GateStage, screenshot_url: str | None) -> None:
        self.current_gate = gate
        self._traces.append(StageTrace(stage=gate, time_s=self.elapsed(), screenshot_url=screenshot_url))

    def trace(self) -> AgentTrace:
        outcome = self.outcome or "bailed"
        return AgentTrace(
            agent_id=self.agent_id,
            name=self.name,
            archetype=self.archetype,
            outcome=outcome,  # type: ignore[arg-type]
            bail_stage=self.bail_stage if outcome == "bailed" else None,
            objection=self.objection if outcome == "bailed" else None,
            retention_time_s=self.elapsed(),
            stage_trace=list(self._traces) or [StageTrace(stage="land", time_s=self.elapsed())],
        )


class BrowserUseAgenticDriver:
    """Real-mode ``AgenticJourneyDriver``: one autonomous browser-use agent per call."""

    def __init__(
        self,
        listing: ListingConfig,
        *,
        model: str = "gpt-4o",
        max_steps: int = 15,
        headless: bool = True,
        base_url: str | None = None,
    ) -> None:
        import os

        self.listing = listing
        self.model = model
        self.max_steps = max_steps
        self.headless = headless
        # The runner passes the listing *slug* (run.listing.id), not a URL, so we
        # build the page URL from a configurable base. Default points at H3's local
        # stub server; swap to H2's dev server via LISTING_BASE_URL (one-line swap).
        self.base_url = (base_url or os.environ.get("LISTING_BASE_URL", "http://localhost:8080")).rstrip("/")

    # ---- the seam the runner calls (emit-aware -> streams live) -----------------
    async def run_journey(
        self,
        *,
        listing_url: str,
        agent_id: str,
        name: str,
        archetype: PersonaId,
        listing: ListingConfig,
        seed: int,
        run_id: str,
        emit: EmitFn,
    ) -> AgentTrace:
        url = f"{self.base_url}/?listing={listing_url}"
        ctx = _Journey(run_id=run_id, agent_id=agent_id, name=name, archetype=archetype, listing=listing, emit=emit)

        browser = self._make_browser()
        try:
            # Open the listing ourselves so navigation is deterministic and we can
            # grab a real `land` thumbnail; the agent then drives the funnel itself.
            await self._open(browser, url)
            await self._enter(ctx, "land", await self._capture(ctx, browser, "land"))

            tools = self._build_tools(ctx)
            agent = self._make_agent(name, archetype, listing, url, tools, browser)
            try:
                await agent.run(max_steps=self.max_steps, on_step_end=self._make_step_hook(ctx))
            except Exception as exc:  # agent crash -> degrade to a clean bail
                if ctx.outcome is None:
                    await self._bail(ctx, ctx.current_gate or "land", f"(agent stopped) {str(exc)[:160]}")
            if ctx.outcome is None:  # ran out of steps without deciding
                await self._bail(ctx, ctx.current_gate or "land", "Browsed but never committed to buying.")
            return ctx.trace()
        finally:
            await self._close(browser)

    # ---- gate tracking via a per-step hook (no fighting the agent) --------------
    def _make_step_hook(self, ctx: _Journey) -> Callable[[object], Awaitable[None]]:
        async def on_step_end(agent: object) -> None:
            if ctx.outcome is not None:
                return
            session = getattr(agent, "browser_session", None)
            if session is None:
                return
            try:
                gate = await self._detect_gate(session)
                cur = _GATE_INDEX.index(ctx.current_gate or "land")
                nxt = _GATE_INDEX.index(gate)
                if nxt <= cur:  # no forward progress (or scrolled back) -> nothing to emit
                    return
                thumb = await self._capture(ctx, session, gate)
                for i in range(cur + 1, nxt):  # fill any skipped gates (no thumbnail)
                    await self._enter(ctx, _GATE_INDEX[i], None)
                await self._enter(ctx, gate, thumb)
            except Exception:
                return

        return on_step_end

    async def _detect_gate(self, session) -> GateStage:
        page = await session.must_get_current_page()
        value = str(await page.evaluate(_GATE_JS)).strip().strip('"').strip("'")
        return value if value in _GATE_INDEX else "land"  # type: ignore[return-value]

    # ---- custom DECISION actions (the only ones we register) -------------------
    def _build_tools(self, ctx: _Journey):
        # NOTE: `browser_session` is injected by NAME by browser-use's Tools registry;
        # it must be left UNANNOTATED (annotating it raises a type-conflict error).
        from browser_use import ActionResult, Tools

        tools = Tools()

        @tools.action(description="Confirm and place the order. Call this ONLY if you genuinely decide to buy.")
        async def confirm_purchase(browser_session):  # noqa: ANN001
            if ctx.outcome is not None:
                return ActionResult(extracted_content="Already finished.", is_done=True)
            await self._click(browser_session, CONFIRM_ACTION)
            await self._capture(ctx, browser_session, ctx.current_gate or "checkout")
            ctx.outcome = "bought"
            await ctx.emit(AgentBoughtEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, retention_time_s=ctx.elapsed()))
            return ActionResult(extracted_content="Order confirmed — purchased.", is_done=True, success=True)

        @tools.action(description="Leave the listing without buying. Give your exact in-character objection.")
        async def bail(browser_session, objection: str):  # noqa: ANN001
            await self._capture(ctx, browser_session, ctx.current_gate or "land")
            await self._bail(ctx, ctx.current_gate or "land", objection)
            return ActionResult(extracted_content=f"Left without buying: {objection}", is_done=True, success=True)

        return tools

    # ---- live emission helpers -------------------------------------------------
    async def _enter(self, ctx: _Journey, gate: GateStage, thumbnail_url: str | None) -> None:
        ctx.record(gate, thumbnail_url)
        await ctx.emit(StageEnterEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, stage=gate, thumbnail_url=thumbnail_url))
        if thumbnail_url:
            await ctx.emit(
                BrowserFrameEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, thumbnail_url=thumbnail_url, scroll_pct=_scroll_pct(gate))
            )

    async def _bail(self, ctx: _Journey, gate: GateStage, objection: str) -> None:
        if ctx.outcome is not None:
            return
        ctx.outcome, ctx.bail_stage, ctx.objection = "bailed", gate, objection
        await ctx.emit(ObjectionEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, stage=gate, text=objection))
        await ctx.emit(AgentBailedEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, stage=gate, objection=objection, retention_time_s=ctx.elapsed()))

    # ---- prompt assembly (reuses H4's PERSONAS) --------------------------------
    def _make_agent(self, name: str, archetype: PersonaId, listing: ListingConfig, url: str, tools, browser):
        from browser_use import Agent, ChatOpenAI

        return Agent(task=self._task(name, archetype, listing, url), llm=ChatOpenAI(model=self.model), tools=tools, browser=browser)

    def _task(self, name: str, archetype: PersonaId, listing: ListingConfig, url: str) -> str:
        persona = PERSONAS[archetype]
        examples = "; ".join(self._objection_examples(archetype)[:3])
        return (
            f"You are {name}, a {persona.display} shopper in Singapore ({persona.tag}).\n"
            f"{persona.blurb}\n\n"
            f"You are already on this Shopee listing page ({url}); do not navigate away.\n\n"
            f"What you can see about the listing:\n{self._facts(listing)}\n\n"
            "How to shop: browse the listing top to bottom the way you naturally would — "
            "look at the photos, read the reviews, check the price and shipping, view the cart "
            "and checkout. Scroll and click the page's buttons to move through it.\n"
            "When you decide: call confirm_purchase ONLY if you genuinely want to buy, or call "
            "bail the moment something puts you off.\n"
            "If you bail, write ONE short objection in your OWN Singlish voice — a single sentence, "
            f"fully in character. For tone only (do NOT copy these verbatim), people like you say "
            f"things like: {examples}\n\n"
            f"Decide the way {persona.display} really would for THIS listing."
        )

    @staticmethod
    def _objection_examples(archetype: PersonaId) -> list[str]:
        # Prefer the persona's DISTINCTIVE lines (skip the generic DEFAULT_OBJECTIONS)
        # so the style hints are characterful. agents.py mixes tuples and the
        # occasional bare string — handle both.
        out: list[str] = []
        for gate, value in PERSONAS[archetype].objections.items():
            for line in value if isinstance(value, tuple) else (value,):
                if line not in DEFAULT_OBJECTIONS.get(gate, ()):
                    out.append(line)
        return out[:8]

    @staticmethod
    def _facts(listing: ListingConfig) -> str:
        lifestyle = sum(1 for p in listing.photos if p.type == "lifestyle")
        closeup = sum(1 for p in listing.photos if p.type == "closeup")
        a = listing.authenticity
        return (
            f"- Price: S${listing.price:.2f} (usual S${listing.base_price:.2f}); shipping S${listing.shipping.fee:.2f}\n"
            f"- Photos: {len(listing.photos)} ({lifestyle} lifestyle, {closeup} close-up)\n"
            f"- Rating: {listing.rating.score}/5 from {listing.rating.count} reviews\n"
            f"- Seller: {listing.seller.name}, verified={listing.seller.verified}, replies to {listing.seller.response_rate:.0f}% of reviews\n"
            f"- Authenticity proof: certificate={a.certificate}, serial={a.serial}, unboxing={a.unboxing}"
        )

    # ---- browser-use runtime touchpoints (isolated; verified vs 0.9.x) ---------
    def _make_browser(self):
        from browser_use import Browser

        return Browser(headless=self.headless)

    async def _open(self, browser, url: str) -> None:
        if hasattr(browser, "start"):
            await browser.start()
        if hasattr(browser, "navigate_to"):
            await browser.navigate_to(url)
        else:
            page = await browser.must_get_current_page()
            await page.goto(url)
        await asyncio.sleep(0.6)  # let first paint settle before the land screenshot

    async def _click(self, browser_session, action: str) -> bool:
        selector = f'[data-action="{action}"]'
        try:
            page = await browser_session.must_get_current_page()
            elements = await page.get_elements_by_css_selector(selector)
            if not elements:
                return False
            await elements[0].click()
            await asyncio.sleep(0.4)
            return True
        except Exception:
            return False

    async def _capture(self, ctx: _Journey, browser_session, gate: GateStage) -> str | None:
        try:
            raw = await self._screenshot_bytes(browser_session)
            if not raw:
                return None
            # Offload the Pillow resize/write so it never blocks the agent loop.
            return await asyncio.to_thread(save_thumbnail, raw, ctx.agent_id, gate)
        except Exception:
            return None

    async def _screenshot_bytes(self, browser_session) -> bytes | None:
        if hasattr(browser_session, "take_screenshot"):
            return self._decode(await browser_session.take_screenshot())
        page = await browser_session.must_get_current_page()
        if hasattr(page, "screenshot"):
            return self._decode(await page.screenshot())
        return None

    @staticmethod
    def _decode(data) -> bytes | None:
        if data is None:
            return None
        if isinstance(data, (bytes, bytearray)):
            return bytes(data)
        if isinstance(data, str):
            import base64
            import binascii

            try:
                return base64.b64decode(data)
            except (binascii.Error, ValueError):
                return None
        return None

    async def _close(self, browser) -> None:
        for name in ("kill", "stop", "close"):
            fn = getattr(browser, name, None)
            if fn is None:
                continue
            try:
                result = fn()
                if asyncio.iscoroutine(result):
                    await result
                return
            except Exception:
                continue
