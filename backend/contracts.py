from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


FunnelStage = Literal["land", "photos", "reviews", "price", "cart", "checkout", "bought", "bailed"]
GateStage = Literal["land", "photos", "reviews", "price", "cart", "checkout"]
PersonaId = Literal["xmm", "auntie", "nerd", "geek", "insecure", "budget", "high_spender"]
RunMode = Literal["mock", "real"]

GATE_ORDER: list[GateStage] = ["land", "photos", "reviews", "price", "cart", "checkout"]


class Seller(BaseModel):
    name: str
    verified: bool = False
    rating: float = Field(ge=0, le=5)
    response_rate: float = Field(ge=0, le=100)


class Variant(BaseModel):
    name: str
    options: list[str]


class Photo(BaseModel):
    url: str
    type: Literal["product", "lifestyle", "closeup"]


class Rating(BaseModel):
    score: float = Field(ge=0, le=5)
    count: int = Field(ge=0)


class Review(BaseModel):
    author: str
    rating: int = Field(ge=1, le=5)
    text: str
    date: str
    seller_response: str | None = None


class Authenticity(BaseModel):
    certificate: bool = False
    serial: bool = False
    unboxing: bool = False


class Shipping(BaseModel):
    fee: float = Field(ge=0)
    days: str


class ListingConfig(BaseModel):
    id: str
    title: str
    seller: Seller
    price: float = Field(gt=0)
    base_price: float = Field(gt=0)
    variants: list[Variant]
    photos: list[Photo]
    description: str
    rating: Rating
    reviews: list[Review]
    authenticity: Authenticity
    category: list[str]
    shipping: Shipping


class CrowdConfig(BaseModel):
    personas: list[PersonaId]
    crowd_size: int = Field(default=60, ge=1, le=200)
    speed: Literal[1, 2, 4] = 4
    seed: int | None = None

    @field_validator("personas")
    @classmethod
    def personas_must_not_be_empty(cls, value: list[PersonaId]) -> list[PersonaId]:
        if not value:
            raise ValueError("at least one persona must be selected")
        return value


class StartSimulationRequest(BaseModel):
    listing_config: ListingConfig
    crowd: CrowdConfig
    mode: RunMode = "mock"


class RerunSimulationRequest(BaseModel):
    listing_config: ListingConfig | None = None
    config_patch: list[dict[str, Any]] | None = None
    from_recommendation: str | None = None


class RunResponse(BaseModel):
    run_id: str
    seed: int
    parent_run_id: str | None = None


class RunStartedEvent(BaseModel):
    type: Literal["run_started"] = "run_started"
    run_id: str
    ts: int
    listing: dict[str, str | float]
    agents_total: int


class AgentSpawnedEvent(BaseModel):
    type: Literal["agent_spawned"] = "agent_spawned"
    run_id: str
    ts: int
    agent_id: str
    name: str
    archetype: PersonaId


class StageEnterEvent(BaseModel):
    type: Literal["stage_enter"] = "stage_enter"
    run_id: str
    ts: int
    agent_id: str
    stage: FunnelStage
    thumbnail_url: str | None = None


class BrowserFrameEvent(BaseModel):
    type: Literal["browser_frame"] = "browser_frame"
    run_id: str
    ts: int
    agent_id: str
    thumbnail_url: str
    scroll_pct: float | None = None


class ObjectionEvent(BaseModel):
    type: Literal["objection"] = "objection"
    run_id: str
    ts: int
    agent_id: str
    stage: FunnelStage
    text: str


class AgentBailedEvent(BaseModel):
    type: Literal["agent_bailed"] = "agent_bailed"
    run_id: str
    ts: int
    agent_id: str
    stage: FunnelStage
    objection: str
    retention_time_s: float


class AgentBoughtEvent(BaseModel):
    type: Literal["agent_bought"] = "agent_bought"
    run_id: str
    ts: int
    agent_id: str
    retention_time_s: float


class RunProgressEvent(BaseModel):
    type: Literal["run_progress"] = "run_progress"
    run_id: str
    ts: int
    active: int
    bought: int
    bailed: int


class RunCompleteEvent(BaseModel):
    type: Literal["run_complete"] = "run_complete"
    run_id: str
    ts: int
    buy_rate: float
    report_ready: bool


AgentEvent = (
    RunStartedEvent
    | AgentSpawnedEvent
    | StageEnterEvent
    | BrowserFrameEvent
    | ObjectionEvent
    | AgentBailedEvent
    | AgentBoughtEvent
    | RunProgressEvent
    | RunCompleteEvent
)


class StageTrace(BaseModel):
    stage: GateStage
    time_s: float
    screenshot_url: str | None = None


class AgentTrace(BaseModel):
    agent_id: str
    name: str
    archetype: PersonaId
    outcome: Literal["bought", "bailed"]
    bail_stage: GateStage | None = None
    objection: str | None = None
    retention_time_s: float
    stage_trace: list[StageTrace]


class Recommendation(BaseModel):
    id: str
    field: str
    issue: str
    fix: str
    impact_estimate: str
    affected_archetypes: list[PersonaId]
    config_patch: list[dict[str, Any]]


class ViabilityReport(BaseModel):
    run_id: str
    market_fit_score: int = Field(ge=0, le=100)
    recommended_price: float
    go_no_go: dict[str, Any]
    funnel: list[dict[str, Any]]
    archetypes: list[dict[str, Any]]
    objection_heatmap: list[dict[str, Any]]
    risk_archetypes: list[PersonaId]
    recommendations: list[Recommendation]
    agents: list[AgentTrace]

