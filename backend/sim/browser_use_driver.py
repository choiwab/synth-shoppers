"""H3 real-mode driver: autonomous browser-use agents, one per persona.

Design (agreed in the H3 grill-me session — diverges from the written PRD 03):

- Each agent is an autonomous ``browser_use.Agent`` driven by ``ChatOpenAI``.
- The persona is baked into the task prompt (sourced from ``sim.agents.PERSONAS``);
  the agent decides buy/bail/objection ITSELF. H4's probabilistic ``decide()`` is
  only used in mock mode.
- The agent is constrained to a fixed menu of custom ``Tools`` that mirror the
  funnel (look_at_photos / read_reviews / check_price / add_to_cart / checkout /
  confirm_purchase / bail). Each action clicks the matching ``data-action``
  selector, screenshots, and emits the contract ``AgentEvent`` LIVE so H1's strip
  updates as the agent moves. The final ``AgentTrace`` is built from the action
  log (no structured-output LLM round-trip).
- One isolated headless browser per agent → one independent screenshot stream per
  agent → the "7 monitors" in the agent strip.

browser-use imports are kept inside methods so mock mode / tests / fixtures never
require Chromium or browser-use to be installed.

VERIFY against your installed browser-use 0.9.x (these are the only runtime
touchpoints I could not execute here):
  * ``ChatOpenAI(model=...)``                         — OpenAI LLM wrapper
  * ``Browser(headless=...)``                         — per-agent session + close()
  * ``Tools()`` + ``@tools.action(description=...)``  — custom action registry
  * action arg ``browser_session: BrowserSession``    — exact name required
  * ``await browser_session.must_get_current_page()`` then
    ``await page.get_elements_by_css_selector(sel)`` / ``element.click()``
  * ``await browser_session.take_screenshot()``       — returns base64 PNG
If a method name differs in your version, the fix is localized to ``_click`` /
``_screenshot_bytes`` / ``_make_browser`` / ``_close`` below.
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import os
import time
import urllib.parse
from dataclasses import dataclass, field
from typing import Awaitable, Callable

from contracts import (
    REASON_BY_STAGE,
    AgentBailedEvent,
    AgentBoughtEvent,
    AgentThoughtEvent,
    AgentTrace,
    BrowserFrameEvent,
    GateStage,
    ListingConfig,
    ObjectionEvent,
    PersonaId,
    ReasonCategory,
    Sentiment,
    StageEnterEvent,
    StageSentimentEvent,
    StageTrace,
)
from sim.agents import PERSONAS
from sim.screenshots import save_thumbnail

EmitFn = Callable[[object], Awaitable[None]]

_VALID_SENTIMENTS: frozenset[str] = frozenset({"love", "like", "neutral", "dislike", "reject"})


def _clean_sentiment(value: str | None) -> Sentiment:
    """Coerce the LLM's free-text sentiment to a valid label; default to neutral."""
    candidate = (value or "").strip().lower()
    return candidate if candidate in _VALID_SENTIMENTS else "neutral"  # type: ignore[return-value]


_VALID_REASONS: frozenset[str] = frozenset(
    {"price_value", "trust_authenticity", "visual_photos", "social_proof_reviews", "shipping", "other"}
)


def _clean_reason(value: str | None, gate: GateStage) -> ReasonCategory:
    """Honor a valid, specific LLM reason category; else fall back to the stage default
    (more informative than a bare 'other')."""
    candidate = (value or "").strip().lower()
    if candidate in _VALID_REASONS and candidate != "other":
        return candidate  # type: ignore[return-value]
    return REASON_BY_STAGE.get(gate, "other")


def _brain_field(brain: object, field: str) -> str | None:
    """Read a field off a browser-use ``AgentBrain`` (pydantic obj) or dict, safely."""
    value = getattr(brain, field, None)
    if value is None and isinstance(brain, dict):
        value = brain.get(field)
    if value is None:
        return None
    text = str(value).strip()
    return text or None

# Funnel gate -> the H2 data-action selector that advances into it (OVERVIEW §5.6).
GATE_ACTION: dict[GateStage, str] = {
    "photos": "scroll-gallery",
    "reviews": "open-reviews",
    "price": "select-variant",
    "cart": "add-to-cart",
    "checkout": "checkout",
}
CONFIRM_ACTION = "confirm-order"
_GATE_INDEX = ["land", "photos", "reviews", "price", "cart", "checkout"]

# Gates whose data-action lives on a DIFFERENT route than the product page: click
# this CSS selector first to navigate there (verified drivable end-to-end). The
# checkout button lives on /cart, so we click the cart icon to get there. The driver
# reuses its normal click path — no special browser-use navigation API needed.
GATE_NAV: dict[GateStage, str] = {"checkout": 'a[href^="/cart"]'}


def _now_ms() -> int:
    return int(time.time() * 1000)


def _scroll_pct(gate: GateStage) -> float:
    return _GATE_INDEX.index(gate) / (len(_GATE_INDEX) - 1) if gate in _GATE_INDEX else 1.0


@dataclass
class _Journey:
    """Per-agent mutable state; the action log we build the AgentTrace from."""

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
    bail_reason: ReasonCategory | None = None  # categorized dropout reason
    purchase_reason: str | None = None  # why a buyer committed (Layer 2)
    _traces: list[StageTrace] = field(default_factory=list)
    _thoughts: list[dict] = field(default_factory=list)  # Layer 1 raw CoT log

    def elapsed(self) -> float:
        return round(time.monotonic() - self._start, 2)

    def record(
        self,
        gate: GateStage,
        screenshot_url: str | None,
        sentiment: Sentiment | None = None,
        comment: str | None = None,
    ) -> None:
        self.current_gate = gate
        self._traces.append(
            StageTrace(
                stage=gate,
                time_s=self.elapsed(),
                screenshot_url=screenshot_url,
                sentiment=sentiment,
                comment=comment,
            )
        )

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
            purchase_reason=self.purchase_reason if outcome == "bought" else None,
            bail_reason=self.bail_reason if outcome == "bailed" else None,
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
        url = self._page_url(listing_url, listing, agent_id=agent_id, run_id=run_id, archetype=archetype)
        ctx = _Journey(run_id=run_id, agent_id=agent_id, name=name, archetype=archetype, listing=listing, emit=emit)

        # land: emitted before the browser navigates, so no thumbnail yet (the first
        # real thumbnail lands at the photos gate).
        ctx.record("land", None)
        await emit(StageEnterEvent(run_id=run_id, ts=_now_ms(), agent_id=agent_id, stage="land"))

        browser = self._make_browser()
        try:
            tools = self._build_tools(ctx)
            agent = self._make_agent(name, archetype, listing, url, tools, browser)
            try:
                await agent.run(max_steps=self.max_steps, on_step_end=self._on_step(ctx))
            except Exception as exc:  # agent crash -> degrade to a clean bail
                if ctx.outcome is None:
                    await self._bail(ctx, ctx.current_gate or "land", f"(agent stopped) {str(exc)[:160]}")
            if ctx.outcome is None:  # ran out of steps without deciding
                await self._bail(ctx, ctx.current_gate or "land", "Browsed but never committed to buying.")
            return ctx.trace()
        finally:
            await self._close(browser)

    # ---- custom action registry (the constrained funnel vocabulary) ------------
    def _build_tools(self, ctx: _Journey):
        # NOTE: `browser_session` is injected by NAME by browser-use's Tools registry;
        # it must be left UNANNOTATED (annotating it raises a type-conflict error).
        from browser_use import ActionResult, Tools

        tools = Tools()

        # Every gate tool elicits the agent's in-character reaction + sentiment, so we
        # capture what each persona thinks/feels AT each stage (Layer 2), not just where
        # it went. `reaction` is a short quote; `sentiment` is one of love/like/neutral/
        # dislike/reject. browser_session stays UNANNOTATED (injected by name).
        async def gate(browser_session, name: GateStage, reaction: str, sentiment: str):
            if ctx.outcome is not None:
                return ActionResult(extracted_content="Already finished.", is_done=True)
            nav = GATE_NAV.get(name)
            if nav:  # e.g. checkout lives on /cart — click the cart icon to get there first
                await self._click_css(browser_session, nav)
                await asyncio.sleep(0.4)
            reached = await self._click(browser_session, GATE_ACTION[name])
            if not reached:
                await self._bail(ctx, name, f"Couldn't reach the {name} section — the page didn't respond.")
                return ActionResult(extracted_content=f"{name} unavailable; left the listing.", is_done=True, success=False)
            url = await self._capture(ctx, browser_session, name)
            await self._enter(ctx, name, url, sentiment=_clean_sentiment(sentiment), comment=reaction or None)
            return ActionResult(extracted_content=self._gate_summary(name, ctx.listing))

        @tools.action(description="Look at the product photo gallery. Pass `reaction` (your in-character take on the photos) and `sentiment` (love/like/neutral/dislike/reject).")
        async def look_at_photos(browser_session, reaction: str = "", sentiment: Sentiment = "neutral"):  # noqa: ANN001
            return await gate(browser_session, "photos", reaction, sentiment)

        @tools.action(description="Open and read the ratings and reviews. Pass `reaction` (your in-character take on the reviews/seller trust) and `sentiment`.")
        async def read_reviews(browser_session, reaction: str = "", sentiment: Sentiment = "neutral"):  # noqa: ANN001
            return await gate(browser_session, "reviews", reaction, sentiment)

        @tools.action(description="Check the price and pick a variant. Pass `reaction` (your in-character take on the price/value) and `sentiment`.")
        async def check_price(browser_session, reaction: str = "", sentiment: Sentiment = "neutral"):  # noqa: ANN001
            return await gate(browser_session, "price", reaction, sentiment)

        @tools.action(description="Add the item to the shopping cart. Pass `reaction` (your in-character take as you add it) and `sentiment`.")
        async def add_to_cart(browser_session, reaction: str = "", sentiment: Sentiment = "neutral"):  # noqa: ANN001
            return await gate(browser_session, "cart", reaction, sentiment)

        @tools.action(description="Proceed to the checkout page. Pass `reaction` (your in-character take on checkout trust/total) and `sentiment`.")
        async def checkout(browser_session, reaction: str = "", sentiment: Sentiment = "neutral"):  # noqa: ANN001
            return await gate(browser_session, "checkout", reaction, sentiment)

        @tools.action(description="Confirm and place the order. Only call this if you genuinely decide to buy. Pass `reason` — your in-character reason for buying.")
        async def confirm_purchase(browser_session, reason: str = ""):  # noqa: ANN001
            if ctx.outcome is not None:
                return ActionResult(extracted_content="Already finished.", is_done=True)
            await self._click(browser_session, CONFIRM_ACTION)
            url = await self._capture(ctx, browser_session, "checkout")
            ctx.outcome = "bought"
            ctx.purchase_reason = reason or None
            if reason:
                # surface the buy rationale in the live sentiment/comment feed too
                await ctx.emit(StageSentimentEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, stage="checkout", sentiment="love", comment=reason))
            await ctx.emit(AgentBoughtEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, retention_time_s=ctx.elapsed()))
            return ActionResult(extracted_content="Order confirmed — purchased.", is_done=True, success=True)

        @tools.action(description="Leave the listing without buying. Give your exact in-character `objection`, and a `reason_category` (price_value/trust_authenticity/visual_photos/social_proof_reviews/shipping/other).")
        async def bail(browser_session, objection: str, reason_category: ReasonCategory = "other"):  # noqa: ANN001
            await self._capture(ctx, browser_session, ctx.current_gate or "land")
            await self._bail(ctx, ctx.current_gate or "land", objection, reason_category)
            return ActionResult(extracted_content=f"Left without buying: {objection}", is_done=True, success=True)

        return tools

    # ---- live emission helpers -------------------------------------------------
    async def _enter(
        self,
        ctx: _Journey,
        gate: GateStage,
        thumbnail_url: str | None,
        sentiment: Sentiment | None = None,
        comment: str | None = None,
    ) -> None:
        ctx.record(gate, thumbnail_url, sentiment=sentiment, comment=comment)
        await ctx.emit(StageEnterEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, stage=gate, thumbnail_url=thumbnail_url))
        if thumbnail_url:
            await ctx.emit(
                BrowserFrameEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, thumbnail_url=thumbnail_url, scroll_pct=_scroll_pct(gate))
            )
        if sentiment and comment:
            await ctx.emit(StageSentimentEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, stage=gate, sentiment=sentiment, comment=comment))

    async def _bail(self, ctx: _Journey, gate: GateStage, objection: str, reason_category: str | None = None) -> None:
        if ctx.outcome is not None:
            return
        reason = _clean_reason(reason_category, gate)
        ctx.outcome, ctx.bail_stage, ctx.objection, ctx.bail_reason = "bailed", gate, objection, reason
        await ctx.emit(StageSentimentEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, stage=gate, sentiment="reject", comment=objection))
        await ctx.emit(ObjectionEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, stage=gate, text=objection))
        await ctx.emit(
            AgentBailedEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, stage=gate, objection=objection, retention_time_s=ctx.elapsed(), reason_category=reason)
        )

    # ---- prompt assembly (reuses H4's PERSONAS) --------------------------------
    def _make_agent(self, name: str, archetype: PersonaId, listing: ListingConfig, url: str, tools, browser):
        from browser_use import Agent, ChatOpenAI

        return Agent(
            task=self._task(name, archetype, listing, url),
            llm=ChatOpenAI(model=self.model),
            tools=tools,
            browser=browser,
            extend_system_message=self._persona_system_message(name, archetype),
        )

    @staticmethod
    def _persona_system_message(name: str, archetype: PersonaId) -> str:
        """Inject the persona into the SYSTEM prompt so the agent's own chain-of-thought
        (Layer 1) reasons in character, not just the task prompt."""
        persona = PERSONAS[archetype]
        return (
            f"\n\nROLE-PLAY: You are {name}, a {persona.display} shopper in Singapore "
            f"({persona.tag}). {persona.blurb}\n"
            "Stay in character for ALL of your reasoning: in every `thinking` step, react to "
            "the photos, reviews, price, seller trust and authenticity the way THIS persona "
            "would. When you call a funnel action, fill its `reaction` with a short first-person "
            "line in your voice and set `sentiment` honestly (love/like/neutral/dislike/reject)."
        )

    def _on_step(self, ctx: _Journey):
        """Return an ``on_step_end`` hook that captures browser-use's own per-step
        reasoning (AgentBrain) and streams it as ``AgentThoughtEvent`` (Layer 1).

        Only NEW thoughts are emitted (we track how many we've seen). The hook is
        fully defensive: observability must never break the agent run.
        """
        seen = {"n": 0}

        async def hook(agent) -> None:  # noqa: ANN001 — browser-use passes the Agent
            try:
                thoughts = agent.history.model_thoughts()
                if not thoughts or len(thoughts) <= seen["n"]:
                    return
                seen["n"] = len(thoughts)
                brain = thoughts[-1]
                thinking = _brain_field(brain, "thinking") or _brain_field(brain, "next_goal")
                if not thinking:
                    return
                stage = ctx.current_gate or "land"
                ctx._thoughts.append({"stage": stage, "thinking": thinking})
                await ctx.emit(
                    AgentThoughtEvent(
                        run_id=ctx.run_id,
                        ts=_now_ms(),
                        agent_id=ctx.agent_id,
                        stage=stage,
                        thinking=thinking,
                        evaluation=_brain_field(brain, "evaluation_previous_goal"),
                        next_goal=_brain_field(brain, "next_goal"),
                    )
                )
            except Exception:
                return  # never let a reasoning-capture hiccup kill the journey

        return hook

    def _task(self, name: str, archetype: PersonaId, listing: ListingConfig, url: str) -> str:
        persona = PERSONAS[archetype]
        examples = "; ".join(self._objection_examples(archetype))
        return (
            f"You are {name}, a {persona.display} shopper in Singapore ({persona.tag}).\n"
            f"{persona.blurb}\n\n"
            f"Shop this Shopee listing. Start by opening it: {url}\n\n"
            f"What you can see about the listing:\n{self._facts(listing)}\n\n"
            "How to shop — use ONLY these actions to move through the funnel (do not free-click to navigate):\n"
            "  look_at_photos -> read_reviews -> check_price -> add_to_cart -> checkout, in that order.\n"
            "  At EACH step pass `reaction` (a short first-person line in your voice about what you just\n"
            "  saw) and `sentiment` (love/like/neutral/dislike/reject) — this is how we record what you think.\n"
            "  confirm_purchase — only if you genuinely decide to buy; pass `reason` (why you're buying).\n"
            "  bail — the moment something puts you off; state your exact objection in character and a\n"
            "  `reason_category` (price_value/trust_authenticity/visual_photos/social_proof_reviews/shipping/other).\n\n"
            f"Stay fully in character. If you bail, phrase it like these Singlish lines: {examples}\n"
            f"Decide the way {persona.display} really would for THIS listing."
        )

    @staticmethod
    def _objection_examples(archetype: PersonaId) -> list[str]:
        out: list[str] = []
        for value in PERSONAS[archetype].objections.values():
            # agents.py mixes tuples and the occasional bare string — handle both.
            out.extend(value if isinstance(value, tuple) else (value,))
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

    @staticmethod
    def _gate_summary(gate: GateStage, listing: ListingConfig) -> str:
        a = listing.authenticity
        total = listing.price + listing.shipping.fee
        if gate == "photos":
            lifestyle = sum(1 for p in listing.photos if p.type == "lifestyle")
            closeup = sum(1 for p in listing.photos if p.type == "closeup")
            return f"Photos: {len(listing.photos)} total, {lifestyle} lifestyle, {closeup} close-up."
        if gate == "reviews":
            return f"Rating {listing.rating.score}/5 from {listing.rating.count}; seller replies to {listing.seller.response_rate:.0f}%."
        if gate == "price":
            return f"Price S${listing.price:.2f} (usual S${listing.base_price:.2f}), + shipping S${listing.shipping.fee:.2f}."
        if gate == "cart":
            return f"In cart: S${listing.price:.2f} + S${listing.shipping.fee:.2f} shipping = S${total:.2f}."
        return f"Checkout total ~S${total:.2f}. Authenticity proof: cert={a.certificate}, serial={a.serial}, unboxing={a.unboxing}."

    def _page_url(
        self,
        slug: str,
        listing: ListingConfig,
        *,
        agent_id: str | None = None,
        run_id: str | None = None,
        archetype: PersonaId | None = None,
    ) -> str:
        """The React product route + the listing config, so the agent browses exactly
        the listing we're simulating (and mutated reruns render). ``loadConfig.ts`` reads
        ``?config=<base64 of UTF-8 JSON>``; URL-quote it so ``+ / =`` survive URLSearchParams."""
        cfg = base64.b64encode(listing.model_dump_json().encode("utf-8")).decode("ascii")
        params = {
            "config": cfg,
            "agent_id": agent_id,
            "run_id": run_id,
            "persona": archetype,
        }
        query = urllib.parse.urlencode({k: v for k, v in params.items() if v})
        return f"{self.base_url}/shopee/{slug}?{query}"

    # ---- browser-use runtime touchpoints (isolated; see VERIFY in module docstring)
    def _make_browser(self):
        from browser_use import Browser

        return Browser(headless=self.headless)

    async def _click(self, browser_session, action: str) -> bool:
        """Click the funnel action button by its data-action hook."""
        return await self._click_css(browser_session, f'[data-action="{action}"]')

    async def _click_css(self, browser_session, selector: str) -> bool:
        """Click the first element matching a CSS selector (used for both data-action
        buttons and route links like the cart icon)."""
        try:
            page = await browser_session.must_get_current_page()
            elements = await page.get_elements_by_css_selector(selector)
            if not elements:
                return False
            await elements[0].click()
            await asyncio.sleep(0.4)  # let the page settle before screenshotting
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
