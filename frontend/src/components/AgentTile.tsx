import { memo } from "react";
import clsx from "clsx";
import { ARCHETYPE_HUE, GATE_LABELS } from "@/types/contracts";
import { archetypeTag } from "@/lib/archetype";
import { resolveAssetUrl } from "@/lib/assetUrl";
import type { AgentState } from "@/store/simStore";
import { ShopeeMonitorFrame } from "./ShopeeMonitorFrame";

interface Props {
  agent: AgentState;
}

/**
 * One preview tile. Thumbnail mode when H3 supplies a frame; otherwise render
 * the Shopee interface each agent will browse. Never blank.
 * Memoized on the fields that affect render (PRD 01 §4.2 performance note).
 */
function AgentTileBase({ agent }: Props) {
  const hue = ARCHETYPE_HUE[agent.archetype];
  const stageLabel = GATE_LABELS[agent.stage] ?? agent.stage;

  return (
    <div
      className={clsx("agent-tile", agent.outcome)}
      style={{ ["--hue" as string]: hue }}
    >
      {agent.thumbnail_url ? (
        <img
          className="tile-thumb"
          src={resolveAssetUrl(agent.thumbnail_url)}
          alt={`${agent.name} — ${stageLabel}`}
          style={
            agent.scroll_pct != null
              ? { objectPosition: `center ${agent.scroll_pct}%` }
              : undefined
          }
          loading="lazy"
        />
      ) : (
        <div className="tile-fallback">
          <ShopeeMonitorFrame agentId={agent.agent_id} persona={agent.archetype} label={stageLabel} />
          {agent.lastAction && <div className="tile-action floating">{agent.lastAction}</div>}
        </div>
      )}

      {agent.outcome === "bought" && <span className="tile-badge">✓</span>}

      <div className="tile-footer">
        <span className="name" title={`${agent.name} · ${archetypeTag(agent.archetype)}`}>
          {agent.name}
        </span>
        <span className="stage">{stageLabel}</span>
      </div>
    </div>
  );
}

export const AgentTile = memo(
  AgentTileBase,
  (a, b) =>
    a.agent.stage === b.agent.stage &&
    a.agent.outcome === b.agent.outcome &&
    a.agent.thumbnail_url === b.agent.thumbnail_url &&
    a.agent.scroll_pct === b.agent.scroll_pct &&
    a.agent.lastAction === b.agent.lastAction,
);
