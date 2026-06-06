import type { AgentState } from "@/store/simStore";

/**
 * ⛳ INTEGRATION POINT — owned by your teammate (H3 / browser-use runtime).
 *
 * This is the rich detail panel for the *spotlighted* agent in the big window.
 * H1 keeps it in sync: whenever the user clicks a small tile, the featured agent
 * changes and this component re-renders with the new `agent`. Build whatever the
 * big window should show here — e.g. a live/enlarged browser view, the agent's
 * step trace, reasoning, screenshots, objection history, etc.
 *
 * Contract: you receive the full `AgentState` (id, name, archetype, stage,
 * outcome, thumbnail_url, scroll_pct, objection, retention_time_s, …). Render
 * freely inside `.featured-detail-slot`; the surrounding enlarged tile + meta
 * are provided by H1's FeaturedAgentView.
 */
export function FeaturedAgentDetails({ agent }: { agent: AgentState }) {
  return (
    <div className="featured-detail-slot">
      <div className="eyebrow">Agent detail</div>
      <div className="detail-placeholder">
        Live detail for <strong>{agent.name}</strong> renders here.
        <div className="muted" style={{ marginTop: 4 }}>
          Teammate slot — wired to the selected agent.
        </div>
      </div>
    </div>
  );
}
