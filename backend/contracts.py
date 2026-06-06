from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


FunnelStage = Literal["discovery", "land", "photos", "reviews", "price", "cart", "checkout", "bought", "bailed", "diverted"]
GateStage = Literal["land", "photos", "reviews", "price", "cart", "checkout"]
PersonaId = Literal["xmm", "auntie", "nerd", "geek", "insecure", "budget", "high_spender"]
RunMode = Literal["mock", "real"]
# In-the-moment shopper feeling an agent voices at a gate (Layer 2 reasoning).
Sentiment = Literal["love", "like", "neutral", "dislike", "reject"]

GATE_ORDER: list[GateStage] = ["land", "photos", "reviews", "price", "cart", "checkout"]

# Sentiment mapped to a [-1, 1] score so the report can average it into an arc.
SENTIMENT_SCORE: dict[Sentiment, float] = {
    "love": 1.0,
    "like": 0.5,
    "neutral": 0.0,
    "dislike": -0.5,
    "reject": -1.0,
}

# Why an agent dropped out — a coarse, stable taxonomy for dropoff distributions
# and objection-resolution (tied to a Recommendation's targeted field).
ReasonCategory = Literal[
    "price_value",
    "trust_authenticity",
    "visual_photos",
    "social_proof_reviews",
    "shipping",
    "other",
]

# Stage-derived fallback for bail_reason (mock mode is deterministic; real mode
# elicits the category from the LLM but falls back to this).
REASON_BY_STAGE: dict[GateStage, ReasonCategory] = {
    "land": "other",
    "photos": "visual_photos",
    "reviews": "social_proof_reviews",
    "price": "price_value",
    "cart": "price_value",
    "checkout": "trust_authenticity",
}


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
    competitors: list[dict[str, str]] | None = None


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
    reason_category: ReasonCategory | None = None


class AgentBoughtEvent(BaseModel):
    type: Literal["agent_bought"] = "agent_bought"
    run_id: str
    ts: int
    agent_id: str
    retention_time_s: float


class AgentDivertedEvent(BaseModel):
    type: Literal["agent_diverted"] = "agent_diverted"
    run_id: str
    ts: int
    agent_id: str
    competitor: str
    competitor_name: str | None = None
    converted: bool | None = None
    reason: str | None = None


class CompetitorAnalysisEvent(BaseModel):
    type: Literal["competitor_analysis"] = "competitor_analysis"
    run_id: str
    ts: int
    agent_id: str
    competitor: str
    competitor_name: str
    seller: str | None = None
    verified: bool | None = None
    price: float | None = None
    rating: str | None = None
    review_count: int | None = None
    comments: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    verdict: str
    thumbnail_url: str | None = None


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


class StageSentimentEvent(BaseModel):
    """Layer 2: the in-character shopper opinion an agent voices at a gate."""

    type: Literal["stage_sentiment"] = "stage_sentiment"
    run_id: str
    ts: int
    agent_id: str
    stage: FunnelStage
    sentiment: Sentiment
    comment: str


class AgentThoughtEvent(BaseModel):
    """Layer 1: browser-use's own per-step reasoning (AgentBrain), real mode only."""

    type: Literal["agent_thought"] = "agent_thought"
    run_id: str
    ts: int
    agent_id: str
    stage: FunnelStage
    thinking: str
    evaluation: str | None = None
    next_goal: str | None = None


AgentEvent = (
    RunStartedEvent
    | AgentSpawnedEvent
    | StageEnterEvent
    | BrowserFrameEvent
    | ObjectionEvent
    | AgentBailedEvent
    | AgentBoughtEvent
    | AgentDivertedEvent
    | CompetitorAnalysisEvent
    | RunProgressEvent
    | RunCompleteEvent
    | StageSentimentEvent
    | AgentThoughtEvent
)


class StageTrace(BaseModel):
    stage: GateStage
    time_s: float
    screenshot_url: str | None = None
    sentiment: Sentiment | None = None  # Layer 2: how the agent felt at this gate
    comment: str | None = None  # Layer 2: what the agent said in character at this gate


class AgentTrace(BaseModel):
    agent_id: str
    name: str
    archetype: PersonaId
    outcome: Literal["bought", "bailed"]
    bail_stage: GateStage | None = None
    objection: str | None = None
    retention_time_s: float
    stage_trace: list[StageTrace]
    purchase_reason: str | None = None  # why a buyer committed (None for bailers)
    bail_reason: ReasonCategory | None = None  # categorized dropout reason (None for buyers)


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
    browsing_metrics: dict[str, Any] = Field(default_factory=dict)
    funnel: list[dict[str, Any]]
    archetypes: list[dict[str, Any]]
    objection_heatmap: list[dict[str, Any]]
    risk_archetypes: list[PersonaId]
    recommendations: list[Recommendation]
    agents: list[AgentTrace]
    # Layer 2 reasoning rollups (optional → empty for legacy/mock fixtures).
    # `archetypes[].sentiment_arc` carries the per-gate sentiment curve per persona.
    comments: list[dict[str, Any]] = Field(default_factory=list)
    purchase_reasons: list[dict[str, Any]] = Field(default_factory=list)
    # Relative diagnostics (review_read_rate, engagement_rate, click_rate) and the
    # dropout-reason distribution. click_rate is None until the Tier-2 impression stage.
    diagnostics: dict[str, Any] = Field(default_factory=dict)
    dropoff_reasons: list[dict[str, Any]] = Field(default_factory=list)


class UpliftReport(BaseModel):
    """Control-vs-treatment comparison. Exact (not estimated) because a rerun reuses
    the parent's cohort + seed, so agents match 1:1 by agent_id."""

    control_run_id: str
    treatment_run_id: str
    # each: {control, treatment, delta, delta_pp}
    buyer_uplift: dict[str, float]
    order_uplift: dict[str, float]
    # [{archetype, buy_rate_control, buy_rate_treatment, delta_pp, verdict}]
    per_persona: list[dict[str, Any]]
    # [{stage, entered_delta, bail_rate_delta}]
    funnel_delta: list[dict[str, Any]]
    # [{field, targeted, resolved, rate}] — did the tested fix kill its objection?
    objection_resolution: list[dict[str, Any]]
    dropoff_reasons_control: list[dict[str, Any]]
    dropoff_reasons_treatment: list[dict[str, Any]]
