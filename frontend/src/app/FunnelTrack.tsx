import { useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import { ARCHETYPE_HUE, GATES, GATE_LABELS } from "@/types/contracts";
import { archetypeLabel } from "@/lib/archetype";
import { AgentDot } from "@/components/AgentDot";
import { selectActiveByGate, useSimStore, type AgentState } from "@/store/simStore";

interface Hover {
  agent: AgentState;
  x: number;
  y: number;
}

export function FunnelTrack() {
  const agents = useSimStore((s) => s.agents);
  const bailsByGate = useSimStore((s) => s.bailsByGate);
  const competitors = useSimStore((s) => s.competitors);
  const competitorOrder = useSimStore((s) => s.competitorOrder);
  const counts = useSimStore((s) => s.counts);
  const status = useSimStore((s) => s.status);
  const [hover, setHover] = useState<Hover | null>(null);

  const activeByGate = useMemo(() => selectActiveByGate(agents), [agents]);
  const discovery = useMemo(
    () =>
      Object.values(agents).filter(
        (a) => a.outcome === "active" && a.stage === "discovery",
      ),
    [agents],
  );
  const bailedByGate = useMemo(() => {
    const out: Record<string, AgentState[]> = {};
    for (const g of GATES) out[g] = [];
    for (const a of Object.values(agents)) {
      if (a.outcome === "bailed" && out[a.stage]) out[a.stage].push(a);
    }
    return out;
  }, [agents]);
  const bought = useMemo(
    () => Object.values(agents).filter((a) => a.outcome === "bought"),
    [agents],
  );

  // share-of-market: who even reached our listing (land or beyond), vs. the
  // whole crowd that entered discovery.
  const marketTotal = counts.total || Object.keys(agents).length;
  const considered = useMemo(
    () =>
      Object.values(agents).filter(
        (a) =>
          a.outcome === "bought" ||
          a.outcome === "bailed" ||
          (a.outcome === "active" && GATES.includes(a.stage)),
      ).length,
    [agents],
  );
  const reachPct = marketTotal ? Math.round((considered / marketTotal) * 100) : 0;

  const onHover = (agent: AgentState, x: number, y: number) =>
    setHover({ agent, x, y });
  const onLeave = () => setHover(null);

  const idle = status === "idle" && Object.keys(agents).length === 0;

  return (
    <section className="panel funnel">
      <div className="section-head">
        <span className="section-title">Funnel Track · market → drop-off</span>
        <div className="head-pills">
          <span className="count-pill reach-pill" title="Share of the market that reached our listing">
            considered us {reachPct}% ({considered}/{marketTotal})
          </span>
          <span className="count-pill">
            {bought.length} bought · {Object.values(bailsByGate).reduce((a, b) => a + b, 0)} bailed
            {counts.diverted > 0 ? ` · ${counts.diverted} left` : ""}
          </span>
        </div>
      </div>

      {idle ? (
        <div className="funnel-idle">
          <div style={{ fontSize: 34 }}>🛒</div>
          <div className="display" style={{ fontSize: 18 }}>
            Press Run
          </div>
          <div className="muted">
            Agents enter the market, then either land on us or leave for a competitor.
          </div>
        </div>
      ) : (
        <LayoutGroup>
          <div className="funnel-body">
            <div className="gates-wrap">
              {/* upper band: market intake → 6 gates */}
              <div className="flow-row">
                <div className="market-col">
                  <div className="gate-head">
                    <div className="gate-num">0</div>
                    <div className="gate-name">Market</div>
                    <div className="gate-count">{discovery.length}</div>
                  </div>
                  <div className="gate-lane market-lane">
                    <AnimatePresence>
                      {discovery.map((a) => (
                        <AgentDot key={a.agent_id} agent={a} onHover={onHover} onLeave={onLeave} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="gate-cols">
                  {GATES.map((gate, i) => (
                    <div className="gate-col" key={gate}>
                      <div className="gate-head">
                        <div className="gate-num">{i + 1}</div>
                        <div className="gate-name">{GATE_LABELS[gate]}</div>
                        <div className="gate-count">{activeByGate[gate].length}</div>
                      </div>
                      <div className="gate-lane">
                        <AnimatePresence>
                          {activeByGate[gate].map((a) => (
                            <AgentDot key={a.agent_id} agent={a} onHover={onHover} onLeave={onLeave} />
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* lower band: competitor leakage (under market) | bail sediment (under gates) */}
              <div className="leak-row">
                <div className="competitors">
                  <div className="eyebrow" style={{ marginBottom: 6 }}>
                    Went to competitors
                  </div>
                  {competitorOrder.length === 0 ? (
                    <div className="muted comp-empty">No competitor leakage yet</div>
                  ) : (
                    <div className="comp-list">
                      {competitorOrder.map((id) => {
                        const stat = competitors[id];
                        return (
                          <div
                            className="competitor-line"
                            key={id}
                            title={`${stat.name}: ${stat.landed} landed, ${stat.bought} bought`}
                          >
                            <span className="comp-name">{stat.name}</span>
                            <span className="comp-reach mono">
                              land {stat.landed} →{" "}
                              <span className="comp-won">✓ {stat.bought}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="sediment">
                  <div className="eyebrow" style={{ marginBottom: 6 }}>
                    Where they bailed
                  </div>
                  <div className="sediment-cols">
                    {GATES.map((gate) => (
                      <div className="sediment-col" key={gate}>
                        <div className="sediment-dots">
                          {bailedByGate[gate].slice(0, 18).map((a) => (
                            <span
                              key={a.agent_id}
                              className="sediment-dot"
                              style={{ ["--hue" as string]: ARCHETYPE_HUE[a.archetype] }}
                              onMouseEnter={(e) => onHover(a, e.clientX, e.clientY)}
                              onMouseLeave={onLeave}
                            />
                          ))}
                        </div>
                        {bailsByGate[gate] > 0 && (
                          <div className="drop-chip">↓ {bailsByGate[gate]} bailed</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* bought vault */}
            <div className="vault">
              <div className="eyebrow">Bought</div>
              <div className="vault-num">{bought.length}</div>
              <div className="vault-dots">
                <AnimatePresence>
                  {bought.map((a) => (
                    <AgentDot key={a.agent_id} agent={a} onHover={onHover} onLeave={onLeave} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </LayoutGroup>
      )}

      {hover && <DotTooltip hover={hover} />}
    </section>
  );
}

function DotTooltip({ hover }: { hover: Hover }) {
  const { agent, x, y } = hover;
  const where =
    agent.outcome === "bought"
      ? "Bought ✓"
      : agent.outcome === "bailed"
        ? `Bailed at ${GATE_LABELS[agent.stage]}`
        : agent.outcome === "diverted"
          ? agent.lastAction ?? "Left for a competitor"
          : GATE_LABELS[agent.stage];
  return (
    <div className="dot-tooltip" style={{ left: x + 14, top: y + 14 }}>
      <div className="tt-name">{agent.name}</div>
      <div className="tt-row">{archetypeLabel(agent.archetype)}</div>
      <div className="tt-row">{where}</div>
      {agent.objection && <div className="tt-obj">“{agent.objection}”</div>}
    </div>
  );
}
