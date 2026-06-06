import { create } from "zustand";
import {
  GATES,
  PERSONA_IDS,
  type AgentEvent,
  type FunnelStage,
  type PersonaId,
  type PersonaProfile,
} from "@/types/contracts";

export interface AgentState {
  agent_id: string;
  name: string;
  archetype: PersonaId;
  stage: FunnelStage; // current gate or terminal
  outcome: "active" | "bought" | "bailed" | "diverted";
  objection?: string;
  competitor?: string; // competitor id, when outcome === "diverted"
  lastAction?: string; // surfaced on fallback tiles
  latestThought?: string;
  latestEvaluation?: string;
  latestGoal?: string;
  latestSentiment?: "love" | "like" | "neutral" | "dislike" | "reject";
  latestComment?: string;
  thumbnail_url?: string;
  scroll_pct?: number;
  retention_time_s?: number;
  profile?: PersonaProfile;
  spawnOrder: number;
}

/** Per-competitor mini-funnel: how many landed there and how many bought. */
export interface CompetitorStat {
  id: string;
  name: string;
  landed: number;
  bought: number;
}

export type FeedKind = "objection" | "bail" | "buy" | "divert" | "action" | "thought";
export interface FeedItem {
  id: string;
  agent_id: string;
  name: string;
  archetype: PersonaId;
  kind: FeedKind;
  text: string;
  stage?: FunnelStage;
  ts: number;
}

export interface RosterEntry {
  total: number;
  bought: number;
  bailed: number;
  diverted: number;
}

export type RunStatus = "idle" | "running" | "paused" | "complete" | "error";

export interface SimStore {
  runId?: string;
  listing?: { title: string; price: number; seller: string };
  status: RunStatus;
  agents: Record<string, AgentState>;
  bailsByGate: Record<FunnelStage, number>;
  feed: FeedItem[]; // newest-first, cap 60
  roster: Record<PersonaId, RosterEntry>;
  competitors: Record<string, CompetitorStat>; // by competitor id
  competitorOrder: string[]; // stable display order
  counts: { active: number; bought: number; bailed: number; diverted: number; total: number };
  buyRate?: number;
  reportReady: boolean;
  error?: string;
  nowTs: number; // run clock = latest event ts (for relative feed times)
  spawnSeq: number;
  feedSeq: number;

  apply(ev: AgentEvent): void;
  reset(): void;
}

export interface FunnelAgentState {
  agent_id: string;
  name: string;
  archetype: PersonaId;
  stage: FunnelStage;
  outcome: AgentState["outcome"];
  objection?: string;
  competitor?: string;
  lastAction?: string;
  retention_time_s?: number;
  spawnOrder: number;
}

function emptyGateRecord(): Record<FunnelStage, number> {
  return {
    discovery: 0,
    land: 0,
    photos: 0,
    reviews: 0,
    price: 0,
    cart: 0,
    checkout: 0,
    bought: 0,
    bailed: 0,
    diverted: 0,
  };
}

function emptyRoster(): Record<PersonaId, RosterEntry> {
  return PERSONA_IDS.reduce(
    (acc, id) => {
      acc[id] = { total: 0, bought: 0, bailed: 0, diverted: 0 };
      return acc;
    },
    {} as Record<PersonaId, RosterEntry>,
  );
}

const FEED_CAP = 60;

const initial = () => ({
  runId: undefined,
  listing: undefined,
  status: "idle" as RunStatus,
  agents: {} as Record<string, AgentState>,
  bailsByGate: emptyGateRecord(),
  feed: [] as FeedItem[],
  roster: emptyRoster(),
  competitors: {} as Record<string, CompetitorStat>,
  competitorOrder: [] as string[],
  counts: { active: 0, bought: 0, bailed: 0, diverted: 0, total: 0 },
  buyRate: undefined,
  reportReady: false,
  error: undefined,
  nowTs: 0,
  spawnSeq: 0,
  feedSeq: 0,
});

/** Human-readable last action for fallback tiles / journey context. */
const STAGE_ACTION: Record<FunnelStage, string> = {
  discovery: "Scanning the market",
  land: "Landed on listing",
  photos: "Browsing photos",
  reviews: "Reading reviews",
  price: "Checking price",
  cart: "Added to cart",
  checkout: "At checkout",
  bought: "Bought ✓",
  bailed: "Bailed",
  diverted: "Left for a competitor",
};

export const useSimStore = create<SimStore>((set) => ({
  ...initial(),

  reset: () => set({ ...initial() }),

  apply: (ev: AgentEvent) =>
    set((s) => {
      // run clock — used for relative feed timestamps (events may carry
      // original recording timestamps, so relative-to-latest is stable).
      const nowTs = Math.max(s.nowTs, ev.ts ?? s.nowTs);

      switch (ev.type) {
        case "run_started": {
          const competitors: Record<string, CompetitorStat> = {};
          const competitorOrder: string[] = [];
          for (const c of ev.competitors ?? []) {
            competitors[c.id] = { id: c.id, name: c.name, landed: 0, bought: 0 };
            competitorOrder.push(c.id);
          }
          return {
            ...initial(),
            runId: ev.run_id,
            listing: ev.listing,
            status: "running",
            competitors,
            competitorOrder,
            counts: { active: 0, bought: 0, bailed: 0, diverted: 0, total: ev.agents_total },
            nowTs: ev.ts,
          };
        }

        case "agent_spawned": {
          if (s.agents[ev.agent_id]) return { nowTs }; // idempotent
          const spawnOrder = s.spawnSeq;
          const agents = {
            ...s.agents,
            [ev.agent_id]: {
              agent_id: ev.agent_id,
              name: ev.name,
              archetype: ev.archetype,
              stage: "discovery" as FunnelStage, // enters the market first
              outcome: "active" as const,
              lastAction: STAGE_ACTION.discovery,
              profile: ev.profile,
              spawnOrder,
            },
          };
          const roster = {
            ...s.roster,
            [ev.archetype]: {
              ...s.roster[ev.archetype],
              total: s.roster[ev.archetype].total + 1,
            },
          };
          return {
            agents,
            roster,
            spawnSeq: s.spawnSeq + 1,
            counts: { ...s.counts, active: s.counts.active + 1 },
            nowTs,
          };
        }

        case "stage_enter": {
          const a = s.agents[ev.agent_id];
          if (!a || a.outcome !== "active") return { nowTs };
          const nextAction = STAGE_ACTION[ev.stage] ?? a.lastAction;
          const nextThumb = ev.thumbnail_url ?? a.thumbnail_url;
          if (a.stage === ev.stage && a.lastAction === nextAction && a.thumbnail_url === nextThumb) {
            return { nowTs };
          }
          return {
            agents: {
              ...s.agents,
              [ev.agent_id]: {
                ...a,
                stage: ev.stage,
                lastAction: nextAction,
                thumbnail_url: nextThumb,
              },
            },
            nowTs,
          };
        }

        case "browser_frame": {
          const a = s.agents[ev.agent_id];
          if (!a) return { nowTs };
          const nextScroll = ev.scroll_pct ?? a.scroll_pct;
          if (a.thumbnail_url === ev.thumbnail_url && a.scroll_pct === nextScroll) {
            return { nowTs };
          }
          return {
            agents: {
              ...s.agents,
              [ev.agent_id]: {
                ...a,
                thumbnail_url: ev.thumbnail_url,
                scroll_pct: nextScroll,
              },
            },
            nowTs,
          };
        }

        case "stage_sentiment": {
          const a = s.agents[ev.agent_id];
          if (!a) return { nowTs };
          const item: FeedItem = {
            id: `f${s.feedSeq}`,
            agent_id: ev.agent_id,
            name: a.name,
            archetype: a.archetype,
            kind: "action",
            text: ev.comment,
            stage: ev.stage,
            ts: ev.ts,
          };
          return {
            agents: {
              ...s.agents,
              [ev.agent_id]: {
                ...a,
                lastAction: ev.comment,
                latestSentiment: ev.sentiment,
                latestComment: ev.comment,
              },
            },
            feed: [item, ...s.feed].slice(0, FEED_CAP),
            feedSeq: s.feedSeq + 1,
            nowTs,
          };
        }

        case "agent_thought": {
          const a = s.agents[ev.agent_id];
          if (!a) return { nowTs };
          const item: FeedItem = {
            id: `f${s.feedSeq}`,
            agent_id: ev.agent_id,
            name: a.name,
            archetype: a.archetype,
            kind: "thought",
            text: ev.thinking,
            stage: ev.stage,
            ts: ev.ts,
          };
          return {
            agents: {
              ...s.agents,
              [ev.agent_id]: {
                ...a,
                latestThought: ev.thinking,
                latestEvaluation: ev.evaluation,
                latestGoal: ev.next_goal,
              },
            },
            feed: [item, ...s.feed].slice(0, FEED_CAP),
            feedSeq: s.feedSeq + 1,
            nowTs,
          };
        }

        case "objection": {
          const a = s.agents[ev.agent_id];
          if (!a) return { nowTs };
          const item: FeedItem = {
            id: `f${s.feedSeq}`,
            agent_id: ev.agent_id,
            name: a.name,
            archetype: a.archetype,
            kind: "objection",
            text: ev.text,
            stage: ev.stage,
            ts: ev.ts,
          };
          return {
            agents: {
              ...s.agents,
              [ev.agent_id]: { ...a, objection: ev.text, lastAction: ev.text },
            },
            feed: [item, ...s.feed].slice(0, FEED_CAP),
            feedSeq: s.feedSeq + 1,
            nowTs,
          };
        }

        case "agent_diverted": {
          const a = s.agents[ev.agent_id];
          if (!a || a.outcome !== "active") return { nowTs };
          // competitor may be undeclared in run_started — create lazily
          const existing = s.competitors[ev.competitor];
          const name = existing?.name ?? ev.competitor_name ?? ev.competitor;
          const stat: CompetitorStat = {
            id: ev.competitor,
            name,
            landed: (existing?.landed ?? 0) + 1,
            bought: (existing?.bought ?? 0) + (ev.converted ? 1 : 0),
          };
          const competitorOrder = existing
            ? s.competitorOrder
            : [...s.competitorOrder, ev.competitor];
          const item: FeedItem = {
            id: `f${s.feedSeq}`,
            agent_id: ev.agent_id,
            name: a.name,
            archetype: a.archetype,
            kind: "divert",
            text: ev.converted ? `bought at ${name}` : `left for ${name}`,
            stage: "discovery",
            ts: ev.ts,
          };
          return {
            agents: {
              ...s.agents,
              [ev.agent_id]: {
                ...a,
                outcome: "diverted",
                stage: "diverted",
                competitor: ev.competitor,
                lastAction: ev.converted ? `Bought at ${name}` : `Left for ${name}`,
              },
            },
            competitors: { ...s.competitors, [ev.competitor]: stat },
            competitorOrder,
            roster: {
              ...s.roster,
              [a.archetype]: {
                ...s.roster[a.archetype],
                diverted: s.roster[a.archetype].diverted + 1,
              },
            },
            feed: [item, ...s.feed].slice(0, FEED_CAP),
            feedSeq: s.feedSeq + 1,
            counts: {
              ...s.counts,
              active: Math.max(0, s.counts.active - 1),
              diverted: s.counts.diverted + 1,
            },
            nowTs,
          };
        }

        case "agent_bailed": {
          const a = s.agents[ev.agent_id];
          if (!a || a.outcome !== "active") return { nowTs };
          const item: FeedItem = {
            id: `f${s.feedSeq}`,
            agent_id: ev.agent_id,
            name: a.name,
            archetype: a.archetype,
            kind: "bail",
            text: ev.objection,
            stage: ev.stage,
            ts: ev.ts,
          };
          return {
            agents: {
              ...s.agents,
              [ev.agent_id]: {
                ...a,
                outcome: "bailed",
                stage: ev.stage,
                objection: ev.objection,
                lastAction: ev.objection,
                retention_time_s: ev.retention_time_s,
              },
            },
            bailsByGate: {
              ...s.bailsByGate,
              [ev.stage]: s.bailsByGate[ev.stage] + 1,
            },
            roster: {
              ...s.roster,
              [a.archetype]: {
                ...s.roster[a.archetype],
                bailed: s.roster[a.archetype].bailed + 1,
              },
            },
            feed: [item, ...s.feed].slice(0, FEED_CAP),
            feedSeq: s.feedSeq + 1,
            counts: {
              ...s.counts,
              active: Math.max(0, s.counts.active - 1),
              bailed: s.counts.bailed + 1,
            },
            nowTs,
          };
        }

        case "agent_bought": {
          const a = s.agents[ev.agent_id];
          if (!a || a.outcome !== "active") return { nowTs };
          const item: FeedItem = {
            id: `f${s.feedSeq}`,
            agent_id: ev.agent_id,
            name: a.name,
            archetype: a.archetype,
            kind: "buy",
            text: "bought ✓",
            ts: ev.ts,
          };
          return {
            agents: {
              ...s.agents,
              [ev.agent_id]: {
                ...a,
                outcome: "bought",
                stage: "bought",
                lastAction: STAGE_ACTION.bought,
                retention_time_s: ev.retention_time_s,
              },
            },
            roster: {
              ...s.roster,
              [a.archetype]: {
                ...s.roster[a.archetype],
                bought: s.roster[a.archetype].bought + 1,
              },
            },
            feed: [item, ...s.feed].slice(0, FEED_CAP),
            feedSeq: s.feedSeq + 1,
            counts: {
              ...s.counts,
              active: Math.max(0, s.counts.active - 1),
              bought: s.counts.bought + 1,
            },
            nowTs,
          };
        }

        case "run_progress":
          // header counters are derived from `counts`; trust the stream as a
          // reconciliation hint but keep our local tally authoritative.
          return { nowTs };

        case "run_complete":
          return {
            status: "complete",
            buyRate: ev.buy_rate,
            reportReady: ev.report_ready,
            nowTs,
          };

        default:
          // forward-compat: ignore unknown event types (OVERVIEW §5.3)
          return { nowTs };
      }
    }),
}));

/** Active agents at a given gate, in spawn order — used by the funnel track. */
export function selectActiveByGate(
  agents: Record<string, FunnelAgentState>,
): Record<FunnelStage, FunnelAgentState[]> {
  const out = {
    discovery: [],
    land: [],
    photos: [],
    reviews: [],
    price: [],
    cart: [],
    checkout: [],
    bought: [],
    bailed: [],
    diverted: [],
  } as Record<FunnelStage, AgentState[]>;
  for (const a of Object.values(agents)) {
    if (a.outcome === "active" && GATES.includes(a.stage)) out[a.stage].push(a);
  }
  return out;
}

export function selectFunnelAgents(agents: Record<string, AgentState>): Record<string, FunnelAgentState> {
  const out: Record<string, FunnelAgentState> = {};
  for (const [id, a] of Object.entries(agents)) {
    out[id] = {
      agent_id: a.agent_id,
      name: a.name,
      archetype: a.archetype,
      stage: a.stage,
      outcome: a.outcome,
      objection: a.objection,
      competitor: a.competitor,
      lastAction: a.lastAction,
      retention_time_s: a.retention_time_s,
      spawnOrder: a.spawnOrder,
    };
  }
  return out;
}

export function selectFunnelSignature(agents: Record<string, AgentState>): string {
  return Object.values(agents)
    .sort((a, b) => a.spawnOrder - b.spawnOrder)
    .map((a) =>
      [
        a.agent_id,
        a.stage,
        a.outcome,
        a.objection ?? "",
        a.competitor ?? "",
        a.lastAction ?? "",
        a.retention_time_s ?? "",
      ].join(":"),
    )
    .join("|");
}
