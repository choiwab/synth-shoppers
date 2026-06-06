import clsx from "clsx";
import { ARCHETYPE_HUE, GATE_LABELS } from "@/types/contracts";
import { archetypeInitials, archetypeLabel, archetypeTag } from "@/lib/archetype";
import { sentimentColor, SENTIMENT_LABEL } from "@/lib/sentiment";
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
 * The default below shows editable Shopee HTML until H3 supplies screenshots.
 */
export function FeaturedAgentView({ agent }: { agent: AgentState }) {
  const hue = ARCHETYPE_HUE[agent.archetype];
  const stageLabel = GATE_LABELS[agent.stage] ?? agent.stage;
  const sentiment = sentimentColor(agent.latestSentiment);
  const thumb = resolveAssetUrl(agent.thumbnail_url);
  const competitorRead = agent.competitorAnalyses?.[0];
  const streamLabel = thumb
    ? "Shopee screenshot"
    : agent.lastAction || agent.latestThought
      ? "Action stream"
      : "Waiting for screenshot";

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

      <div className="featured-action-panel">
        <div className="featured-panel-kicker">
          <span>{streamLabel}</span>
          {agent.latestSentiment && (
            <span className="feeling-chip" style={{ color: sentiment, borderColor: sentiment }}>
              {SENTIMENT_LABEL[agent.latestSentiment]}
            </span>
          )}
        </div>
        <div className="featured-panel-action">
          {agent.lastAction ?? "Waiting for the backend agent to send its first screenshot"}
        </div>
        {agent.latestThought && (
          <div className="featured-panel-thought">
            <span>Thinking:</span> {agent.latestThought}
          </div>
        )}
        {agent.latestGoal && (
          <div className="featured-panel-goal">
            <span>Next:</span> {agent.latestGoal}
          </div>
        )}
        {competitorRead && (
          <div className="featured-competitor-read">
            <div className="featured-read-head">
              <span>Competitor read</span>
              <strong>{competitorRead.competitor_name}</strong>
            </div>
            <div className="featured-read-meta">
              {competitorRead.price != null && <span>S${competitorRead.price.toFixed(2)}</span>}
              {competitorRead.rating && <span>{competitorRead.rating}★</span>}
              {competitorRead.review_count != null && <span>{competitorRead.review_count.toLocaleString()} ratings</span>}
              {competitorRead.verified ? <span>verified seller</span> : <span>unverified</span>}
            </div>
            <div className="featured-read-verdict">{competitorRead.verdict}</div>
            <div className="featured-read-grid">
              <div>
                <span>Pull</span>
                <p>{competitorRead.strengths[0] ?? "No clear advantage found."}</p>
              </div>
              <div>
                <span>Risk</span>
                <p>{competitorRead.weaknesses[0] ?? "No clear concern found."}</p>
              </div>
            </div>
            {competitorRead.comments[0] && (
              <div className="featured-read-comment">“{competitorRead.comments[0]}”</div>
            )}
          </div>
        )}
      </div>

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
          {agent.profile && (
            <div className="featured-profile" title={agent.profile.blurb}>
              {agent.profile.blurb}
            </div>
          )}
        </div>
        <span className="featured-stage-chip sm">{stageLabel}</span>
      </div>
    </div>
  );
}
