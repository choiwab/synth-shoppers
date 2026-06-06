import { useMemo, useState } from "react";
import { PERSONA_IDS } from "@/types/contracts";
import { useSimStore, type AgentState } from "@/store/simStore";
import { AgentTile } from "@/components/AgentTile";
import { FeaturedAgentView } from "@/components/FeaturedAgentView";

/**
 * Spotlight layout: one big featured agent (left) + up to 6 small tiles (right),
 * one representative agent per archetype (7 total). Click a small tile to
 * promote it into the big window.
 */
export function AgentStrip() {
  const agents = useSimStore((s) => s.agents);
  const error = useSimStore((s) => s.error);
  const runId = useSimStore((s) => s.runId);
  // the user's explicit pick (undefined until they click a tile)
  const [pickedId, setPickedId] = useState<string | undefined>();

  // one representative per archetype: the first-spawned agent of each persona,
  // in canonical persona order. Stable across the run.
  const reps = useMemo(() => {
    const byArch = new Map<string, AgentState>();
    for (const a of Object.values(agents)) {
      const cur = byArch.get(a.archetype);
      if (!cur || a.spawnOrder < cur.spawnOrder) byArch.set(a.archetype, a);
    }
    return PERSONA_IDS.map((id) => byArch.get(id)).filter(
      (a): a is AgentState => Boolean(a),
    );
  }, [agents]);

  // featured = the user's pick if it's still present, else the first rep
  // (persona order). Falls back automatically on a new run / when reps change.
  const featured = (pickedId && reps.find((r) => r.agent_id === pickedId)) || reps[0];
  const smallReps = reps.filter((r) => r.agent_id !== featured?.agent_id);

  return (
    <section className="panel agent-panel">
      <div className="section-head">
        <span className="section-title">Backend Agent Screenshots</span>
        <span className="count-pill">{reps.length} agents</span>
      </div>
      <div className="agent-strip">
        {reps.length === 0 || !featured ? (
          <div className="muted" style={{ padding: "8px 2px", fontSize: 13 }}>
            {error
              ? `Could not start backend agents: ${error}`
              : runId
                ? "Waiting for backend agents to send screenshots…"
                : "Press Run agents to start backend browsing."}
          </div>
        ) : (
          <div className="agent-spotlight">
            <FeaturedAgentView agent={featured} />
            <div className="spotlight-grid">
              {smallReps.map((a) => (
                <button
                  key={a.agent_id}
                  type="button"
                  className="spotlight-tile"
                  onClick={() => setPickedId(a.agent_id)}
                  title={`Spotlight ${a.name}`}
                >
                  <AgentTile agent={a} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
