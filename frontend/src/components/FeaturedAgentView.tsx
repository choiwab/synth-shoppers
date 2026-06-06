import clsx from "clsx";
import { ARCHETYPE_HUE, GATE_LABELS } from "@/types/contracts";
import { archetypeInitials, archetypeLabel, archetypeTag } from "@/lib/archetype";
import { resolveAssetUrl } from "@/lib/assetUrl";
import type { AgentState } from "@/store/simStore";
import { FeaturedAgentDetails } from "@/components/FeaturedAgentDetails";

/**
 * The big "spotlight" window (left of the agent strip). H1 owns the enlarged
 * visual + meta; the detail panel is delegated to FeaturedAgentDetails (teammate
 * slot). Renders the agent passed in — the strip controls which agent that is.
 */
export function FeaturedAgentView({ agent }: { agent: AgentState }) {
  const hue = ARCHETYPE_HUE[agent.archetype];
  const stageLabel = GATE_LABELS[agent.stage] ?? agent.stage;

  return (
    <div
      className={clsx("featured-window", agent.outcome)}
      style={{ ["--hue" as string]: hue }}
    >
      <div className="featured-visual">
        {agent.thumbnail_url ? (
          <img
            className="featured-thumb"
            src={resolveAssetUrl(agent.thumbnail_url)}
            alt={`${agent.name} — ${stageLabel}`}
            style={
              agent.scroll_pct != null
                ? { objectPosition: `center ${agent.scroll_pct}%` }
                : undefined
            }
          />
        ) : (
          <div className="featured-fallback">
            <div className="featured-avatar">{archetypeInitials(agent.archetype)}</div>
            <div className="tile-stage-label">{stageLabel}</div>
            {agent.lastAction && <div className="featured-action">{agent.lastAction}</div>}
          </div>
        )}
        {agent.outcome === "bought" && <span className="featured-badge">✓</span>}
      </div>

      <div className="featured-side">
        <div className="featured-head">
          <span className="featured-avatar sm">{archetypeInitials(agent.archetype)}</span>
          <div style={{ minWidth: 0 }}>
            <div className="featured-name" title={agent.name}>
              {agent.name}
            </div>
            <div className="featured-tags">
              {archetypeLabel(agent.archetype)} · {archetypeTag(agent.archetype)}
            </div>
          </div>
        </div>

        <div className="featured-stage-row">
          <span className="featured-stage-chip">{stageLabel}</span>
          {agent.retention_time_s != null && (
            <span className="mono featured-ret">{agent.retention_time_s}s</span>
          )}
        </div>

        {agent.objection && <div className="featured-obj">“{agent.objection}”</div>}

        <FeaturedAgentDetails agent={agent} />
      </div>
    </div>
  );
}
