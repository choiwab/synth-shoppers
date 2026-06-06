// =============================================================================
// SHARED CROSS-TEAM CONTRACTS — canonical mirror of 00-OVERVIEW.md §5.
// Seeded by H1; imported by H2. DO NOT diverge from the OVERVIEW without a
// ping to all consumers. Python side (H3/H4) mirrors these as Pydantic models.
// =============================================================================

// ----- §5.1 Funnel stages ----------------------------------------------------
export type FunnelStage =
  | "discovery" // market intake — before they pick our listing (H1 extension)
  | "land"
  | "photos"
  | "reviews"
  | "price"
  | "cart"
  | "checkout" // gates
  | "bought" // terminal success
  | "bailed" // terminal drop (can occur at any gate land..checkout)
  | "diverted"; // terminal — left for a competitor at discovery (H1 extension)

/** The six gates, in fixed order. `bought`/`bailed` are terminal, not gates. */
export const GATES: FunnelStage[] = [
  "land",
  "photos",
  "reviews",
  "price",
  "cart",
  "checkout",
];

export const GATE_LABELS: Record<FunnelStage, string> = {
  discovery: "Market",
  land: "Land",
  photos: "Photos",
  reviews: "Reviews",
  price: "Price",
  cart: "Cart",
  checkout: "Checkout",
  bought: "Bought",
  bailed: "Bailed",
  diverted: "Diverted",
};

/**
 * A competitor destination an agent can divert to during `discovery`, before
 * landing on our listing (H1 extension — keep lean; H4 owns richer behavior).
 */
export interface Competitor {
  id: string;
  name: string;
}

// ----- §5.2 Persona IDs & archetype colors -----------------------------------
export type PersonaId =
  | "xmm"
  | "auntie"
  | "nerd"
  | "geek"
  | "insecure"
  | "budget"
  | "high_spender";

export const PERSONA_IDS: PersonaId[] = [
  "xmm",
  "auntie",
  "nerd",
  "geek",
  "insecure",
  "budget",
  "high_spender",
];

/** oklch(0.74 0.135 <hue>) — these hues MUST match OVERVIEW §5.2 exactly. */
export const ARCHETYPE_HUE: Record<PersonaId, number> = {
  xmm: 10,
  auntie: 75,
  nerd: 175,
  geek: 300,
  insecure: 250,
  budget: 145,
  high_spender: 40,
};

export interface PersonaMeta {
  id: PersonaId;
  display: string;
  tag: string;
}

export const PERSONA_META: Record<PersonaId, PersonaMeta> = {
  xmm: { id: "xmm", display: "XMM", tag: "Trend-led" },
  auntie: { id: "auntie", display: "Auntie", tag: "Value & trust" },
  nerd: { id: "nerd", display: "Nerd", tag: "Spec-rational" },
  geek: { id: "geek", display: "Geek", tag: "Enthusiast" },
  insecure: { id: "insecure", display: "Insecure", tag: "Scam-wary" },
  budget: { id: "budget", display: "Budget-tight", tag: "Price-first" },
  high_spender: { id: "high_spender", display: "High-spender", tag: "Convenience" },
};

// ----- §5.3 AgentEvent — WebSocket message union (Owner: H4, Consumer: H1) ----
// Discriminated on `type`. Every event has `run_id` and `ts` (epoch ms).
export type AgentEvent =
  | {
      type: "run_started";
      run_id: string;
      ts: number;
      listing: { title: string; price: number; seller: string };
      agents_total: number; // whole market: everyone who enters discovery
      competitors?: Competitor[]; // declared competitor destinations (H1 extension)
    }
  | {
      type: "agent_spawned";
      run_id: string;
      ts: number;
      agent_id: string;
      name: string;
      archetype: PersonaId;
    }
  | {
      type: "stage_enter";
      run_id: string;
      ts: number;
      agent_id: string;
      stage: FunnelStage;
      thumbnail_url?: string;
    }
  | {
      type: "browser_frame";
      run_id: string;
      ts: number;
      agent_id: string;
      thumbnail_url: string;
      scroll_pct?: number;
    }
  | {
      type: "stage_sentiment";
      run_id: string;
      ts: number;
      agent_id: string;
      stage: FunnelStage;
      sentiment: "love" | "like" | "neutral" | "dislike" | "reject";
      comment: string;
    }
  | {
      type: "agent_thought";
      run_id: string;
      ts: number;
      agent_id: string;
      stage: FunnelStage;
      thinking: string;
      evaluation?: string;
      next_goal?: string;
    }
  | {
      type: "objection";
      run_id: string;
      ts: number;
      agent_id: string;
      stage: FunnelStage;
      text: string;
    }
  | {
      type: "agent_diverted"; // left for a competitor instead of landing on us
      run_id: string;
      ts: number;
      agent_id: string;
      competitor: string; // Competitor.id
      competitor_name?: string; // convenience; falls back to run_started list
      converted?: boolean; // did they buy at the competitor
      reason?: string;
    }
  | {
      type: "agent_bailed";
      run_id: string;
      ts: number;
      agent_id: string;
      stage: FunnelStage;
      objection: string;
      retention_time_s: number;
    }
  | {
      type: "agent_bought";
      run_id: string;
      ts: number;
      agent_id: string;
      retention_time_s: number;
    }
  | {
      type: "run_progress";
      run_id: string;
      ts: number;
      active: number;
      bought: number;
      bailed: number;
    }
  | {
      type: "run_complete";
      run_id: string;
      ts: number;
      buy_rate: number;
      report_ready: boolean;
    };

export type AgentEventType = AgentEvent["type"];

// ----- §5.4 ListingConfig (Co-owned: H2 render + H4 mutate) -------------------
export interface ListingConfig {
  id: string;
  title: string;
  seller: { name: string; verified: boolean; rating: number; response_rate: number };
  price: number; // current S$
  base_price: number; // baseline for "price above threshold" UI
  variants: { name: string; options: string[] }[];
  photos: { url: string; type: "product" | "lifestyle" | "closeup" }[];
  description: string;
  rating: { score: number; count: number };
  reviews: {
    author: string;
    rating: number;
    text: string;
    date: string;
    seller_response?: string;
  }[];
  authenticity: { certificate: boolean; serial: boolean; unboxing: boolean };
  category: string[];
  shipping: { fee: number; days: string };
}

// ----- §5.7 REST + run-control API (Owner: H4, Consumer: H1, H2) --------------
export type SimMode = "mock" | "real";
export type SimSpeed = 1 | 2 | 4;

export interface CrowdConfig {
  personas: PersonaId[];
  crowd_size: number;
  speed: SimSpeed;
}

export interface StartSimulationBody {
  listing_config: ListingConfig;
  crowd: CrowdConfig;
  mode: SimMode;
}

export interface RerunSimulationBody {
  listing_config: ListingConfig;
  from_recommendation?: string;
}

export interface StartSimulationResponse {
  run_id: string;
}

// ----- Reporting types (Owner: H4 schema; rendered by H2). ---------------------
// Mirrored here so the shared `types/` module is the single import surface.
// (See 04-simulation-engine.md §4.6, §4.8.)
export interface Recommendation {
  id: string;
  field: string;
  issue: string;
  fix: string;
  impact_estimate: string;
  affected_archetypes: PersonaId[];
  config_patch: Record<string, unknown>;
}

export interface AgentTrace {
  agent_id: string;
  name: string;
  archetype: PersonaId;
  outcome: "bought" | "bailed";
  bail_stage?: FunnelStage;
  objection?: string;
  retention_time_s: number;
  stage_trace: {
    stage: FunnelStage;
    time_s: number;
    screenshot_url?: string;
    sentiment?: "love" | "like" | "neutral" | "dislike" | "reject";
    comment?: string;
  }[];
  purchase_reason?: string;
  bail_reason?: string;
}

export interface AgentTraceReport {
  agent_id: string;
  name: string;
  archetype: PersonaId;
  outcome: "bought" | "bailed";
  status_label: string;
  summary: string;
  retention_time_s: number;
  completed_gates: number;
  total_gates: number;
  progress_pct: number;
  stage_path: FunnelStage[];
  last_stage?: FunnelStage;
  bail_stage?: FunnelStage;
  bail_reason?: string;
  objection?: string;
  purchase_reason?: string;
  key_reason?: string;
  metrics: Record<string, unknown>;
  run_metrics_context: Record<string, unknown>;
  comments: Array<{ stage: FunnelStage; sentiment?: string; comment: string; time_s: number }>;
  screenshots: Array<{ stage: FunnelStage; screenshot_url: string; time_s: number }>;
  stage_trace: Array<{
    order: number;
    stage: FunnelStage;
    time_s: number;
    delta_s: number;
    screenshot_url?: string;
    sentiment?: "love" | "like" | "neutral" | "dislike" | "reject";
    comment?: string;
  }>;
}

export interface ViabilityReport {
  run_id: string;
  market_fit_score: number;
  recommended_price: number;
  go_no_go: { decision: "go" | "no_go"; confidence: number };
  browsing_metrics?: Record<string, unknown>;
  funnel: { stage: FunnelStage; entered: number; bailed: number; bail_rate: number }[];
  archetypes: {
    archetype: PersonaId;
    agents: number;
    bought: number;
    bailed: number;
    buy_rate: number;
    avg_retention_s: number;
    top_objection: string;
  }[];
  objection_heatmap: { field: string; bail_count: number }[];
  risk_archetypes: PersonaId[];
  recommendations: Recommendation[];
  agents: AgentTrace[];
  comments?: Array<Record<string, unknown>>;
  purchase_reasons?: Array<Record<string, unknown>>;
  agent_trace_reports?: AgentTraceReport[];
  diagnostics?: Record<string, unknown>;
  dropoff_reasons?: Array<Record<string, unknown>>;
}
