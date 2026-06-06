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
import re
import time
import urllib.parse
from dataclasses import dataclass, field
from typing import Awaitable, Callable

from contracts import (
    REASON_BY_STAGE,
    AgentBailedEvent,
    AgentBoughtEvent,
    AgentDivertedEvent,
    AgentThoughtEvent,
    AgentTrace,
    BrowserFrameEvent,
    GateStage,
    ListingConfig,
    ObjectionEvent,
    PersonaId,
    PersonaProfile,
    ReasonCategory,
    Sentiment,
    StageEnterEvent,
    StageSentimentEvent,
    StageTrace,
)
from sim.agents import PERSONAS
from sim.decision import decide, synth_purchase_reason, synth_reaction
from sim.screenshots import save_thumbnail
from sim.storefront import (
    CandidateListing,
    cheaper_alternative,
    choose_listing,
    competitor_objection,
)

# Search term every agent keys in before free browsing (mandatory funnel-entry route).
SEARCH_KEYWORD = "beanie"

_SHOPEE_PATH = re.compile(r"/shopee/([^/?#]+)")


def listing_id_from_url(url: str | None) -> str | None:
    """Parse the listing slug from a product URL (``…/shopee/<slug>?…``)."""
    if not url:
        return None
    match = _SHOPEE_PATH.search(url)
    return match.group(1) if match else None


def _parse_price(text: str | None) -> float | None:
    """Pull a numeric price out of a card label like ``"S$45.90"`` → ``45.9``."""
    if not text:
        return None
    match = re.search(r"\d+(?:\.\d+)?", text.replace(",", ""))
    return float(match.group()) if match else None

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
    profile: PersonaProfile | None = None
    _start: float = field(default_factory=time.monotonic)
    current_gate: GateStage | None = None
    outcome: str | None = None  # None until the agent buys/bails
    bail_stage: GateStage | None = None
    objection: str | None = None
    bail_reason: ReasonCategory | None = None  # categorized dropout reason
    purchase_reason: str | None = None  # why a buyer committed (Layer 2)
    # ── competitive attribution (free-browsing real mode) ────────────────────
    landed_on_target: bool = False  # set True once the tracked PDP is opened
    chosen_listing_id: str | None = None  # product actually bought (None if left)
    divert_stage: GateStage | None = None  # where on OUR funnel they peeled off
    competitor_id: str | None = None
    competitor_title: str | None = None
    last_listing_id: str | None = None  # most recent /shopee/<id> the agent viewed
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
        # stage_trace records ONLY the tracked listing's gates. Agents who never
        # opened our PDP (chose a competitor straight from search) keep it empty so
        # the funnel rollup doesn't miscount them as having landed.
        if self._traces:
            stage_trace = list(self._traces)
        elif self.landed_on_target:
            stage_trace = [StageTrace(stage="land", time_s=self.elapsed())]
        else:
            stage_trace = []
        return AgentTrace(
            agent_id=self.agent_id,
            name=self.name,
            archetype=self.archetype,
            outcome=outcome,  # type: ignore[arg-type]
            bail_stage=self.bail_stage if outcome == "bailed" else None,
            objection=self.objection if outcome == "bailed" else None,
            retention_time_s=self.elapsed(),
            stage_trace=stage_trace,
            purchase_reason=self.purchase_reason if outcome == "bought" else None,
            bail_reason=self.bail_reason if outcome == "bailed" else None,
            landed_on_target=self.landed_on_target,
            chosen_listing_id=self.chosen_listing_id,
            divert_stage=self.divert_stage,
            competitor_id=self.competitor_id,
            competitor_title=self.competitor_title,
            profile=self.profile,
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
        agent_timeout_s: float | None = None,
    ) -> None:
        self.listing = listing
        self.model = model
        self.max_steps = max_steps
        self.headless = headless
        self.agent_timeout_s = agent_timeout_s or float(os.environ.get("BROWSER_USE_AGENT_TIMEOUT_S", "20"))
        self.autonomous = os.environ.get("BROWSER_USE_AUTONOMOUS", "0") == "1"
        # The runner passes the listing *slug* (run.listing.id); we build storefront
        # URLs from a configurable base. Default points at H2's Vite dev server on
        # :5174; override via LISTING_BASE_URL (one-line swap, no code change).
        self.base_url = (base_url or os.environ.get("LISTING_BASE_URL", "http://localhost:5174")).rstrip("/")
        self.target_id = listing.id  # the ONE listing every metric is tracked against

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
        profile: PersonaProfile | None = None,
    ) -> AgentTrace:
        ctx = _Journey(run_id=run_id, agent_id=agent_id, name=name, archetype=archetype, listing=listing, emit=emit, profile=profile)

        # Every agent enters through the storefront (home → search "beanie") and only
        # then browses freely. We do NOT emit a funnel `land` here — `land` means the
        # agent opened the TRACKED listing's PDP, which happens later (or never, if
        # they pick a competitor straight from the results).
        if not self.autonomous:
            return await self._run_guided_browser_fallback(ctx, seed)

        browser = self._make_browser()
        try:
            tools = self._build_tools(ctx)
            agent = self._make_agent(ctx, tools, browser)
            try:
                await asyncio.wait_for(
                    agent.run(max_steps=self.max_steps, on_step_end=self._on_step(ctx)),
                    timeout=self.agent_timeout_s,
                )
            except TimeoutError:
                pass  # fall through to the "never committed" handling below
            except Exception as exc:  # agent crash -> deterministic journey if nothing happened
                if ctx.outcome is None and not ctx._traces and not ctx.landed_on_target:
                    return await self._run_guided_browser_fallback(ctx, seed, f"browser-use fallback: {str(exc)[:120]}")
            if ctx.outcome is None:
                if not ctx._traces and not ctx.landed_on_target:
                    # The autonomous agent never got going → run the deterministic journey.
                    return await self._run_guided_browser_fallback(ctx, seed)
                await self._bail(ctx, ctx.current_gate or "land", "Browsed around but never committed to buying.")
            return ctx.trace()
        finally:
            await self._close(browser)

    async def _run_guided_browser_fallback(
        self,
        ctx: _Journey,
        seed: int,
        note: str | None = None,
    ) -> AgentTrace:
        """Deterministic real-mode journey (the default real path, and the autonomous
        fallback). Drives the real Shopee frontend in Chromium: home → search "beanie"
        → pick a product (target-biased, may choose a competitor) → funnel the TRACKED
        listing with the mock decision model. Every recorded metric is about the tracked
        listing only; a competitor purchase is attributed as a divert, never a buy.
        """
        from playwright.async_api import async_playwright

        async def click(page, selector: str) -> bool:  # noqa: ANN001
            try:
                loc = page.locator(selector).first
                if await loc.count() == 0:
                    return False
                await loc.scroll_into_view_if_needed(timeout=3000)
                await loc.click(timeout=3000)
                await page.wait_for_timeout(450)
                return True
            except Exception:
                return False

        async def shot(page, gate: GateStage) -> str | None:  # noqa: ANN001
            try:
                return await asyncio.to_thread(save_thumbnail, await page.screenshot(full_page=False), ctx.agent_id, gate)
            except Exception:
                return None

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1280, "height": 900})
            try:
                # 1. Home — the ?mk_config bootstrap writes the sessionStorage override here.
                await page.goto(self._home_url(ctx), wait_until="domcontentloaded", timeout=8000)
                await page.wait_for_timeout(500)
                home_thumb = await shot(page, "land")
                if home_thumb:
                    await ctx.emit(BrowserFrameEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, thumbnail_url=home_thumb, scroll_pct=0.0))
                if note:
                    await ctx.emit(StageSentimentEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, stage="land", sentiment="neutral", comment=note))

                # 2. Mandatory search route — every agent goes through "beanie" results.
                await page.goto(self._search_url(ctx), wait_until="domcontentloaded", timeout=8000)
                await page.wait_for_timeout(600)
                search_thumb = await shot(page, "land")
                if search_thumb:
                    await ctx.emit(BrowserFrameEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, thumbnail_url=search_thumb, scroll_pct=0.0))

                # 3. Read the result cards; let this persona freely choose one.
                candidates = await self._scrape_candidates(page)
                by_id = {c.id: c for c in candidates}
                chosen_id = choose_listing(seed, ctx.agent_id, ctx.archetype, candidates) if candidates else self.target_id

                if chosen_id != self.target_id and chosen_id in by_id:
                    # Picked a competitor straight from search — diverted before landing.
                    await self._open_product(page, click, ctx, chosen_id)
                    await self._divert(ctx, "land", by_id[chosen_id], await shot(page, "land"))
                    return ctx.trace()

                # 4. Chose the tracked listing → open it and run OUR funnel.
                await self._open_product(page, click, ctx, self.target_id)
                ctx.landed_on_target = True
                await self._enter(ctx, "land", await shot(page, "land"))

                for gate in ("photos", "reviews", "price", "cart", "checkout"):
                    nav = GATE_NAV.get(gate)  # type: ignore[arg-type]
                    if nav:
                        await click(page, nav)
                    reached = await click(page, f'[data-action="{GATE_ACTION[gate]}"]')  # type: ignore[index]
                    if not reached:
                        await self._bail(ctx, gate, f"Couldn't reach the {gate} section — the page didn't respond.")
                        break

                    thumb = await shot(page, gate)
                    decision = decide(seed, ctx.agent_id, ctx.archetype, gate, ctx.listing, ctx.profile)
                    if decision.action == "bail":
                        objection = decision.objection or "Not convinced enough to buy."
                        await self._enter(ctx, gate, thumb, sentiment="reject", comment=objection)
                        await self._bail(ctx, gate, objection)
                        break
                    sentiment, comment = synth_reaction(ctx.archetype, gate, decision.probability)
                    await self._enter(ctx, gate, thumb, sentiment=sentiment, comment=comment)

                    # After engaging the price, a price-sensitive shopper may leave for a
                    # clearly cheaper card they saw in the results.
                    if gate == "price":
                        alt = cheaper_alternative(seed, ctx.agent_id, ctx.archetype, ctx.listing.price, candidates)
                        if alt is not None:
                            await page.goto(self._product_url(ctx, alt.id), wait_until="domcontentloaded", timeout=8000)
                            await page.wait_for_timeout(400)
                            await self._divert(ctx, "price", alt, await shot(page, "price"))
                            break

                if ctx.outcome is None:
                    await click(page, f'[data-action="{CONFIRM_ACTION}"]')
                    thumb = await shot(page, "checkout")
                    reason = synth_purchase_reason(ctx.archetype)
                    ctx.outcome = "bought"
                    ctx.chosen_listing_id = self.target_id
                    ctx.purchase_reason = reason
                    if thumb:
                        await ctx.emit(BrowserFrameEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, thumbnail_url=thumb, scroll_pct=1.0))
                    await ctx.emit(StageSentimentEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, stage="checkout", sentiment="love", comment=reason))
                    await ctx.emit(AgentBoughtEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, retention_time_s=ctx.elapsed()))
            finally:
                await browser.close()

        return ctx.trace()

    # ---- storefront helpers (guided path: raw Playwright `page`) ----------------
    async def _scrape_candidates(self, page) -> list[CandidateListing]:  # noqa: ANN001
        """Read the visible search-result cards into choice candidates."""
        out: dict[str, CandidateListing] = {}
        try:
            cards = page.locator('[data-action="open-listing"]')
            count = await cards.count()
        except Exception:
            return []
        for i in range(min(count, 24)):
            card = cards.nth(i)
            try:
                listing_id = await card.get_attribute("data-listing-id")
                if not listing_id or listing_id in out:
                    continue
                title = (await self._field_text(card, "listing-card-title")) or listing_id
                price = _parse_price(await self._field_text(card, "listing-card-price"))
                if price is None:
                    continue
                out[listing_id] = CandidateListing(
                    id=listing_id, title=title.strip(), price=price, is_target=(listing_id == self.target_id)
                )
            except Exception:
                continue
        return list(out.values())

    @staticmethod
    async def _field_text(card, field_name: str) -> str | None:  # noqa: ANN001
        try:
            loc = card.locator(f'[data-field="{field_name}"]').first
            if await loc.count() == 0:
                return None
            return await loc.inner_text()
        except Exception:
            return None

    async def _open_product(self, page, click, ctx: _Journey, listing_id: str) -> None:  # noqa: ANN001
        """Open a product by clicking its result card (fallback: navigate directly)."""
        opened = await click(page, f'[data-action="open-listing"][data-listing-id="{listing_id}"]')
        if not opened:
            await page.goto(self._product_url(ctx, listing_id), wait_until="domcontentloaded", timeout=8000)
            await page.wait_for_timeout(400)
        ctx.last_listing_id = listing_id

    # ---- competitive divert (shared by both paths) ------------------------------
    async def _divert(self, ctx: _Journey, from_stage: GateStage, competitor: CandidateListing, thumbnail_url: str | None = None) -> None:
        """Finalize a journey where the agent left the tracked listing to buy a
        competitor: a non-conversion for us, attributed to the winning product."""
        if ctx.outcome is not None:
            return
        objection = competitor_objection(ctx.archetype, competitor)
        ctx.outcome = "bailed"
        ctx.divert_stage = from_stage
        # Only count it against OUR funnel stage if they had actually landed on us.
        ctx.bail_stage = from_stage if ctx.landed_on_target else None
        ctx.objection = objection
        ctx.bail_reason = "chose_competitor"
        ctx.competitor_id = competitor.id
        ctx.competitor_title = competitor.title
        ctx.chosen_listing_id = competitor.id
        ctx.last_listing_id = competitor.id
        if thumbnail_url:
            await ctx.emit(BrowserFrameEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, thumbnail_url=thumbnail_url, scroll_pct=_scroll_pct(from_stage)))
        # The diverted event fully represents this outcome for the dashboard (which
        # marks the agent "diverted" and tallies the competitor). We deliberately do
        # NOT also emit agent_bailed: the objection lives on the trace for the report,
        # and a second terminal event would muddy the live agent state.
        await ctx.emit(AgentDivertedEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, from_stage=from_stage, competitor=competitor.id, competitor_name=competitor.title, converted=True, reason=objection))

    async def _current_listing_id(self, browser_session) -> str | None:  # noqa: ANN001
        """The tracked-vs-competitor signal for the autonomous path: parse the listing
        slug from the current ``/shopee/<slug>`` URL."""
        try:
            page = await browser_session.must_get_current_page()
            url = getattr(page, "url", None)
            if asyncio.iscoroutine(url):
                url = await url
            return listing_id_from_url(url if isinstance(url, str) else None)
        except Exception:
            return None

    async def _current_competitor(self, browser_session, listing_id: str) -> CandidateListing:  # noqa: ANN001
        """Best-effort snapshot of the competitor PDP the autonomous agent is buying."""
        title = listing_id.replace("-", " ").replace("_", " ").title()
        price = 0.0
        try:
            page = await browser_session.must_get_current_page()
            if hasattr(page, "evaluate"):
                data = await page.evaluate(
                    "() => ({t: document.querySelector('[data-field=\"title\"]')?.textContent,"
                    " p: document.querySelector('[data-field=\"price\"]')?.textContent})"
                )
                if isinstance(data, dict):
                    title = (data.get("t") or title).strip()
                    price = _parse_price(data.get("p")) or price
        except Exception:
            pass
        return CandidateListing(id=listing_id, title=title, price=price, is_target=False)

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
            # Which PDP is the agent on? Only the TRACKED listing's gates are recorded;
            # the same funnel buttons exist on competitor PDPs but never count for us.
            current = await self._current_listing_id(browser_session)
            if current:
                ctx.last_listing_id = current
            on_target = current == self.target_id or (current is None and ctx.last_listing_id == self.target_id)
            nav = GATE_NAV.get(name)
            if nav:  # e.g. checkout lives on /cart — click the cart icon to get there first
                await self._click_css(browser_session, nav)
                await asyncio.sleep(0.4)
            reached = await self._click(browser_session, GATE_ACTION[name])
            if not on_target:
                # Browsing a competitor — let the agent proceed but record nothing for us.
                return ActionResult(extracted_content="(Not the tracked Matin Kim listing — this won't count toward its metrics.)")
            if not reached:
                await self._bail(ctx, name, f"Couldn't reach the {name} section — the page didn't respond.")
                return ActionResult(extracted_content=f"{name} unavailable; left the listing.", is_done=True, success=False)
            ctx.landed_on_target = True
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
            current = await self._current_listing_id(browser_session)
            effective = current or ctx.last_listing_id
            await self._click(browser_session, CONFIRM_ACTION)
            if effective and effective != self.target_id:
                # Bought a competitor — a loss for the tracked listing, attributed.
                competitor = await self._current_competitor(browser_session, effective)
                thumb = await self._capture(ctx, browser_session, ctx.current_gate or "land")
                await self._divert(ctx, ctx.current_gate or "land", competitor, thumb)
                return ActionResult(extracted_content=f"Bought a different product ({competitor.title}) instead.", is_done=True, success=True)
            url = await self._capture(ctx, browser_session, "checkout")
            ctx.outcome = "bought"
            ctx.landed_on_target = True
            ctx.chosen_listing_id = self.target_id
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
        ctx.outcome, ctx.objection, ctx.bail_reason = "bailed", objection, reason
        # Don't attribute the drop to one of OUR funnel stages if they never landed on
        # the tracked listing (e.g. left the storefront from the search results).
        ctx.bail_stage = gate if ctx.landed_on_target else None
        await ctx.emit(StageSentimentEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, stage=gate, sentiment="reject", comment=objection))
        await ctx.emit(ObjectionEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, stage=gate, text=objection))
        await ctx.emit(
            AgentBailedEvent(run_id=ctx.run_id, ts=_now_ms(), agent_id=ctx.agent_id, stage=gate, objection=objection, retention_time_s=ctx.elapsed(), reason_category=reason)
        )

    # ---- prompt assembly (reuses H4's PERSONAS) --------------------------------
    def _make_agent(self, ctx: _Journey, tools, browser):
        from browser_use import Agent, ChatOpenAI

        return Agent(
            task=self._task(ctx),
            llm=ChatOpenAI(model=self.model),
            tools=tools,
            browser=browser,
            extend_system_message=self._persona_system_message(ctx.name, ctx.archetype, ctx.profile),
        )

    @staticmethod
    def _persona_system_message(name: str, archetype: PersonaId, profile: PersonaProfile | None = None) -> str:
        """Inject the persona into the SYSTEM prompt so the agent's own chain-of-thought
        (Layer 1) reasons in character, not just the task prompt."""
        persona = PERSONAS[archetype]
        life = f" Your life right now: {profile.blurb}." if profile else ""
        return (
            f"\n\nROLE-PLAY: You are {name}, a {persona.display} shopper in Singapore "
            f"({persona.tag}). {persona.blurb}{life}\n"
            "Stay in character for ALL of your reasoning: in every `thinking` step, react to "
            "the photos, reviews, price, seller trust and authenticity the way THIS persona "
            "would, taking your life circumstances (income, age, family) into account. When you "
            "call a funnel action, fill its `reaction` with a short first-person line in your "
            "voice and set `sentiment` honestly (love/like/neutral/dislike/reject)."
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

    def _task(self, ctx: _Journey) -> str:
        persona = PERSONAS[ctx.archetype]
        examples = "; ".join(self._objection_examples(ctx.archetype))
        life = f"Your life right now: {ctx.profile.blurb}.\n" if ctx.profile else ""
        return (
            f"You are {ctx.name}, a {persona.display} shopper in Singapore ({persona.tag}).\n"
            f"{persona.blurb}\n{life}\n"
            f"You begin on the Shopee home page: {self._home_url(ctx)}\n"
            "FIRST, search for a beanie: type \"beanie\" into the search bar at the top and press Enter "
            f"(or open {self._search_url(ctx)}). You MUST go through the search results before opening any product.\n\n"
            "Then browse FREELY, the way you really would: open whichever beanie listings catch your eye, "
            "compare them, and either buy the one you genuinely want or leave without buying. You are NOT "
            "required to buy any particular product.\n\n"
            "When you are looking at a product you like, use these actions to work through it and record what "
            "you think:\n"
            "  look_at_photos -> read_reviews -> check_price -> add_to_cart -> checkout.\n"
            "  At EACH step pass `reaction` (a short first-person line in your voice) and `sentiment` "
            "(love/like/neutral/dislike/reject).\n"
            "  confirm_purchase — when you genuinely decide to buy whatever is in front of you; pass `reason`.\n"
            "  bail — if you leave without buying anything; give your objection and a `reason_category`.\n\n"
            f"Stay fully in character. If you bail, phrase it like these Singlish lines: {examples}\n"
            f"Decide the way {persona.display} really would."
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

    def _sim_params(self, ctx: _Journey, *, with_config: bool = False) -> dict[str, str]:
        """The sim-session params the frontend threads across navigation. ``mk_config``
        (base64 of the tracked listing) is included only on the home entry: a one-time
        bootstrap writes it into the sessionStorage override (loadConfig.ts), so the
        tracked PDP and its search card render the exact simulated/mutated listing even
        though in-app links only carry agent_id/run_id/persona."""
        params = {"agent_id": ctx.agent_id, "run_id": ctx.run_id, "persona": ctx.archetype}
        if with_config:
            params["mk_config"] = base64.b64encode(ctx.listing.model_dump_json().encode("utf-8")).decode("ascii")
        return params

    def _home_url(self, ctx: _Journey) -> str:
        return f"{self.base_url}/?{urllib.parse.urlencode(self._sim_params(ctx, with_config=True))}"

    def _search_url(self, ctx: _Journey) -> str:
        params = {"keyword": SEARCH_KEYWORD, **self._sim_params(ctx)}
        return f"{self.base_url}/search?{urllib.parse.urlencode(params)}"

    def _product_url(self, ctx: _Journey, slug: str) -> str:
        return f"{self.base_url}/shopee/{slug}?{urllib.parse.urlencode(self._sim_params(ctx))}"

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
