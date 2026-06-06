/*
 * contracts.ts — the only cross-team interfaces (OVERVIEW §5 + PRD 04 report).
 *
 * Co-owned. ListingConfig (§5.4) is co-owned by H2 (render) + H4 (mutate).
 * AgentEvent (§5.3) is owned by H4 (H1 consumes). ViabilityReport / Recommendation
 * are owned by H4; H2 renders them. Keep this file in sync with OVERVIEW §5 — if a
 * schema changes there, mirror it here and ping consumers.
 *
 * No TS enums (tsconfig: erasableSyntaxOnly) — union types + const objects only.
 */

/* ── §5.1 Funnel stages ──────────────────────────────────────────────────── */

export type FunnelGate = 'land' | 'photos' | 'reviews' | 'price' | 'cart' | 'checkout'
export type FunnelStage = FunnelGate | 'bought' | 'bailed'

/** Fixed gate order: land → photos → reviews → price → cart → checkout → bought. */
export const GATE_ORDER: readonly FunnelGate[] = [
  'land',
  'photos',
  'reviews',
  'price',
  'cart',
  'checkout',
]

/* ── §5.2 Personas & archetype colors ────────────────────────────────────── */

export type PersonaId =
  | 'xmm'
  | 'auntie'
  | 'nerd'
  | 'geek'
  | 'insecure'
  | 'budget'
  | 'high_spender'

// oklch(0.74 0.135 <hue>) — mirrored in styles/tokens.css.
export const ARCHETYPE_HUE: Record<PersonaId, number> = {
  xmm: 10,
  auntie: 75,
  nerd: 175,
  geek: 300,
  insecure: 250,
  budget: 145,
  high_spender: 40,
}

export interface PersonaMeta {
  display: string
  tag: string
}

export const PERSONA_META: Record<PersonaId, PersonaMeta> = {
  xmm: { display: 'XMM', tag: 'Trend-led' },
  auntie: { display: 'Auntie', tag: 'Value & trust' },
  nerd: { display: 'Nerd', tag: 'Spec-rational' },
  geek: { display: 'Geek', tag: 'Enthusiast' },
  insecure: { display: 'Insecure', tag: 'Scam-wary' },
  budget: { display: 'Budget-tight', tag: 'Price-first' },
  high_spender: { display: 'High-spender', tag: 'Convenience' },
}

/** Canonical archetype color used by charts/chips (matches tokens.css). */
export function archetypeColor(id: PersonaId): string {
  return `oklch(0.74 0.135 ${ARCHETYPE_HUE[id]})`
}

export function personaDisplay(id: PersonaId): string {
  return PERSONA_META[id]?.display ?? id
}

/* ── §5.4 ListingConfig (co-owned: H2 render / H4 mutate) ─────────────────── */

export type PhotoType = 'product' | 'lifestyle' | 'closeup'

export interface ListingPhoto {
  url: string
  type: PhotoType
}

export interface ListingVariant {
  name: string // e.g. "Colour"
  options: string[] // e.g. ["Black", "Charcoal", ...]
}

export interface ListingReview {
  author: string
  rating: number
  text: string
  date: string
  seller_response?: string
}

export interface ListingSeller {
  name: string
  verified: boolean
  rating: number
  response_rate: number // canonical fixture uses a percent (0..100); normalise with pct()
}

export interface ListingAuthenticity {
  certificate: boolean
  serial: boolean
  unboxing: boolean
}

export interface ListingConfig {
  id: string
  title: string
  seller: ListingSeller
  price: number // current S$
  base_price: number // baseline for "price above threshold" UI
  variants: ListingVariant[]
  photos: ListingPhoto[]
  description: string
  rating: { score: number; count: number }
  reviews: ListingReview[]
  authenticity: ListingAuthenticity
  category: string[]
  shipping: { fee: number; days: string }
}

/* ── §5.3 AgentEvent (owner H4 / consumer H1) ────────────────────────────── */

export type AgentEvent =
  | {
      type: 'run_started'
      run_id: string
      ts: number
      listing: { title: string; price: number; seller: string }
      agents_total: number
    }
  | {
      type: 'agent_spawned'
      run_id: string
      ts: number
      agent_id: string
      name: string
      archetype: PersonaId
    }
  | { type: 'stage_enter'; run_id: string; ts: number; agent_id: string; stage: FunnelStage; thumbnail_url?: string }
  | { type: 'browser_frame'; run_id: string; ts: number; agent_id: string; thumbnail_url: string; scroll_pct?: number }
  | { type: 'objection'; run_id: string; ts: number; agent_id: string; stage: FunnelStage; text: string }
  | {
      type: 'agent_bailed'
      run_id: string
      ts: number
      agent_id: string
      stage: FunnelStage
      objection: string
      retention_time_s: number
    }
  | { type: 'agent_bought'; run_id: string; ts: number; agent_id: string; retention_time_s: number }
  | { type: 'run_progress'; run_id: string; ts: number; active: number; bought: number; bailed: number }
  | { type: 'run_complete'; run_id: string; ts: number; buy_rate: number; report_ready: boolean }

/* ── PRD 04 §4.6 / §4.8 — report schema (owner H4 / renderer H2) ──────────── */

/** RFC-6902 JSON Patch op — the canonical config_patch format from H4. */
export interface JsonPatchOp {
  op: 'add' | 'replace' | 'remove'
  path: string // JSON Pointer, e.g. "/price", "/photos/-", "/authenticity/certificate"
  value?: unknown
}

/** config_patch is normally a JSON Patch array; a dotted-path object is also
 *  accepted for forward/back compatibility. */
export type ConfigPatch = JsonPatchOp[] | Record<string, unknown>

export interface Recommendation {
  id: string
  field: string // Photos | Price | Reviews | Description | Authenticity | Title | ...
  issue: string // diagnosis with numbers
  fix: string // actionable
  impact_estimate: string // "+6–9% buy rate"
  affected_archetypes: PersonaId[]
  config_patch: ConfigPatch // ListingConfig mutation "Test this fix" applies
}

export interface FunnelRow {
  stage: FunnelStage
  entered: number
  bailed: number
  bail_rate: number
  /** Optional per-archetype bail contribution for the stacked bar (H4 may add). */
  by_archetype?: Partial<Record<PersonaId, number>>
}

export interface ArchetypeRow {
  archetype: PersonaId
  agents: number
  bought: number
  bailed: number
  buy_rate: number
  avg_retention_s: number
  top_objection: string
}

export interface ObjectionRow {
  field: string
  bail_count: number
}

export interface StageTraceStep {
  stage: FunnelStage
  time_s: number
  screenshot_url?: string
  sentiment?: 'love' | 'like' | 'neutral' | 'dislike' | 'reject'
  comment?: string
}

export type AgentOutcome = 'bought' | 'bailed'

export interface AgentTrace {
  agent_id: string
  name: string
  archetype: PersonaId
  outcome: AgentOutcome
  bail_stage?: FunnelStage
  objection?: string
  retention_time_s: number
  stage_trace: StageTraceStep[]
  purchase_reason?: string
  bail_reason?: string
}

export interface AgentTraceReportStage {
  order: number
  stage: FunnelStage
  time_s: number
  delta_s: number
  screenshot_url?: string
  sentiment?: 'love' | 'like' | 'neutral' | 'dislike' | 'reject'
  comment?: string
}

export interface AgentTraceReport {
  agent_id: string
  name: string
  archetype: PersonaId
  outcome: AgentOutcome
  status_label: string
  summary: string
  retention_time_s: number
  completed_gates: number
  total_gates: number
  progress_pct: number
  stage_path: FunnelStage[]
  last_stage?: FunnelStage
  bail_stage?: FunnelStage
  bail_reason?: string
  objection?: string
  purchase_reason?: string
  key_reason?: string
  metrics: Record<string, unknown>
  run_metrics_context: Record<string, unknown>
  comments: Array<{ stage: FunnelStage; sentiment?: string; comment: string; time_s: number }>
  screenshots: Array<{ stage: FunnelStage; screenshot_url: string; time_s: number }>
  stage_trace: AgentTraceReportStage[]
}

export interface GoNoGo {
  decision: 'go' | 'no_go'
  confidence: number // 0..1
}

export interface ViabilityReport {
  run_id: string
  market_fit_score: number // 0..100
  recommended_price: number
  go_no_go: GoNoGo
  browsing_metrics?: Record<string, unknown>
  funnel: FunnelRow[]
  archetypes: ArchetypeRow[]
  objection_heatmap: ObjectionRow[]
  risk_archetypes: PersonaId[]
  recommendations: Recommendation[]
  agents: AgentTrace[]
  comments?: Array<Record<string, unknown>>
  purchase_reasons?: Array<Record<string, unknown>>
  agent_trace_reports?: AgentTraceReport[]
  diagnostics?: Record<string, unknown>
  dropoff_reasons?: Array<Record<string, unknown>>
}

/* ── §5.7 run-control API ─────────────────────────────────────────────────── */

export interface CrowdConfig {
  personas: PersonaId[]
  crowd_size: number
  speed: 1 | 2 | 4
}

export interface RerunResponse {
  run_id: string
}
