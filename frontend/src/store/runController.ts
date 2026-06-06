// Ties REST start/rerun + socket + store together. Imperative singleton so the
// left rail and tweaks panel drive the same backend run.
import { rerunSimulation, startSimulation } from "./api";
import { connectSocket, type SimSocket } from "./socket";
import { useSimStore } from "./simStore";
import { currentListingConfig, useControlStore } from "./controlStore";

let socket: SimSocket | null = null;

function attach(runId: string) {
  socket?.close();
  const sink = useSimStore.getState().apply;
  socket = connectSocket(runId, sink);
}

/** Start a fresh run from current tweaks. Resets the dashboard. */
export async function startRun(): Promise<void> {
  const c = useControlStore.getState();
  useSimStore.getState().reset();
  try {
    const { run_id } = await startSimulation({
      listing_config: currentListingConfig(c),
      crowd: { personas: c.personas, crowd_size: c.personas.length, speed: c.speed },
      mode: "real",
    });
    attach(run_id);
  } catch (error) {
    useSimStore.setState({
      status: "error",
      error: error instanceof Error ? error.message : "Failed to start simulation",
    });
  }
}

/** Re-run with the current (possibly mutated) config — used by Re-run + H2's
 *  "Test this fix" handoff. */
export async function rerun(fromRecommendation?: string): Promise<void> {
  const c = useControlStore.getState();
  const prevRunId = useSimStore.getState().runId;
  useSimStore.getState().reset();
  try {
    const { run_id } = prevRunId
      ? await rerunSimulation(prevRunId, {
          listing_config: currentListingConfig(c),
          from_recommendation: fromRecommendation,
        })
      : await startSimulation({
          listing_config: currentListingConfig(c),
          crowd: { personas: c.personas, crowd_size: c.personas.length, speed: c.speed },
          mode: "real",
        });
    attach(run_id);
  } catch (error) {
    useSimStore.setState({
      status: "error",
      error: error instanceof Error ? error.message : "Failed to start simulation",
    });
  }
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
