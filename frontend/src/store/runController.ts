// Ties REST start/rerun + socket + store together. Imperative singleton so the
// header, tweaks panel, and auto-start on mount all drive the same run.
import { MOCK, rerunSimulation, startSimulation } from "./api";
import { connectMockSocket } from "./mockSocket";
import { connectSocket, type SimSocket } from "./socket";
import { useSimStore } from "./simStore";
import { currentListingConfig, useControlStore } from "./controlStore";
import type { SimMode } from "@/types/contracts";

let socket: SimSocket | null = null;

/** 4× ⇒ mock (PRD §4.6); VITE_MOCK forces mock for backend-free dev. */
function effectiveMode(): SimMode {
  const { speed } = useControlStore.getState();
  return MOCK || speed === 4 ? "mock" : "real";
}

function attach(runId: string, mode: SimMode) {
  socket?.close();
  const { speed } = useControlStore.getState();
  const sink = useSimStore.getState().apply;
  socket =
    mode === "mock"
      ? connectMockSocket(runId, sink, speed)
      : connectSocket(runId, sink);
}

/** Start a fresh run from current tweaks. Resets the dashboard. */
export async function startRun(): Promise<void> {
  const c = useControlStore.getState();
  const mode = effectiveMode();
  useSimStore.getState().reset();
  const { run_id } = await startSimulation({
    listing_config: currentListingConfig(c),
    crowd: { personas: c.personas, crowd_size: c.crowdSize, speed: c.speed },
    mode,
  });
  attach(run_id, mode);
}

/** Re-run with the current (possibly mutated) config — used by Re-run + H2's
 *  "Test this fix" handoff. */
export async function rerun(fromRecommendation?: string): Promise<void> {
  const c = useControlStore.getState();
  const prevRunId = useSimStore.getState().runId;
  const mode = effectiveMode();
  useSimStore.getState().reset();
  const { run_id } = prevRunId
    ? await rerunSimulation(prevRunId, {
        listing_config: currentListingConfig(c),
        from_recommendation: fromRecommendation,
      })
    : await startSimulation({
        listing_config: currentListingConfig(c),
        crowd: { personas: c.personas, crowd_size: c.crowdSize, speed: c.speed },
        mode,
      });
  attach(run_id, mode);
}

export function pauseRun(): void {
  socket?.pause();
  useSimStore.setState({ status: "paused" });
}

export function resumeRun(): void {
  socket?.resume();
  useSimStore.setState({ status: "running" });
}

export function setRunSpeed(speed: number): void {
  socket?.setSpeed(speed);
}

export function teardownRun(): void {
  socket?.close();
  socket = null;
}
