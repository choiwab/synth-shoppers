import { useMemo, useState } from "react";
import { PERSONA_IDS } from "@/types/contracts";
import { useSimStore, type AgentState } from "@/store/simStore";
import { AgentTile } from "@/components/AgentTile";
import { FeaturedAgentView } from "@/components/FeaturedAgentView";

type CameraMode = "spotlight" | "gallery";

const ARCH_INDEX: Record<string, number> = Object.fromEntries(
  PERSONA_IDS.map((id, i) => [id, i]),
);

/**
 * Two camera modes for the live monitor:
 *  - "spotlight": one big featured agent + up to 6 small tiles (one per archetype).
 *  - "gallery":   every agent in the crowd, 7 per row, scrollable.
 * Click any tile to spotlight that agent.
 */
export function AgentStrip() {
  const agents = useSimStore((s) => s.agents);
  const error = useSimStore((s) => s.error);
  const runId = useSimStore((s) => s.runId);
  const [mode, setMode] = useState<CameraMode>("spotlight");
  // the user's explicit pick (undefined until they click a tile)
  const [pickedId, setPickedId] = useState<string | undefined>();

  const all = Object.values(agents);

  // one representative per archetype: the first-spawned agent of each persona,
  // in canonical persona order. Stable across the run.
  const reps = useMemo(() => {
    const byArch = new Map<string, AgentState>();
    for (const a of all) {
      const cur = byArch.get(a.archetype);
      if (!cur || a.spawnOrder < cur.spawnOrder) byArch.set(a.archetype, a);
    }
    return PERSONA_IDS.map((id) => byArch.get(id)).filter(
      (a): a is AgentState => Boolean(a),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents]);

  // gallery: every agent, grouped by archetype (color bands) then spawn order.
  const gallery = useMemo(
    () =>
      [...all].sort(
        (a, b) =>
          (ARCH_INDEX[a.archetype] ?? 0) - (ARCH_INDEX[b.archetype] ?? 0) ||
          a.spawnOrder - b.spawnOrder,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agents],
  );

  // featured = the user's pick if it's still present, else the first rep.
  const featured = (pickedId && agents[pickedId]) || reps[0];
  const smallReps = reps.filter((r) => r.agent_id !== featured?.agent_id);

  const spotlight = (id: string) => {
    setPickedId(id);
    setMode("spotlight");
  };

  return (
    <section className="panel agent-panel">
      <div className="section-head">
        <span className="section-title">Backend Agent Screenshots</span>
        <div className="strip-head-right">
          <div className="strip-modes" role="tablist">
            <button
              className={mode === "spotlight" ? "on" : undefined}
              onClick={() => setMode("spotlight")}
            >
              Spotlight
            </button>
            <button
              className={mode === "gallery" ? "on" : undefined}
              onClick={() => setMode("gallery")}
            >
              Gallery
            </button>
          </div>
          <span className="count-pill">{all.length} agents</span>
        </div>
      </div>

      <div className="agent-strip">
        {all.length === 0 || !featured ? (
          <div className="muted" style={{ padding: "8px 2px", fontSize: 13 }}>
            {error
              ? `Could not start backend agents: ${error}`
              : runId
                ? "Waiting for backend agents to send screenshots…"
                : "Press Run agents to start backend browsing."}
          </div>
        ) : mode === "spotlight" ? (
          <div className="agent-spotlight">
            <FeaturedAgentView agent={featured} />
            <div className="spotlight-grid">
              {smallReps.map((a) => (
                <button
                  key={a.agent_id}
                  type="button"
                  className="spotlight-tile"
                  onClick={() => spotlight(a.agent_id)}
                  title={a.profile ? `${a.name} — ${a.profile.blurb}` : `Spotlight ${a.name}`}
                >
                  <AgentTile agent={a} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="agent-gallery">
            {gallery.map((a) => (
              <button
                key={a.agent_id}
                type="button"
                className="spotlight-tile"
                onClick={() => spotlight(a.agent_id)}
                title={a.profile ? `${a.name} — ${a.profile.blurb}` : a.name}
              >
                <AgentTile agent={a} />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
