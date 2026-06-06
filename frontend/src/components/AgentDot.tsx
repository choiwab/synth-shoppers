import { memo } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { ARCHETYPE_HUE } from "@/types/contracts";
import type { AgentState } from "@/store/simStore";

interface Props {
  agent: AgentState;
  onHover: (agent: AgentState, x: number, y: number) => void;
  onLeave: () => void;
}

/**
 * One funnel dot. `layoutId` lets framer-motion glide it between gate lanes
 * (and into the bought vault) when the agent's stage changes (PRD 01 §4.3).
 */
function AgentDotBase({ agent, onHover, onLeave }: Props) {
  const hue = ARCHETYPE_HUE[agent.archetype];
  return (
    <motion.span
      layout
      layoutId={`dot-${agent.agent_id}`}
      className={clsx("agent-dot", agent.outcome === "bought" && "bought")}
      style={{ ["--hue" as string]: hue }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 38 }}
      onMouseEnter={(e) => onHover(agent, e.clientX, e.clientY)}
      onMouseMove={(e) => onHover(agent, e.clientX, e.clientY)}
      onMouseLeave={onLeave}
    />
  );
}

export const AgentDot = memo(AgentDotBase);
