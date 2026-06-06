from __future__ import annotations

from dataclasses import dataclass
from typing import Awaitable, Callable, Protocol

from contracts import AgentTrace, GateStage, ListingConfig, PersonaId


@dataclass
class PageState:
    text: str
    screenshot_url: str | None
    scroll_pct: float


class BrowserSession(Protocol):
    agent_id: str


class BrowserDriver(Protocol):
    async def open(self, listing_url: str, agent_id: str) -> BrowserSession: ...
    async def goto_gate(self, s: BrowserSession, gate: str) -> PageState: ...
    async def act(self, s: BrowserSession, action: str) -> PageState: ...
    async def screenshot(self, s: BrowserSession) -> str | None: ...
    async def close(self, s: BrowserSession) -> None: ...


class AgenticJourneyDriver(Protocol):
    """High-level per-agent seam: the runner calls ``run_journey`` once per agent.

    If ``run_journey`` also accepts ``emit`` (and ``run_id``), the runner passes
    them and the driver streams ``AgentEvent``s LIVE from inside its run (H3's real
    driver). Otherwise the runner replays the returned trace post-hoc (legacy).
    """

    async def run_journey(
        self,
        listing_url: str,
        agent_id: str,
        name: str,
        archetype: PersonaId,
        listing: ListingConfig,
        seed: int,
        run_id: str = ...,
        emit: Callable[[object], Awaitable[None]] | None = ...,
    ) -> AgentTrace: ...


@dataclass
class MockBrowserSession:
    agent_id: str
    listing: ListingConfig
    gate: GateStage = "land"


class MockBrowserDriver:
    def __init__(self, listing: ListingConfig, thumbnail_base_url: str = "/static/mock") -> None:
        self.listing = listing
        self.thumbnail_base_url = thumbnail_base_url.rstrip("/")

    async def open(self, listing_url: str, agent_id: str) -> MockBrowserSession:
        return MockBrowserSession(agent_id=agent_id, listing=self.listing)

    async def goto_gate(self, s: MockBrowserSession, gate: str) -> PageState:
        s.gate = gate  # type: ignore[assignment]
        return PageState(text=self._summary(gate), screenshot_url=await self.screenshot(s), scroll_pct=self._scroll(gate))

    async def act(self, s: MockBrowserSession, action: str) -> PageState:
        return PageState(text=self._summary(s.gate), screenshot_url=await self.screenshot(s), scroll_pct=self._scroll(s.gate))

    async def screenshot(self, s: MockBrowserSession) -> str:
        return f"{self.thumbnail_base_url}/{self.listing.id}/{s.agent_id}/{s.gate}.png"

    async def close(self, s: MockBrowserSession) -> None:
        return None

    def _summary(self, gate: str) -> str:
        listing = self.listing
        lifestyle = sum(1 for p in listing.photos if p.type == "lifestyle")
        closeups = sum(1 for p in listing.photos if p.type == "closeup")
        auth = listing.authenticity
        return (
            f"Gate: {gate}. Title: {listing.title}. Price: S${listing.price:.2f}. "
            f"Base price: S${listing.base_price:.2f}. Shipping: S${listing.shipping.fee:.2f}. "
            f"Seller: {listing.seller.name}, verified={listing.seller.verified}, "
            f"response_rate={listing.seller.response_rate}%. Rating: {listing.rating.score} "
            f"from {listing.rating.count} reviews. Photos: {len(listing.photos)} total, "
            f"{lifestyle} lifestyle, {closeups} closeup. Authenticity: certificate={auth.certificate}, "
            f"serial={auth.serial}, unboxing={auth.unboxing}."
        )

    @staticmethod
    def _scroll(gate: str) -> float:
        order = ["land", "photos", "reviews", "price", "cart", "checkout"]
        return order.index(gate) / max(len(order) - 1, 1) if gate in order else 1.0
