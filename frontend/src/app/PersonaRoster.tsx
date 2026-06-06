import { useMemo } from "react";
import { motion } from "framer-motion";
import { ARCHETYPE_HUE, type PersonaId } from "@/types/contracts";
import { archetypeInitials, archetypeLabel, archetypeTag } from "@/lib/archetype";
import { useSimStore } from "@/store/simStore";
import { useControlStore } from "@/store/controlStore";
import { useSpotlight } from "@/store/spotlightStore";

export function PersonaRoster() {
  const roster = useSimStore((s) => s.roster);
  const status = useSimStore((s) => s.status);
  const agents = useSimStore((s) => s.agents);
  const enabled = useControlStore((s) => s.personas);
  const pick = useSpotlight((s) => s.pick);

  // spotlight the first-spawned agent of a clicked archetype
  const spotlightArchetype = (id: PersonaId) => {
    const rep = Object.values(agents)
      .filter((a) => a.archetype === id)
      .sort((a, b) => a.spawnOrder - b.spawnOrder)[0];
    if (rep) pick(rep.agent_id);
  };

  const rows = useMemo(() => {
    const list = enabled.map((id) => {
      const r = roster[id];
      const rate = r.total > 0 ? r.bought / r.total : 0;
      return { id: id as PersonaId, ...r, rate };
    });
    // sort by buy rate desc once complete; stable (by enabled order) while running
    if (status === "complete") list.sort((a, b) => b.rate - a.rate);
    return list;
  }, [roster, enabled, status]);

  return (
    <section className="panel roster">
      <div className="section-head">
        <span className="section-title">Persona Roster · buy rate</span>
        {status === "complete" && <span className="count-pill">sorted</span>}
      </div>
      <div className="roster-list">
        {rows.map((r) => (
          <div
            className="roster-row"
            key={r.id}
            role="button"
            tabIndex={0}
            title={`Spotlight a ${archetypeLabel(r.id)} agent`}
            onClick={() => spotlightArchetype(r.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && spotlightArchetype(r.id)}
          >
            <div
              className="roster-avatar"
              style={{ ["--hue" as string]: ARCHETYPE_HUE[r.id] }}
            >
              {archetypeInitials(r.id)}
            </div>
            <div className="roster-mid">
              <div className="roster-name">
                {archetypeLabel(r.id)}
                <span className="roster-tag">{archetypeTag(r.id)}</span>
              </div>
              <div className="roster-bar">
                <motion.div
                  className="roster-bar-fill"
                  style={{ ["--hue" as string]: ARCHETYPE_HUE[r.id] }}
                  animate={{ width: `${Math.round(r.rate * 100)}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 30 }}
                />
              </div>
            </div>
            <div className="roster-stat">
              <span className="pct">{Math.round(r.rate * 100)}%</span>{" "}
              <span className="frac">
                ({r.bought}/{r.total})
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
