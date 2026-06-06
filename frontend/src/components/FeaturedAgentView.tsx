import clsx from "clsx";
import { ARCHETYPE_HUE, GATE_LABELS } from "@/types/contracts";
import { archetypeInitials, archetypeLabel, archetypeTag } from "@/lib/archetype";
import { resolveAssetUrl } from "@/lib/assetUrl";
import type { AgentState } from "@/store/simStore";
import { ShopeeMonitorFrame } from "./ShopeeMonitorFrame";

/**
 * ⛳ INTEGRATION POINT — the big "spotlight" window. The WHOLE window is a single
 * agent card and this entire component is your teammate's canvas.
 *
 * H1 owns only the sizing wrapper: the strip places this in the left cell and
 * keeps `agent` in sync with the selected tile. Everything *inside* the card is
 * yours to build — e.g. a live/enlarged browser view, step trace, screenshots.
 * The default below shows the Shopee interface until H3 supplies the agent's
 * live browser screenshot, then overlays identity/stage context.
 */
export function FeaturedAgentView({ agent }: { agent: AgentState }) {
  const hue = ARCHETYPE_HUE[agent.archetype];
  const stageLabel = GATE_LABELS[agent.stage] ?? agent.stage;
  const thumb = resolveAssetUrl(agent.thumbnail_url);

  return (
    <div
      className={clsx("featured-window", agent.outcome)}
      style={{ ["--hue" as string]: hue }}
    >
      {thumb ? (
        <img
          className="featured-thumb"
          src={thumb}
          alt={`${agent.name} — ${stageLabel}`}
          style={
            agent.scroll_pct != null
              ? { objectPosition: `center ${agent.scroll_pct}%` }
              : undefined
          }
        />
      ) : (
        <ShopeeMonitorFrame agentId={agent.agent_id} persona={agent.archetype} label={stageLabel} />
      )}

      {!thumb && agent.objection && <div className="featured-obj floating">“{agent.objection}”</div>}

      {agent.outcome === "bought" && <span className="featured-badge">✓</span>}

      {/* identity overlay — keeps the card readable; teammate may restyle/remove */}
      <div className="featured-overlay">
        <span className="featured-avatar sm">{archetypeInitials(agent.archetype)}</span>
        <div style={{ minWidth: 0 }}>
          <div className="featured-name" title={agent.name}>
            {agent.name}
          </div>
          <div className="featured-tags">
            {archetypeLabel(agent.archetype)} · {archetypeTag(agent.archetype)}
          </div>
        </div>
        <span className="featured-stage-chip sm">{stageLabel}</span>
      </div>
    </div>
  );
}
