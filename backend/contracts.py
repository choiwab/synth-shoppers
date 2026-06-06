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
    "chose_competitor",  # left the tracked listing to buy a different product
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


class PersonaProfile(BaseModel):
    """A randomized Singaporean life-profile layered on top of an archetype, so each
    spawned agent is a distinct person whose attributes nudge its bail thresholds."""

    age: int = Field(ge=16, le=80)
    sex: Literal["F", "M"]
    marital: Literal["single", "married", "married_kids"]
    income: Literal["tight", "comfortable", "affluent"]
    housing: Literal["HDB", "condo", "landed"]
    hobby: str
    blurb: str  # one-line human/LLM summary, e.g. "34, married w/ kids, HDB, deal-hunter"


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
    profile: PersonaProfile | None = None


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


class AgentDivertedEvent(BaseModel):
    """Real mode only: the agent left the tracked Matin Kim listing for a competitor.

    Emitted instead of (or alongside) a bail when a free-browsing agent buys a
    different product. ``from_stage`` is where on OUR funnel they peeled off
    (``land`` if they chose a competitor straight from search results)."""

    type: Literal["agent_diverted"] = "agent_diverted"
    run_id: str
    ts: int
    agent_id: str
    from_stage: FunnelStage  # where on OUR funnel they peeled off
    competitor: str  # competitor listing id (the dashboard's Competitor.id)
    competitor_name: str | None = None
    converted: bool = True  # did they buy at the competitor
    reason: str | None = None


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
    | AgentDivertedEvent
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
    # `outcome` is ALWAYS about the tracked Matin Kim listing: "bought" means the
    # agent bought OUR product; buying a competitor or leaving are both "bailed".
    outcome: Literal["bought", "bailed"]
    bail_stage: GateStage | None = None
    objection: str | None = None
    retention_time_s: float
    stage_trace: list[StageTrace]  # records ONLY the tracked listing's gates
    purchase_reason: str | None = None  # why a buyer committed (None for bailers)
    bail_reason: ReasonCategory | None = None  # categorized dropout reason (None for buyers)
    # ── competitive attribution (real-mode free-browsing; defaults keep mock valid)
    landed_on_target: bool = True  # did the agent ever open the tracked listing's PDP
    chosen_listing_id: str | None = None  # the product actually bought (None if left)
    divert_stage: GateStage | None = None  # where on OUR funnel they peeled off
    competitor_id: str | None = None  # set when they bought a different product
    competitor_title: str | None = None
    profile: PersonaProfile | None = None  # the agent's randomized life-profile


class Recommendation(BaseModel):
    id: str
    field: str
    issue: str
    fix: str
    impact_estimate: str
    affected_archetypes: list[PersonaId]
    config_patch: list[dict[str, Any]]


class ProposedChange(BaseModel):
    """A single human-readable before→after edit the product-owner analysis proposes."""

    field: str  # human label, e.g. "Price", "Title"
    path: str  # JSON Pointer the change maps to, e.g. "/price"
    current: Any
    proposed: Any
    reason: str
    affected_archetypes: list[PersonaId] = Field(default_factory=list)


class PersonaInsight(BaseModel):
    """Why one archetype bought / bailed / was enticed, and what would move them."""

    archetype: PersonaId
    insight: str
    what_to_fix: str


class ListingAnalysis(BaseModel):
    """Post-run 'product owner' diagnosis + a concrete revised listing for the next run.

    Generated by sim/analysis.py from a completed ViabilityReport. `config_patch` is an
    allowlisted RFC-6902 patch; `proposed_listing` is the current listing with it applied.
    """

    run_id: str
    narrative: str
    per_persona: list[PersonaInsight] = Field(default_factory=list)
    proposed_changes: list[ProposedChange] = Field(default_factory=list)
    config_patch: list[dict[str, Any]] = Field(default_factory=list)
    proposed_listing: ListingConfig
    expected_impact: str
    model: str
    source: Literal["llm", "heuristic"]
    generated_at: int


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
    # Per-agent consolidated trace reports generated after each run.
    agent_trace_reports: list[dict[str, Any]] = Field(default_factory=list)
    # Relative diagnostics (review_read_rate, engagement_rate, click_rate) and the
    # dropout-reason distribution. click_rate is None until the Tier-2 impression stage.
    diagnostics: dict[str, Any] = Field(default_factory=dict)
    dropoff_reasons: list[dict[str, Any]] = Field(default_factory=list)
    # Competitive attribution for the tracked listing (real mode). Empty in mock.
    # Shape: {landed_rate, lost_to_competitors, left_without_buying,
    #         competitor_breakdown: [{competitor_id, title, wins, share}],
    #         divert_by_stage: [{stage, count}]}
    competition: dict[str, Any] = Field(default_factory=dict)


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
